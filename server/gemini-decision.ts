import { GoogleGenAI } from "@google/genai";
import type { TechnicalIndicators } from "./technical-analysis";
import { WebSocket } from "ws";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface GeminiTradeTargets {
  entry: { low: number; high: number };
  target: { low: number; high: number };
  stop: number;
}

export interface GeminiPredictionDecision {
  direction: "UP" | "DOWN" | "NEUTRAL";
  confidence: number;
  rationale: string;
  riskFactors: string[];
  thinkingProcess?: string;
  keyFactors?: string[];
  tradeTargets?: GeminiTradeTargets;
  duration?: string;
}

interface TechnicalAnalysisSnapshot {
  pair: string;
  currentPrice: number;
  priceChange24h: number;
  marketRegime: "STRONG_TRENDING" | "TRENDING" | "RANGING";
  entryTimeframe: string;
  anchorTimeframe: string;
  entryTrendBias: "BULLISH" | "BEARISH" | "NEUTRAL";
  anchorTrendBias: "BULLISH" | "BEARISH" | "NEUTRAL";
  upSignals: { category: string; reason: string; strength: number }[];
  downSignals: { category: string; reason: string; strength: number }[];
  upScore: number;
  downScore: number;
  volumeIndicator: number;
  volumeMA: number;
  currentVolume: number;
  trendStrength: number;
  volatility: number;
  rsiValue: number;
  macdSignal: string;
  adxValue: number;
}

async function callGeminiModelStreaming(
  model: string,
  systemPrompt: string,
  analysisText: string,
  schema: any,
  useThinking: boolean = false,
  ws?: WebSocket
): Promise<GeminiPredictionDecision | null> {
  const config: any = {
    systemInstruction: systemPrompt,
    responseMimeType: "application/json",
    responseSchema: schema,
    temperature: 0.3,
  };

  if (useThinking) {
    config.thinkingConfig = {
      thinkingBudget: 8192,
      includeThoughts: true,
    };
  }

  const streamResultPromise = ai.models.generateContentStream({
    model,
    config,
    contents: analysisText,
  });

  let thinkingProcess = "";
  let jsonText = "";
  
  const streamResult = await streamResultPromise;
  
  for await (const chunk of streamResult) {
    if (!chunk.candidates || chunk.candidates.length === 0) continue;
    
    const parts = chunk.candidates[0]?.content?.parts;
    if (!parts || !Array.isArray(parts)) continue;
    
    for (const part of parts) {
      if ((part as any).thought && part.text) {
        let cleanText = part.text.replace(/\*/g, '');
        
        // Remove JSON code blocks (```json ... ```)
        cleanText = cleanText.replace(/```json[\s\S]*?```/g, '');
        cleanText = cleanText.replace(/```[\s\S]*?```/g, '');
        
        // Remove standalone curly braces that might be JSON fragments
        cleanText = cleanText.replace(/^\s*\{[\s\S]*?\}\s*$/gm, '');
        
        const jsonPatterns = [
          /output.*?json/gi,
          /in json format/gi,
          /json schema/gi,
          /json.*?structure/gi,
          /response.*?json/gi,
          /provide.*?json/gi,
          /return.*?json/gi,
          /format.*?json/gi,
          /the json output/gi,
          /json output/gi,
          /my.*?json/gi,
          /craft.*?json/gi,
          /generat.*?json/gi,
          /creat.*?json/gi,
          /complet.*?json/gi,
          /solidify.*?json/gi,
          /fine-tun.*?json/gi
        ];
        
        jsonPatterns.forEach(pattern => {
          cleanText = cleanText.replace(pattern, '');
        });
        
        // Remove common repetitive phrases
        const repetitivePatterns = [
          /I'm solidifying my approach and fine-tuning the recommendation\./gi,
          /I'm now crafting the final JSON output\./gi,
          /My recommendation is complete\./gi,
          /The JSON output below summarizes my current thinking\./gi,
          /I've considered the contradictory signals/gi
        ];
        
        repetitivePatterns.forEach(pattern => {
          cleanText = cleanText.replace(pattern, '');
        });
        
        cleanText = cleanText.replace(/\s{2,}/g, ' ').trim();
        
        if (cleanText) {
          thinkingProcess += cleanText + ' ';
          
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: "ai_thinking_stream",
              thought: cleanText,
              fullThinking: thinkingProcess.trim()
            }));
          }
        }
      } else if (part.text && !(part as any).thought) {
        jsonText += part.text;
      }
    }
  }
  
  if (!jsonText) {
    throw new Error('No JSON content in Gemini response');
  }

  const decision: GeminiPredictionDecision = JSON.parse(jsonText);
  decision.confidence = Math.round(Math.max(90, Math.min(98, decision.confidence)));
  
  if (thinkingProcess) {
    decision.thinkingProcess = thinkingProcess;
  }

  return decision;
}

