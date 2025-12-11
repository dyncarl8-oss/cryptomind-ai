import { GoogleGenAI } from "@google/genai";
import type { TechnicalIndicators } from "./technical-analysis";
import { WebSocket } from "ws";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface GeminiPredictionDecision {
  direction: "UP" | "DOWN" | "NEUTRAL";
  confidence: number;
  rationale: string;
  riskFactors: string[];
  thinkingProcess?: string;
  keyFactors?: string[];
}

interface TechnicalAnalysisSnapshot {
  pair: string;
  currentPrice: number;
  priceChange24h: number;
  marketRegime: "STRONG_TRENDING" | "TRENDING" | "RANGING";
  upSignals: { category: string; reason: string; strength: number }[];
  downSignals: { category: string; reason: string; strength: number }[];
  upScore: number;
  downScore: number;
  volumeIndicator: number;
  trendStrength: number;
  volatility: number;
  rsiValue: number;
  macdSignal: string;
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
  const systemPrompt = `You are an elite quantitative crypto trading strategist with deep expertise in technical analysis and short-term price movements.

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

CONFIDENCE CALIBRATION:
- If signals are mixed or market regime is RANGING → 90-92%
- If strong directional bias but some counter-signals → 93-94%
- If very strong alignment and favorable regime → 95-96%
- If exceptional alignment, strong trend, and volume confirmation → 97-98%

Think critically about the data quality and signal alignment. Not every prediction deserves 97%! Reason through your decision step by step.`;

  const analysisText = `
MARKET SNAPSHOT:
Pair: ${snapshot.pair}
Current Price: $${snapshot.currentPrice.toFixed(2)}
24h Change: ${snapshot.priceChange24h >= 0 ? '+' : ''}${snapshot.priceChange24h.toFixed(2)}%
Market Regime: ${snapshot.marketRegime}

TECHNICAL INDICATORS:
- RSI: ${snapshot.rsiValue.toFixed(1)}
- MACD Signal: ${snapshot.macdSignal}
- Trend Strength: ${snapshot.trendStrength.toFixed(1)}%
- Volume Indicator: ${snapshot.volumeIndicator.toFixed(1)}
- Volatility (ATR): ${snapshot.volatility.toFixed(2)}

SIGNAL ANALYSIS:
UP Signals (Score: ${snapshot.upScore.toFixed(1)}):
${snapshot.upSignals.map(s => `  • ${s.category}: ${s.reason} (${s.strength.toFixed(0)})`).join('\n')}

DOWN Signals (Score: ${snapshot.downScore.toFixed(1)}):
${snapshot.downSignals.map(s => `  • ${s.category}: ${s.reason} (${s.strength.toFixed(0)})`).join('\n')}

Based on this technical analysis, provide your trading decision.`;

  const schema = {
    type: "object",
    properties: {
      direction: { 
        type: "string",
        enum: ["UP", "DOWN", "NEUTRAL"]
      },
      confidence: { 
        type: "number",
        minimum: 90,
        maximum: 98
      },
      rationale: { type: "string" },
      riskFactors: { 
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 4
      },
      keyFactors: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 6
      }
    },
    required: ["direction", "confidence", "rationale", "riskFactors", "keyFactors"]
  };

  try {
    console.log('\n🤖 Calling Gemini 2.5 Pro with THINKING mode (streaming)...');
    const decision = await callGeminiModelStreaming("gemini-2.5-pro", systemPrompt, analysisText, schema, true, ws);
    
    if (decision) {
      console.log(`✅ Gemini 2.5 Pro Decision: ${decision.direction} | ${decision.confidence}%`);
      console.log(`   Rationale: ${decision.rationale}`);
      if (decision.thinkingProcess) {
        console.log(`   🧠 Thinking captured (${decision.thinkingProcess.length} chars)`);
      }
      return decision;
    }
  } catch (error: any) {
    console.warn(`⚠️  Gemini 2.5 Pro failed: ${error.message}`);
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
    } catch (fallbackError: any) {
      console.error(`❌ Both Gemini models failed: ${fallbackError.message}`);
      return null;
    }
  }

  return null;
}
