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
  newsContext?: string[];
  safetyAudit?: { name: string; status: string; value: string; message: string }[];
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
  decision.confidence = Math.round(Math.max(80, Math.min(99, decision.confidence)));

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

Your task: Analyze the provided technical indicators and market data to make a precise trading prediction.
- **FIRST**: Explicitly state "I am analyzing the [Entry Timeframe] chart..." in your thinking process.
- **THINK DEEPLY** about each aspect before deciding.

CRITICAL REQUIREMENTS:
1. Direction: Choose "UP", "DOWN", or "NEUTRAL"
2. Confidence: Must be between 80-99%. Use the full range intelligently:
   - 80-85%: Moderate setup with some conflicting signals or ranging conditions
   - 86-92%: Strong setup with good alignment
   - 93-99%: Exceptional setup with near-perfect alignment
   IMPORTANT: BE DECISIVE. If you see a good edge, do NOT default to NEUTRAL. Use the 80-88% range for decent "probable" setups.
   Only use NEUTRAL if the market is completely dead (ADX < 12) or providing truly conflicting chaos.
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

7. Duration: ESTIMATED TRADE DURATION. Do NOT be generic. Based on volatility and target distance:
   - Scalps (M1-M5): "5-15 mins" or "10-30 mins"
   - Day Trades (M15-H1): "1-4 hours" or "Session End"
   - Swings (H4-D1): "2-5 days" or "Weekly Hold"
   - Calculate this based on (ATR / current_volatility).

TREND ALIGNMENT & TIMEFRAME FOCUS:
- You will see Entry Timeframe and Anchor Timeframe data.
- **CRITICAL**: The USER'S selected "Entry Timeframe" is the Boss. Analyze the chart PRIMARILY based on this timeframe.
- Use the Anchor Timeframe ONLY for context/confirmation. Do not let a conflicting Anchor timeframe override a perfect setup on the Entry timeframe.
- If Entry TF says UP and Anchor says DOWN, you can still trade UP if the Entry pattern is strong.
- If trends conflict, you may still proceed if you see a strong reversal pattern or significant momentum, but reduce confidence accordingly.

VOLUME CONFIRMATION:
- Volume at least 1.1x the 20-period Volume MA is preferred for confirmation.
- If price makes new high/low but volume is significantly decreasing, be cautious of a "Weak Breakout/Breakdown".

CONFIDENCE CALIBRATION:
- If signals are mixed or market regime is RANGING → 80-85%
- If strong directional bias but some counter-signals → 86-92%
- If very strong alignment and favorable regime → 93-96%
- If exceptional alignment, strong trend, and volume confirmation → 97-99%
- ADX < 12 is the ONLY "hard" neutral indicator. Anything else can be traded if price action/momentum is good.
- Don't simply average the signals. Look for the "story" of the chart. A divergence + support bounce is a high probability trade even if moving averages are mixed.
- Trust high conviction signals. If you see a 99% setup, give it 99%.

Think like a hedge fund algorithm: Risk/Reward is key. If the setup is decent (3:1 reward), take the trade with 85% confidence.`;

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
${snapshot.entryTrendBias !== snapshot.anchorTrendBias ? '  → ENTRY CONFLICT: Entry timeframe conflicts with anchor trend - EXERCISE CAUTION' : ''}

TECHNICAL INDICATORS:
- RSI: ${snapshot.rsiValue.toFixed(1)} ${snapshot.rsiValue >= 48 && snapshot.rsiValue <= 52 ? '(NEUTRAL ZONE)' : ''}
- MACD Signal: ${snapshot.macdSignal}
- Trend Strength: ${snapshot.trendStrength.toFixed(1)}%
- Volume Indicator: ${snapshot.volumeIndicator.toFixed(1)}%
- Current Volume: ${snapshot.currentVolume.toFixed(0)}
- Volume MA (20): ${snapshot.volumeMA.toFixed(0)}
- Volume Ratio: ${(snapshot.volumeMA > 0 ? snapshot.currentVolume / snapshot.volumeMA : 1).toFixed(2)}x ${(snapshot.volumeMA > 0 && snapshot.currentVolume / snapshot.volumeMA >= 1.1 ? '✓ Confirmed' : '⚠ Below preferred threshold (1.1x)')}
- Volatility (ATR): ${snapshot.volatility.toFixed(2)}
- ADX: ${snapshot.adxValue.toFixed(1)} ${snapshot.adxValue < 15 ? '(Tight range)' : '(Trending market)'}

${snapshot.safetyAudit && snapshot.safetyAudit.length > 0 ? `HEDGE FUND SAFETY AUDIT:
The following institutional-grade safety checks were performed:
${snapshot.safetyAudit.map(c => `- ${c.name}: ${c.status} (${c.value}) - ${c.message}`).join('\n')}
(Weight these audit results heavily. "FAIL" statuses represent significant institutional resistance or structural weakness.)` : ''}

${snapshot.newsContext && snapshot.newsContext.length > 0 ? `MARKET SENTIMENT / NEWS CONTEXT:
The following recent headlines are relevant to ${snapshot.pair} or key market drivers:
${snapshot.newsContext.map(h => `- ${h}`).join('\n')}
(Consider these headlines for sentiment context, mainly to support or contradict technical bias.)` : ''}

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
        minimum: 80,
        maximum: 99,
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