export async function getGeminiPrediction(
  snapshot: TechnicalAnalysisSnapshot,
  ws?: WebSocket
): Promise<GeminiPredictionDecision | null> {
  const systemPrompt = `You are an elite quantitative crypto trading strategist with deep expertise in technical analysis and multi-timeframe trend alignment.

Your task: Analyze the provided technical indicators and market data to make a precise trading prediction. THINK DEEPLY about each aspect before deciding.

CRITICAL REQUIREMENTS:
1. Direction: Choose "UP", "DOWN", or "NEUTRAL" (only use NEUTRAL if truly no edge exists)
2. Confidence: Must be between 90-98%. Use the full range intelligently:
   - 90-92%: Moderate setup with some conflicting signals
   - 93-95%: Strong setup with good alignment
   - 96-98%: Exceptional setup with near-perfect alignment
   IMPORTANT: Vary your confidence naturally - do NOT always return the same value!
3. Rationale: 2-3 sentences explaining the key factors driving your decision
4. Risk Factors: 2-4 specific risks to this trade
5. Key Factors: 3-6 bullet points listing the most important indicators supporting your decision
6. Trade Targets (required for UP/DOWN): Provide a clean, actionable plan using the current price and ATR/volatility:
   - entry: a tight ENTRY range around the current price (low/high)
   - target: a realistic TARGET range in the trade direction (low/high)
   - stop: a STOP price that invalidates the setup (single number)

TRADE TARGET GUIDELINES:
- Keep ENTRY close to current price (a small band, not a huge zone)
- Use ATR/volatility to size distances (targets typically 1.5–2.5x ATR away, stops ~0.8–1.3x ATR away)
- For UP: stop < entry.low; target.high > entry.high
- For DOWN: stop > entry.high; target.low < entry.low

7. Duration: Provide a typical duration for this trade (e.g., "1-4 hours", "12-24 hours", etc.)

TREND ALIGNMENT (CRITICAL):
- You will see Entry Timeframe and Anchor Timeframe data
- Entry TF is the user's selected timeframe
- Anchor TF is one level higher (the "Big Picture")
- REJECT trades where Entry trend conflicts with Anchor trend
- Example: If Entry is LONG but Anchor is BEARISH → Reject as "Trend Conflict"
- Only proceed when trends align or both are neutral

VOLUME CONFIRMATION RULES:
- Volume must be at least 1.5x the 20-period Volume MA
- If price makes new high but volume decreases → "Weak Breakout" (reject)
- If price makes new low but volume decreases → "Weak Breakdown" (reject)

CONFIDENCE CALIBRATION:
- If signals are mixed or market regime is RANGING → 90-92%
- If strong directional bias but some counter-signals → 93-94%
- If very strong alignment and favorable regime → 95-96%
- If exceptional alignment, strong trend, and volume confirmation → 97-98%
- ADX < 20 indicates ranging market → Use NEUTRAL or lower confidence

Think critically about the data quality and signal alignment. Not every prediction deserves 97%! Reason through your decision step by step.`;

  const analysisText = `
MARKET SNAPSHOT:
Pair: ${snapshot.pair}
Current Price: ${snapshot.currentPrice.toFixed(2)}
24h Change: ${snapshot.priceChange24h >= 0 ? '+' : ''}${snapshot.priceChange24h.toFixed(2)}%
Market Regime: ${snapshot.marketRegime}

TIMEFRAME ANALYSIS:
Entry Timeframe: ${snapshot.entryTimeframe} (User selected)
Anchor Timeframe: ${snapshot.anchorTimeframe} (One level higher)
Entry Trend Bias: ${snapshot.entryTrendBias}
Anchor Trend Bias: ${snapshot.anchorTrendBias}

TREND ALIGNMENT STATUS:
${snapshot.entryTrendBias === snapshot.anchorTrendBias ? '✓ Trends Aligned' : '⚠ Trend Conflict Risk'}
${snapshot.entryTrendBias === 'BULLISH' && snapshot.anchorTrendBias === 'BULLISH' ? '  → Both timeframes show bullish bias - favorable for LONG trades' : ''}
${snapshot.entryTrendBias === 'BEARISH' && snapshot.anchorTrendBias === 'BEARISH' ? '  → Both timeframes show bearish bias - favorable for SHORT trades' : ''}
${snapshot.entryTrendBias !== snapshot.anchorTrendBias ? '  → ENTRY CONFLICT: Entry timeframe conflicts with anchor trend - RECOMMEND REJECTION' : ''}

TECHNICAL INDICATORS:
- RSI: ${snapshot.rsiValue.toFixed(1)} ${snapshot.rsiValue >= 45 && snapshot.rsiValue <= 55 ? '(NEUTRAL ZONE - OBSERVATION MODE)' : ''}
- MACD Signal: ${snapshot.macdSignal}
- Trend Strength: ${snapshot.trendStrength.toFixed(1)}%
- Volume Indicator: ${snapshot.volumeIndicator.toFixed(1)}%
- Current Volume: ${snapshot.currentVolume.toFixed(0)}
- Volume MA (20): ${snapshot.volumeMA.toFixed(0)}
- Volume Ratio: ${(snapshot.volumeMA > 0 ? snapshot.currentVolume / snapshot.volumeMA : 1).toFixed(2)}x ${(snapshot.volumeMA > 0 && snapshot.currentVolume / snapshot.volumeMA >= 1.5 ? '✓ Confirmed' : '⚠ Below threshold (1.5x)')}
- Volatility (ATR): ${snapshot.volatility.toFixed(2)}
- ADX: ${snapshot.adxValue.toFixed(1)} ${snapshot.adxValue < 20 ? '(Ranging market - low confidence)' : '(Trending market)'}

SIGNAL ANALYSIS:
UP Signals (Score: ${snapshot.upScore.toFixed(1)}):
${snapshot.upSignals.map(s => `  • ${s.category}: ${s.reason} (${s.strength.toFixed(0)})`).join('\n')}

DOWN Signals (Score: ${snapshot.downScore.toFixed(1)}):
${snapshot.downSignals.map(s => `  • ${s.category}: ${s.reason} (${s.strength.toFixed(0)})`).join('\n')}

Based on this multi-timeframe technical analysis, provide your trading decision. Pay special attention to trend alignment and volume confirmation.`;

  const schema = {
    type: "object",
    properties: {
      direction: {
        type: "string",
        enum: ["UP", "DOWN", "NEUTRAL"],
      },
      confidence: {
        type: "number",
        minimum: 90,
        maximum: 98,
      },
      rationale: { type: "string" },
      riskFactors: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 4,
      },
      keyFactors: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 6,
      },
      tradeTargets: {
        type: "object",
        properties: {
          entry: {
            type: "object",
            properties: {
              low: { type: "number" },
              high: { type: "number" },
            },
            required: ["low", "high"],
          },
          target: {
            type: "object",
            properties: {
              low: { type: "number" },
              high: { type: "number" },
            },
            required: ["low", "high"],
          },
          stop: { type: "number" },
        },
        required: ["entry", "target", "stop"],
      },
      duration: { type: "string" },
    },
    required: ["direction", "confidence", "rationale", "riskFactors", "keyFactors", "tradeTargets", "duration"],
  };

  try {
    console.log('\n🤖 Calling Gemini 3 Pro Preview with THINKING mode (streaming)...');
    const decision = await callGeminiModelStreaming("gemini-3-pro-preview", systemPrompt, analysisText, schema, true, ws);
    
    if (decision) {
      console.log(`✅ Gemini 3 Pro Preview Decision: ${decision.direction} | ${decision.confidence}%`);
      console.log(`   Rationale: ${decision.rationale}`);
      if (decision.thinkingProcess) {
        console.log(`   🧠 Thinking captured (${decision.thinkingProcess.length} chars)`);
      }
      return decision;
    }
  } catch (error: any) {
    console.warn(`⚠️  Gemini 3 Pro Preview failed: ${error.message}`);
    console.log('🔄 Falling back to Gemini 2.5 Pro with THINKING mode...');
    
    try {
      const decision = await callGeminiModelStreaming("gemini-2.5-pro", systemPrompt, analysisText, schema, true, ws);
      
      if (decision) {
        console.log(`✅ Gemini 2.5 Pro Decision: ${decision.direction} | ${decision.confidence}%`);
        console.log(`   Rationale: ${decision.rationale}`);
        if (decision.thinkingProcess) {
          console.log(`   🧠 Thinking captured (${decision.thinkingProcess.length} chars)`);
        }
        return decision;
      }
    } catch (fallbackError: any) {
      console.warn(`⚠️  Gemini 2.5 Pro failed: ${fallbackError.message}`);
      console.log('🔄 Falling back to Gemini Flash Latest with THINKING mode...');
      
      try {
        const decision = await callGeminiModelStreaming("gemini-flash-latest", systemPrompt, analysisText, schema, true, ws);
        
        if (decision) {
          console.log(`✅ Gemini Flash Latest Decision: ${decision.direction} | ${decision.confidence}%`);
          console.log(`   Rationale: ${decision.rationale}`);
          if (decision.thinkingProcess) {
            console.log(`   🧠 Thinking captured (${decision.thinkingProcess.length} chars)`);
          }
          return decision;
        }
      } catch (finalFallbackError: any) {
        console.error(`❌ All Gemini models failed: ${finalFallbackError.message}`);
        return null;
      }
    }
  }

  return null;
}
