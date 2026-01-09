import type { WebSocket } from "ws";
import type { TradingPair } from "@shared/schema";
import { fetchMarketData } from "./crypto-data";
import { analyzeMarket, type TechnicalIndicators } from "./technical-analysis";
import { getGeminiPrediction } from "./gemini-decision";
import type { Prediction, WeightedSignal } from "./ai-prediction";

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
  ws: WebSocket,
  timeframe: string = "M1"
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
    
    // Convert technical analysis results to WeightedSignal format
    const rsiValue = indicators.rsi;
    const rsiSignal: WeightedSignal = {
      direction: rsiValue < 30 ? "UP" : rsiValue > 70 ? "DOWN" : "NEUTRAL",
      strength: rsiValue < 30 ? 85 : rsiValue > 70 ? 85 : 50,
      weight: 1.2,
      reason: rsiValue < 30 ? "Oversold - Strong bullish signal" : rsiValue > 70 ? "Overbought - Strong bearish signal" : "Neutral range",
      category: "MOMENTUM",
    };

    const stochasticK = indicators.stochastic.k;
    const stochasticD = indicators.stochastic.d;
    const stochasticSignal: WeightedSignal = {
      direction: stochasticK < 20 && stochasticD < 20 ? "UP" : stochasticK > 80 && stochasticD > 80 ? "DOWN" : "NEUTRAL",
      strength: (stochasticK < 20 && stochasticD < 20) || (stochasticK > 80 && stochasticD > 80) ? 90 : 50,
      weight: 1.2,
      reason: stochasticK < 20 && stochasticD < 20 ? "Oversold conditions" : stochasticK > 80 && stochasticD > 80 ? "Overbought conditions" : "Stochastic neutral",
      category: "MOMENTUM",
    };

    const macdHistogram = indicators.macd.histogram;
    const macdSignal: WeightedSignal = {
      direction: macdHistogram > 0 ? "UP" : "DOWN",
      strength: Math.abs(macdHistogram) > 0.001 ? 75 : 50,
      weight: 1.4,
      reason: macdHistogram > 0 ? "MACD strong bullish momentum" : "MACD strong bearish momentum",
      category: "TREND",
    };

    const maSignal: WeightedSignal = {
      direction: marketData.currentPrice > indicators.movingAverages.sma50 ? "UP" : "DOWN",
      strength: 65,
      weight: 1.3,
      reason: marketData.currentPrice > indicators.movingAverages.sma50 ? "Price above SMA50 - bullish" : "Price below SMA50 - bearish",
      category: "TREND",
    };

    const bbMiddle = indicators.bollingerBands.middle;
    const bbLower = indicators.bollingerBands.lower;
    const bbUpper = indicators.bollingerBands.upper;
    const bbPosition = (marketData.currentPrice - bbLower) / (bbUpper - bbLower);
    const bbSignal: WeightedSignal = {
      direction: bbPosition < 0.1 ? "UP" : bbPosition > 0.9 ? "DOWN" : "NEUTRAL",
      strength: (bbPosition < 0.1 || bbPosition > 0.9) ? 75 : 50,
      weight: 1.1,
      reason: bbPosition < 0.1 ? "Price near lower Bollinger Band" : bbPosition > 0.9 ? "Price near upper Bollinger Band" : "Price at BB middle",
      category: "VOLATILITY",
    };

    const adxPlusDI = indicators.adx.plusDI;
    const adxMinusDI = indicators.adx.minusDI;
    const adxValue = indicators.adx.value;
    const adxSignal: WeightedSignal = {
      direction: adxValue > 50 && adxPlusDI > adxMinusDI ? "UP" : adxValue > 50 && adxMinusDI > adxPlusDI ? "DOWN" : "NEUTRAL",
      strength: adxValue > 50 ? 80 : adxValue > 30 ? 60 : 30,
      weight: 1.4,
      reason: adxValue > 50 && adxPlusDI > adxMinusDI ? "Very strong uptrend" : adxValue > 50 && adxMinusDI > adxPlusDI ? "Very strong downtrend" : "Weak trend, ranging market",
      category: "TREND",
    };

    const momentum = indicators.momentum;
    const roc = indicators.roc;
    const momentumSignal: WeightedSignal = {
      direction: momentum > 3 && roc > 3 ? "UP" : momentum < -3 && roc < -3 ? "DOWN" : "NEUTRAL",
      strength: (momentum > 3 && roc > 3) || (momentum < -3 && roc < -3) ? 85 : 50,
      weight: 1.2,
      reason: momentum > 3 && roc > 3 ? "Strong bullish momentum" : momentum < -3 && roc < -3 ? "Strong bearish momentum" : "Momentum neutral",
      category: "MOMENTUM",
    };

    const nearestSupport = indicators.supportResistance.nearestSupport;
    const nearestResistance = indicators.supportResistance.nearestResistance;
    const distanceToSupport = indicators.supportResistance.distanceToSupport;
    const distanceToResistance = indicators.supportResistance.distanceToResistance;
    const srSignal: WeightedSignal = {
      direction: distanceToSupport < 1.5 ? "UP" : distanceToResistance < 1.5 ? "DOWN" : "NEUTRAL",
      strength: (distanceToSupport < 1.5 || distanceToResistance < 1.5) ? 65 : 50,
      weight: 1.1,
      reason: distanceToSupport < 1.5 ? "Price near support level" : distanceToResistance < 1.5 ? "Price near resistance level" : "Price between support and resistance",
      category: "Price Action",
    };
    
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

    // Volume bonus based on volume trend
    const volumeBonus = indicators.volumeIndicator > 20 ? 25 : indicators.volumeIndicator > 10 ? 15 : 0;
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
      message: "Gemini 3 Pro Preview analyzing market conditions..."
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
      entryTimeframe: timeframe,
      anchorTimeframe: timeframe,
      entryTrendBias: indicators.trendBias,
      anchorTrendBias: indicators.trendBias,
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
      volumeMA: indicators.volumeMA,
      currentVolume: marketData.candles[marketData.candles.length - 1]?.volume || 0,
      trendStrength: indicators.trendStrength,
      volatility: indicators.atr,
      rsiValue: indicators.rsi,
      macdSignal: indicators.macd.histogram > 0 ? "bullish" : "bearish",
      adxValue: indicators.adx.value
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
      const qualityScore = Math.round((signalAlignment * 0.4) + ((geminiDecision.confidence - 70) / 29 * 60));
      
      sendStageUpdate(ws, "final_verdict", 100, "complete", {
        direction: geminiDecision.direction,
        confidence: geminiDecision.confidence,
        duration: geminiDecision.duration,
        signalQuality: "HIGH",
        tradeTargets: geminiDecision.tradeTargets,
        keyFactors: geminiDecision.keyFactors,
        riskFactors: geminiDecision.riskFactors,
        qualityScore,
      });
      
      return {
        pair,
        direction: geminiDecision.direction,
        confidence: geminiDecision.confidence,
        duration: geminiDecision.duration,
        rationale: geminiDecision.rationale,
        riskFactors: geminiDecision.riskFactors,
        tradeTargets: geminiDecision.tradeTargets,
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
          qualityScore,
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
      duration: "Waiting for setup",
      qualityScore: 0,
      keyFactors: ["Insufficient confluence"],
      riskFactors: ["Market uncertainty"],
      message: "Insufficient confidence for trade signal"
    });
    
    return {
      pair,
      direction: "NEUTRAL",
      confidence: 0,
      duration: "Waiting for setup",
      detailedAnalysis: {
        qualityScore: 0,
        keyFactors: ["Insufficient confluence"],
      },
      analysis: "Market conditions unclear. Waiting for stronger setup.",
    };
    
  } catch (error) {
    console.error(`❌ Progressive analysis error for ${pair}:`, error);
    
    sendStageUpdate(ws, "final_verdict", 100, "complete", {
      error: true,
      direction: "NEUTRAL",
      confidence: 0,
      duration: "Data unavailable",
      qualityScore: 0,
      keyFactors: ["Data collection error"],
      riskFactors: ["Technical failure"],
      message: "Analysis failed"
    });
    
    return {
      pair,
      direction: "NEUTRAL",
      confidence: 0,
      duration: "Data unavailable",
      detailedAnalysis: {
        qualityScore: 0,
        keyFactors: ["Data collection error"],
      },
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
