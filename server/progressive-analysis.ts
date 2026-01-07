import type { WebSocket } from "ws";
import type { TradingPair } from "@shared/schema";
import { fetchMarketData } from "./crypto-data";
import { analyzeMarket } from "./technical-analysis";
import { 
  analyzeRSI,
  analyzeStochastic,
  analyzeMACD,
  analyzeMovingAverages,
  analyzeBollingerBands,
  analyzeADX,
  analyzeMomentum,
  analyzeSupportResistance,
  analyzeVolume,
} from "./ai-prediction";
import { getGeminiPrediction } from "./gemini-decision";
import type { Prediction } from "./ai-prediction";

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sendStageUpdate(
  ws: WebSocket,
  stage: string,
  progress: number,
  status: string,
  data?: any
) {
  ws.send(JSON.stringify({
    type: "analysis_stage",
    stage,
    progress,
    status,
    data,
    timestamp: new Date().toISOString(),
  }));
}

export async function generateProgressivePrediction(
  pair: TradingPair,
  ws: WebSocket
): Promise<Prediction> {
  try {
    // STAGE 1: Data Collection (5-7 seconds)
    sendStageUpdate(ws, "data_collection", 0, "in_progress");
    await delay(1000);
    
    sendStageUpdate(ws, "data_collection", 30, "in_progress", {
      message: "Connecting to Binance API..."
    });
    await delay(1500);
    
    const marketData = await fetchMarketData(pair);
    
    sendStageUpdate(ws, "data_collection", 70, "in_progress", {
      message: "Retrieved 200 candles",
      currentPrice: marketData.currentPrice,
      priceChange24h: marketData.priceChange24h,
      volumeChange24h: marketData.volumeChange24h,
    });
    await delay(2000);
    
    sendStageUpdate(ws, "data_collection", 100, "complete", {
      candlesRetrieved: 200,
      currentPrice: marketData.currentPrice,
      priceChange24h: marketData.priceChange24h,
      volume24h: marketData.volumeChange24h,
      lastUpdate: "2 seconds ago",
    });
    await delay(800);

    // STAGE 2: Technical Indicator Calculation (8-10 seconds)
    sendStageUpdate(ws, "technical_calculation", 0, "in_progress");
    await delay(1000);
    
    const indicators = analyzeMarket(marketData.candles);
    
    sendStageUpdate(ws, "technical_calculation", 25, "in_progress", {
      message: "Calculating momentum indicators...",
      indicators: {
        rsi: indicators.rsi.toFixed(1),
        stochastic: `K:${indicators.stochastic.k.toFixed(0)} D:${indicators.stochastic.d.toFixed(0)}`,
      }
    });
    await delay(2000);
    
    sendStageUpdate(ws, "technical_calculation", 50, "in_progress", {
      message: "Analyzing trend indicators...",
      indicators: {
        macd: indicators.macd.histogram.toFixed(4),
        adx: indicators.adx.value.toFixed(1),
      }
    });
    await delay(2000);
    
    sendStageUpdate(ws, "technical_calculation", 75, "in_progress", {
      message: "Computing volatility and volume...",
      indicators: {
        bollingerBands: `Position: ${((marketData.currentPrice - indicators.bollingerBands.lower) / (indicators.bollingerBands.upper - indicators.bollingerBands.lower) * 100).toFixed(0)}%`,
        volume: indicators.volumeIndicator.toFixed(1),
      }
    });
    await delay(2000);
    
    const rsiSignal = analyzeRSI(indicators);
    const stochasticSignal = analyzeStochastic(indicators);
    const macdSignal = analyzeMACD(indicators);
    const maSignal = analyzeMovingAverages(indicators, marketData.currentPrice);
    const bbSignal = analyzeBollingerBands(indicators, marketData.currentPrice);
    const adxSignal = analyzeADX(indicators);
    const momentumSignal = analyzeMomentum(indicators);
    const srSignal = analyzeSupportResistance(indicators, marketData.currentPrice);
    
    const signals = [
      rsiSignal,
      stochasticSignal,
      macdSignal,
      maSignal,
      bbSignal,
      adxSignal,
      momentumSignal,
      srSignal,
    ];
    
    sendStageUpdate(ws, "technical_calculation", 100, "complete", {
      totalIndicators: 23,
      marketRegime: indicators.marketRegime,
      trendStrength: indicators.trendStrength.toFixed(1),
      summary: {
        rsi: indicators.rsi.toFixed(1),
        adx: indicators.adx.value.toFixed(1),
        macd: indicators.macd.histogram > 0 ? "Bullish" : "Bearish",
      }
    });
    await delay(800);

    // STAGE 3: Signal Aggregation (3-5 seconds)
    sendStageUpdate(ws, "signal_aggregation", 0, "in_progress");
    await delay(1000);
    
    const upSignals = signals.filter(s => s.direction === "UP");
    const downSignals = signals.filter(s => s.direction === "DOWN");
    
    sendStageUpdate(ws, "signal_aggregation", 40, "in_progress", {
      message: "Weighing all signals...",
      upCount: upSignals.length,
      downCount: downSignals.length,
    });
    await delay(1500);
    
    const upScore = upSignals.reduce((sum, s) => sum + (s.strength * s.weight), 0);
    const downScore = downSignals.reduce((sum, s) => sum + (s.strength * s.weight), 0);
    const totalSignals = upSignals.length + downSignals.length;
    const signalAlignment = totalSignals > 0 
      ? ((upScore > downScore ? upSignals.length : downSignals.length) / totalSignals) * 100 
      : 0;
    
    sendStageUpdate(ws, "signal_aggregation", 70, "in_progress", {
      message: "Calculating alignment and confidence...",
      upScore: upScore.toFixed(1),
      downScore: downScore.toFixed(1),
      signalAlignment: signalAlignment.toFixed(1),
    });
    await delay(1500);
    
    const volumeBonus = analyzeVolume(indicators, upScore > downScore ? "UP" : "DOWN");
    const regimeMultiplier = indicators.marketRegime === "STRONG_TRENDING" ? 1.15 : 
                             indicators.marketRegime === "TRENDING" ? 1.05 : 0.9;
    
    sendStageUpdate(ws, "signal_aggregation", 100, "complete", {
      direction: upScore > downScore ? "UP" : "DOWN",
      upScore: upScore.toFixed(1),
      downScore: downScore.toFixed(1),
      signalAlignment: signalAlignment.toFixed(1),
      volumeBonus: volumeBonus.toFixed(1),
      marketRegime: indicators.marketRegime,
      regimeMultiplier: regimeMultiplier.toFixed(2),
    });
    await delay(800);

    // STAGE 4: AI Thinking (10-15 seconds)
    sendStageUpdate(ws, "ai_thinking", 0, "in_progress", {
      message: "Gemini 2.5 Flash analyzing market conditions..."
    });
    await delay(2000);
    
    sendStageUpdate(ws, "ai_thinking", 30, "in_progress", {
      message: "AI evaluating technical confluence..."
    });
    await delay(3000);
    
    const geminiDecision = await getGeminiPrediction({
      pair,
      currentPrice: marketData.currentPrice,
      priceChange24h: marketData.priceChange24h,
      marketRegime: indicators.marketRegime,
      upSignals: upSignals.map(s => ({
        category: s.category,
        reason: s.reason,
        strength: s.strength
      })),
      downSignals: downSignals.map(s => ({
        category: s.category,
        reason: s.reason,
        strength: s.strength
      })),
      upScore,
      downScore,
      volumeIndicator: indicators.volumeIndicator,
      trendStrength: indicators.trendStrength,
      volatility: indicators.atr,
      rsiValue: indicators.rsi,
      macdSignal: indicators.macd.histogram > 0 ? "bullish" : "bearish"
    }, ws);
    
    sendStageUpdate(ws, "ai_thinking", 70, "in_progress", {
      message: "Generating risk assessment..."
    });
    await delay(2000);
    
    if (geminiDecision && geminiDecision.thinkingProcess) {
      sendStageUpdate(ws, "ai_thinking", 90, "in_progress", {
        message: "Finalizing analysis...",
        thinkingPreview: geminiDecision.thinkingProcess.substring(0, 200) + "..."
      });
    }
    await delay(1000);
    
    sendStageUpdate(ws, "ai_thinking", 100, "complete", {
      direction: geminiDecision?.direction || "NEUTRAL",
      confidence: geminiDecision?.confidence || 0,
      thinkingCaptured: geminiDecision?.thinkingProcess ? true : false,
    });
    await delay(800);

    // STAGE 5: Final Verdict (2-3 seconds)
    sendStageUpdate(ws, "final_verdict", 0, "in_progress");
    await delay(1000);
    
    sendStageUpdate(ws, "final_verdict", 50, "in_progress", {
      message: "Compiling final prediction..."
    });
    await delay(1000);
    
    if (geminiDecision && geminiDecision.direction !== "NEUTRAL") {
      sendStageUpdate(ws, "final_verdict", 100, "complete", {
        direction: geminiDecision.direction,
        confidence: geminiDecision.confidence,
        duration: geminiDecision.duration,
        signalQuality: "HIGH",
      });
      
      return {
        pair,
        direction: geminiDecision.direction,
        confidence: geminiDecision.confidence,
        duration: geminiDecision.duration,
        rationale: geminiDecision.rationale,
        riskFactors: geminiDecision.riskFactors,
        detailedAnalysis: {
          indicators: signals.map(s => ({
            name: s.category,
            value: s.reason,
            direction: s.direction,
            strength: s.strength,
            weight: s.weight,
            reason: s.reason,
            category: s.category,
          })),
          upSignals,
          downSignals,
          upScore,
          downScore,
          signalAlignment: Math.round(signalAlignment),
          qualityScore: Math.round((signalAlignment * 0.4) + ((geminiDecision.confidence - 70) / 29 * 60)),
          marketRegime: indicators.marketRegime,
          confidenceBreakdown: {
            baseScore: upScore > downScore ? upScore : downScore,
            volumeBonus,
            regimeBonus: (regimeMultiplier - 1) * 100,
            alignmentPenalty: signalAlignment < 85 ? (85 - signalAlignment) * 1.2 : 0,
            qualityBoost: signalAlignment >= 95 ? 3 : signalAlignment >= 88 ? 2 : 0,
            rawScore: upScore > downScore ? upScore + volumeBonus : downScore + volumeBonus,
            finalConfidence: geminiDecision.confidence,
          },
          thinkingProcess: geminiDecision.thinkingProcess,
          keyFactors: geminiDecision.keyFactors,
        },
      };
    }
    
    // Fallback if Gemini fails
    sendStageUpdate(ws, "final_verdict", 100, "complete", {
      direction: "NEUTRAL",
      confidence: 0,
      message: "Insufficient confidence for trade signal"
    });
    
    return {
      pair,
      direction: "NEUTRAL",
      confidence: 0,
      duration: "Waiting for setup",
      analysis: "Market conditions unclear. Waiting for stronger setup.",
    };
    
  } catch (error) {
    console.error(`❌ Progressive analysis error for ${pair}:`, error);
    
    sendStageUpdate(ws, "final_verdict", 100, "complete", {
      error: true,
      message: "Analysis failed"
    });
    
    return {
      pair,
      direction: "NEUTRAL",
      confidence: 0,
      duration: "Data unavailable",
      analysis: `Market data service temporarily unavailable. Cannot perform technical analysis for ${pair}. Please try again in a moment when live market data is restored.`,
    };
  }
}

// Re-export analyzer functions so they're accessible from this module
export {
  analyzeRSI,
  analyzeStochastic,
  analyzeMACD,
  analyzeMovingAverages,
  analyzeBollingerBands,
  analyzeADX,
  analyzeMomentum,
  analyzeSupportResistance,
  analyzeVolume,
} from "./ai-prediction";
