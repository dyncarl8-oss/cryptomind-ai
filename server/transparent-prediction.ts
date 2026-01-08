import { WebSocket } from "ws";
import { type TradeTargets, type TradingPair } from "@shared/schema";
import { fetchMarketData } from "./crypto-data";
import { analyzeMarket, type TechnicalIndicators } from "./technical-analysis";
import { getGeminiPrediction } from "./gemini-decision";
import type { Prediction } from "./ai-prediction";

interface StageUpdateMessage {
  type: "analysis_stage";
  stage: "data_collection" | "technical_calculation" | "signal_aggregation" | "ai_thinking" | "final_verdict";
  progress: number;
  status: "pending" | "in_progress" | "complete";
  duration?: number;
  data?: any;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sendStageUpdate(ws: WebSocket, update: StageUpdateMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(update));
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function computeFallbackTradeTargets(
  direction: "UP" | "DOWN",
  currentPrice: number,
  atr: number
): TradeTargets {
  const safeAtr = Math.max(Math.abs(atr), Math.abs(currentPrice) * 0.002);
  const entryBand = safeAtr * 0.25;

  if (direction === "UP") {
    const entryLow = currentPrice - entryBand;
    const entryHigh = currentPrice + entryBand * 0.5;

    return {
      entry: { low: Math.min(entryLow, entryHigh), high: Math.max(entryLow, entryHigh) },
      target: {
        low: currentPrice + safeAtr * 1.5,
        high: currentPrice + safeAtr * 2.4,
      },
      stop: entryLow - safeAtr * 1.05,
    };
  }

  const entryLow = currentPrice - entryBand * 0.5;
  const entryHigh = currentPrice + entryBand;

  return {
    entry: { low: Math.min(entryLow, entryHigh), high: Math.max(entryLow, entryHigh) },
    target: {
      low: currentPrice - safeAtr * 2.4,
      high: currentPrice - safeAtr * 1.5,
    },
    stop: entryHigh + safeAtr * 1.05,
  };
}

function normalizeTradeTargets(
  maybeTargets: unknown,
  direction: "UP" | "DOWN",
  currentPrice: number,
  atr: number
): TradeTargets | null {
  if (!maybeTargets || typeof maybeTargets !== "object") return null;
  const t = maybeTargets as any;

  if (
    !t.entry ||
    !t.target ||
    !isFiniteNumber(t.stop) ||
    !isFiniteNumber(t.entry.low) ||
    !isFiniteNumber(t.entry.high) ||
    !isFiniteNumber(t.target.low) ||
    !isFiniteNumber(t.target.high)
  ) {
    return null;
  }

  const entryLow = Math.min(t.entry.low, t.entry.high);
  const entryHigh = Math.max(t.entry.low, t.entry.high);
  const targetLow = Math.min(t.target.low, t.target.high);
  const targetHigh = Math.max(t.target.low, t.target.high);

  const fallback = computeFallbackTradeTargets(direction, currentPrice, atr);

  let stop = t.stop;

  if (direction === "UP") {
    if (!(stop < entryLow)) {
      stop = fallback.stop;
    }
    if (!(targetHigh > entryHigh)) {
      return fallback;
    }
  } else {
    if (!(stop > entryHigh)) {
      stop = fallback.stop;
    }
    if (!(targetLow < entryLow)) {
      return fallback;
    }
  }

  return {
    entry: { low: entryLow, high: entryHigh },
    target: { low: targetLow, high: targetHigh },
    stop,
  };
}

export async function generateTransparentPrediction(
  pair: TradingPair,
  ws: WebSocket,
  waitForAiThinkingComplete?: () => Promise<void>,
  timeframe: string = "M1"
): Promise<Prediction> {
  const overallStartTime = Date.now();

  sendStageUpdate(ws, {
    type: "analysis_stage",
    stage: "data_collection",
    progress: 0,
    status: "in_progress",
  });
  
  await delay(500);
  
  sendStageUpdate(ws, {
    type: "analysis_stage",
    stage: "data_collection",
    progress: 30,
    status: "in_progress",
  });

  const dataStartTime = Date.now();
  const marketData = await fetchMarketData(pair, timeframe);
  const dataDuration = Date.now() - dataStartTime;
  
  await delay(1000);
  
  sendStageUpdate(ws, {
    type: "analysis_stage",
    stage: "data_collection",
    progress: 100,
    status: "complete",
    duration: dataDuration,
    data: {
      currentPrice: marketData.currentPrice,
      priceChange24h: marketData.priceChange24h,
      volume24h: 0,
      volumeChange24h: marketData.volumeChange24h,
      candlesRetrieved: marketData.candles.length,
      lastUpdate: new Date().toISOString(),
    },
  });

  await delay(800);

  sendStageUpdate(ws, {
    type: "analysis_stage",
    stage: "technical_calculation",
    progress: 0,
    status: "in_progress",
  });

  const technicalStartTime = Date.now();
  const indicators = analyzeMarket(marketData.candles);
  
  await delay(2000);
  
  sendStageUpdate(ws, {
    type: "analysis_stage",
    stage: "technical_calculation",
    progress: 50,
    status: "in_progress",
  });

  await delay(2000);

  const technicalIndicatorsList = [
    {
      name: "RSI",
      value: indicators.rsi.toFixed(1),
      signal: indicators.rsi < 30 ? "UP" : indicators.rsi > 70 ? "DOWN" : "NEUTRAL",
      strength: indicators.rsi < 30 ? 85 : indicators.rsi > 70 ? 85 : 50,
      category: "MOMENTUM" as const,
      description: indicators.rsi < 30 ? "Oversold - Strong bullish signal" : indicators.rsi > 70 ? "Overbought - Strong bearish signal" : "Neutral range",
    },
    {
      name: "Stochastic K/D",
      value: `${indicators.stochastic.k.toFixed(0)}/${indicators.stochastic.d.toFixed(0)}`,
      signal: indicators.stochastic.k < 20 ? "UP" : indicators.stochastic.k > 80 ? "DOWN" : "NEUTRAL",
      strength: indicators.stochastic.k < 20 ? 90 : indicators.stochastic.k > 80 ? 90 : 50,
      category: "MOMENTUM" as const,
      description: indicators.stochastic.k < 20 ? "Oversold conditions" : indicators.stochastic.k > 80 ? "Overbought conditions" : "Neutral momentum",
    },
    {
      name: "MACD",
      value: indicators.macd.histogram.toFixed(4),
      signal: indicators.macd.histogram > 0 ? "UP" : "DOWN",
      strength: Math.abs(indicators.macd.histogram) > 0.001 ? 75 : 50,
      category: "TREND" as const,
      description: indicators.macd.histogram > 0 ? "Bullish crossover detected" : "Bearish trend",
    },
    {
      name: "ADX",
      value: indicators.adx.value.toFixed(1),
      signal: indicators.adx.plusDI > indicators.adx.minusDI ? "UP" : "DOWN",
      strength: indicators.adx.value > 40 ? 85 : indicators.adx.value > 25 ? 70 : 50,
      category: "TREND" as const,
      description: indicators.adx.value > 40 ? "STRONG TREND confirmed" : indicators.adx.value > 25 ? "Trending market" : "Weak trend",
    },
    {
      name: "SMA 20/50/200",
      value: `${indicators.movingAverages.sma20.toFixed(2)}`,
      signal: marketData.currentPrice > indicators.movingAverages.sma50 ? "UP" : "DOWN",
      strength: 67,
      category: "TREND" as const,
      description: marketData.currentPrice > indicators.movingAverages.sma50 ? "Price above SMA50 - bullish" : "Price below SMA50 - bearish",
    },
    {
      name: "Bollinger Bands",
      value: `Width: ${indicators.bollingerBands.bandwidth.toFixed(2)}%`,
      signal: marketData.currentPrice < indicators.bollingerBands.lower ? "UP" : marketData.currentPrice > indicators.bollingerBands.upper ? "DOWN" : "NEUTRAL",
      strength: marketData.currentPrice < indicators.bollingerBands.lower ? 75 : marketData.currentPrice > indicators.bollingerBands.upper ? 75 : 50,
      category: "VOLATILITY" as const,
      description: marketData.currentPrice < indicators.bollingerBands.lower ? "At lower band - potential bounce" : marketData.currentPrice > indicators.bollingerBands.upper ? "At upper band - potential reversal" : "Mid-range",
    },
    {
      name: "Volume Trend",
      value: `${marketData.volumeChange24h > 0 ? "+" : ""}${marketData.volumeChange24h.toFixed(1)}%`,
      signal: marketData.volumeChange24h > 10 ? "UP" : "NEUTRAL",
      strength: Math.abs(marketData.volumeChange24h) > 15 ? 80 : 60,
      category: "VOLUME" as const,
      description: marketData.volumeChange24h > 10 ? "Strong volume confirmation" : "Normal volume",
    },
    {
      name: "Momentum",
      value: indicators.momentum.toFixed(2),
      signal: indicators.momentum > 0 ? "UP" : "DOWN",
      strength: Math.abs(indicators.momentum) > 2 ? 70 : 50,
      category: "MOMENTUM" as const,
      description: indicators.momentum > 2 ? "Building upward pressure" : indicators.momentum < -2 ? "Downward pressure" : "Neutral momentum",
    },
    {
      name: "ROC",
      value: `${indicators.roc.toFixed(2)}%`,
      signal: indicators.roc > 0 ? "UP" : "DOWN",
      strength: Math.abs(indicators.roc) > 1.5 ? 70 : 50,
      category: "MOMENTUM" as const,
      description: indicators.roc > 1.5 ? "Confirming upward momentum" : indicators.roc < -1.5 ? "Confirming downward momentum" : "Neutral",
    },
  ];

  const technicalDuration = Date.now() - technicalStartTime;
  
  sendStageUpdate(ws, {
    type: "analysis_stage",
    stage: "technical_calculation",
    progress: 100,
    status: "complete",
    duration: technicalDuration,
    data: {
      indicators: technicalIndicatorsList,
    },
  });

  await delay(500);

  sendStageUpdate(ws, {
    type: "analysis_stage",
    stage: "signal_aggregation",
    progress: 0,
    status: "in_progress",
  });

  const aggregationStartTime = Date.now();
  
  await delay(1500);

  const upSignals = technicalIndicatorsList.filter(i => i.signal === "UP");
  const downSignals = technicalIndicatorsList.filter(i => i.signal === "DOWN");
  const neutralSignals = technicalIndicatorsList.filter(i => i.signal === "NEUTRAL");

  const upScore = upSignals.reduce((sum, s) => sum + s.strength, 0);
  const downScore = downSignals.reduce((sum, s) => sum + s.strength, 0);
  
  const totalSignals = technicalIndicatorsList.length;
  const signalAlignment = (Math.max(upSignals.length, downSignals.length) / totalSignals) * 100;

  sendStageUpdate(ws, {
    type: "analysis_stage",
    stage: "signal_aggregation",
    progress: 50,
    status: "in_progress",
  });

  await delay(1500);

  const aggregationDuration = Date.now() - aggregationStartTime;
  
  sendStageUpdate(ws, {
    type: "analysis_stage",
    stage: "signal_aggregation",
    progress: 100,
    status: "complete",
    duration: aggregationDuration,
    data: {
      upSignalsCount: upSignals.length,
      downSignalsCount: downSignals.length,
      neutralSignalsCount: neutralSignals.length,
      upScore,
      downScore,
      signalAlignment,
      marketRegime: indicators.marketRegime,
    },
  });

  await delay(500);

  const aiStartTime = Date.now();

  sendStageUpdate(ws, {
    type: "analysis_stage",
    stage: "ai_thinking",
    progress: 0,
    status: "in_progress",
    data: {
      thinkingProcess: "",
      analysisTime: 0,
      modelUsed: "Gemini 3 Pro (Thinking Mode)",
    },
  });

  const technicalSnapshot = {
    pair,
    currentPrice: marketData.currentPrice,
    priceChange24h: marketData.priceChange24h,
    marketRegime: indicators.marketRegime,
    upSignals: upSignals.map(s => ({ category: s.category, reason: s.description, strength: s.strength })),
    downSignals: downSignals.map(s => ({ category: s.category, reason: s.description, strength: s.strength })),
    upScore,
    downScore,
    volumeIndicator: marketData.volumeChange24h,
    trendStrength: indicators.trendStrength,
    volatility: indicators.atr,
    rsiValue: indicators.rsi,
    macdSignal: indicators.macd.histogram > 0 ? "bullish" : "bearish",
  };

  await delay(2000);

  sendStageUpdate(ws, {
    type: "analysis_stage",
    stage: "ai_thinking",
    progress: 50,
    status: "in_progress",
    data: {
      thinkingProcess: "",
      analysisTime: Date.now() - aiStartTime,
      modelUsed: "Gemini 3 Pro (Thinking Mode)",
    },
  });

  let geminiDecision: any = null;
  try {
    geminiDecision = await getGeminiPrediction(technicalSnapshot, ws);
  } catch (error) {
    console.error("❌ Gemini prediction failed:", error);
    geminiDecision = null;
  }
  
  await delay(1000);

  sendStageUpdate(ws, {
    type: "analysis_stage",
    stage: "ai_thinking",
    progress: 100,
    status: "in_progress",
    data: {
      thinkingProcess: geminiDecision?.thinkingProcess || "AI deep analysis complete. Evaluating all technical indicators and market conditions to generate high-confidence prediction.",
      analysisTime: Date.now() - aiStartTime,
      modelUsed: "Gemini 3 Pro (Thinking Mode)",
    },
  });

  // Give frontend time to receive the full text and start typewriter animation
  await delay(500);

  if (waitForAiThinkingComplete) {
    // Wait for frontend acknowledgment with a timeout to prevent hanging forever
    // Increased timeout to 30s to allow for long typewriter animations on the frontend
    const ACKNOWLEDGMENT_TIMEOUT = 30000; 
    console.log(`⏳ Waiting for AI thinking complete acknowledgment (max ${ACKNOWLEDGMENT_TIMEOUT}ms)...`);
    const waitStartTime = Date.now();
    await Promise.race([
      waitForAiThinkingComplete().then(() => {
        console.log(`✅ AI thinking acknowledgment received in ${Date.now() - waitStartTime}ms`);
      }),
      delay(ACKNOWLEDGMENT_TIMEOUT).then(() => {
        console.log(`⏱️ AI thinking acknowledgment timed out after ${ACKNOWLEDGMENT_TIMEOUT}ms, continuing...`);
      })
    ]);
  } else {
    await delay(3000);
  }

  const aiDuration = Date.now() - aiStartTime;

  sendStageUpdate(ws, {
    type: "analysis_stage",
    stage: "ai_thinking",
    progress: 100,
    status: "complete",
    duration: aiDuration,
    data: {
      thinkingProcess: geminiDecision?.thinkingProcess || "AI deep analysis complete. Evaluating all technical indicators and market conditions to generate high-confidence prediction.",
      analysisTime: aiDuration,
      modelUsed: "Gemini 3 Pro (Thinking Mode)",
    },
  });

  await delay(2500);

  // Check if WebSocket is still open before continuing
  if (ws.readyState !== WebSocket.OPEN) {
    console.warn("⚠️ WebSocket closed during analysis, aborting final verdict stage");
    throw new Error("WebSocket connection closed");
  }

  sendStageUpdate(ws, {
    type: "analysis_stage",
    stage: "final_verdict",
    progress: 0,
    status: "in_progress",
  });

  await delay(1000);

  const getDurationBasedOnTimeframe = (tf: string): string => {
    const durations: Record<string, string> = {
      "M1": "1-2 minutes",
      "M3": "3-5 minutes",
      "M5": "5-8 minutes",
      "M15": "15-20 minutes",
      "M30": "30-45 minutes",
      "M45": "45-60 minutes",
      "H1": "1-2 hours",
      "H2": "2-4 hours",
      "H3": "3-5 hours",
      "H4": "4-6 hours",
      "D1": "1-2 days",
      "W1": "1-2 weeks",
    };
    return durations[tf] || "1-2 minutes";
  };

  const direction = geminiDecision?.direction || (upScore > downScore ? "UP" : "DOWN") as "UP" | "DOWN" | "NEUTRAL";
  const confidence = geminiDecision?.confidence || Math.round(Math.min(95, (signalAlignment * 0.8) + (indicators.trendStrength * 0.2)));
  const duration = getDurationBasedOnTimeframe(timeframe);
  const qualityScore = Math.round((signalAlignment + indicators.trendStrength) / 2);

  const keyFactors = geminiDecision?.keyFactors || [
    `${upSignals.length}/${totalSignals} indicators bullish (${signalAlignment.toFixed(1)}% alignment)`,
    `${indicators.marketRegime} market (ADX: ${indicators.adx.value.toFixed(1)})`,
    `Volume ${marketData.volumeChange24h > 0 ? "+" : ""}${marketData.volumeChange24h.toFixed(1)}% - ${Math.abs(marketData.volumeChange24h) > 15 ? "Strong" : "Normal"} confirmation`,
  ];

  const riskFactors = geminiDecision?.riskFactors || [
    marketData.volumeChange24h < 0 ? "Volume declining - weaker conviction" : "Monitor for volume decrease",
    indicators.atr > 3 ? "High volatility - wider stops recommended" : "Normal volatility range",
  ];

  const tradeTargets: TradeTargets | undefined =
    direction === "NEUTRAL"
      ? undefined
      : normalizeTradeTargets(
            geminiDecision?.tradeTargets,
            direction,
            marketData.currentPrice,
            indicators.atr
          ) ??
          computeFallbackTradeTargets(
            direction,
            marketData.currentPrice,
            indicators.atr
          );

  await delay(1500);

  const finalDuration = Date.now() - overallStartTime;

  sendStageUpdate(ws, {
    type: "analysis_stage",
    stage: "final_verdict",
    progress: 100,
    status: "complete",
    duration: finalDuration - aiDuration - aggregationDuration - technicalDuration - dataDuration,
    data: {
      direction,
      confidence,
      duration,
      qualityScore,
      keyFactors,
      riskFactors,
      tradeTargets,
      explanation: geminiDecision?.rationale || `Strong ${direction} signal detected with ${confidence}% confidence`,
    },
  });

  const prediction: Prediction = {
    pair,
    direction,
    confidence,
    duration,
    analysis: geminiDecision?.rationale || `Strong ${direction} signal detected with ${confidence}% confidence`,
    rationale: geminiDecision?.rationale,
    riskFactors,
    detailedAnalysis: {
      indicators: technicalIndicatorsList.map(i => ({
        name: i.name,
        value: i.value,
        direction: i.signal as "UP" | "DOWN" | "NEUTRAL",
        strength: i.strength,
        weight: 1.0,
        reason: i.description,
        category: i.category,
      })),
      upSignals: upSignals.map(s => ({
        name: s.name,
        value: s.value,
        direction: "UP" as const,
        strength: s.strength,
        weight: 1.0,
        reason: s.description,
        category: s.category,
      })),
      downSignals: downSignals.map(s => ({
        name: s.name,
        value: s.value,
        direction: "DOWN" as const,
        strength: s.strength,
        weight: 1.0,
        reason: s.description,
        category: s.category,
      })),
      upScore,
      downScore,
      signalAlignment,
      qualityScore,
      marketRegime: indicators.marketRegime,
      confidenceBreakdown: {
        baseScore: Math.round(signalAlignment * 0.6),
        volumeBonus: Math.round(Math.abs(marketData.volumeChange24h) > 15 ? 25 : 10),
        regimeBonus: indicators.marketRegime === "STRONG_TRENDING" ? 18 : indicators.marketRegime === "TRENDING" ? 10 : 0,
        alignmentPenalty: signalAlignment < 70 ? -12 : 0,
        qualityBoost: qualityScore > 80 ? 15 : qualityScore > 60 ? 10 : 0,
        rawScore: Math.round((upScore + downScore) / 2),
        finalConfidence: confidence,
      },
      thinkingProcess: geminiDecision?.thinkingProcess,
      keyFactors,
    },
  };

  return prediction;
}
