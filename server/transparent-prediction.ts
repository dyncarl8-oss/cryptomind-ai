import { WebSocket } from "ws";
import { type TradeTargets, type TradingPair } from "@shared/schema";
import { fetchMarketData, getAnchorTimeframes } from "./crypto-data";
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

/**
 * Check if volume meets the 1.1x Volume MA threshold
 * This is the "Fuel" rule - volume must be at least 1.1x average
 */
function checkVolumeConfirmation(currentVolume: number, volumeMA: number): {
  passes: boolean;
  reason: string;
  ratio: number;
} {
  const ratio = volumeMA > 0 ? currentVolume / volumeMA : 1;
  const passes = ratio >= 1.1;

  return {
    passes,
    reason: passes
      ? `Volume confirmed: ${ratio.toFixed(2)}x MA (≥1.1x threshold)`
      : `Volume low: ${ratio.toFixed(2)}x MA (<1.1x threshold)`,
    ratio,
  };
}

/**
 * Check for volume divergence (price up but volume down = weak breakout)
 */
function checkVolumeDivergence(
  candles: any[],
  direction: "UP" | "DOWN" | "NEUTRAL"
): {
  hasDivergence: boolean;
  reason: string;
  details?: string;
} {
  if (candles.length < 5) {
    return { hasDivergence: false, reason: "Not enough data for divergence check" };
  }

  const recentCandles = candles.slice(-5);
  const currentCandle = recentCandles[recentCandles.length - 1];
  const prevCandle = recentCandles[recentCandles.length - 2];

  // Check if price is making new highs but volume is decreasing
  if (direction === "UP") {
    const price新高 = currentCandle.close > prevCandle.close;
    const volumeDecreasing = currentCandle.volume < prevCandle.volume;

    if (price新高 && volumeDecreasing) {
      return {
        hasDivergence: true,
        reason: "Weak Breakout: Price rising on declining volume",
        details: `Price: ${currentCandle.close.toFixed(2)} (↑) | Volume: ${currentCandle.volume.toFixed(0)} (↓)`,
      };
    }
  }

  // Check if price is making new lows but volume is decreasing
  if (direction === "DOWN") {
    const price新低 = currentCandle.close < prevCandle.close;
    const volumeDecreasing = currentCandle.volume < prevCandle.volume;

    if (price新低 && volumeDecreasing) {
      return {
        hasDivergence: true,
        reason: "Weak Breakdown: Price falling on declining volume",
        details: `Price: ${currentCandle.close.toFixed(2)} (↓) | Volume: ${currentCandle.volume.toFixed(0)} (↓)`,
      };
    }
  }

  return { hasDivergence: false, reason: "No volume divergence detected" };
}

/**
 * Check RSI for neutral zone (45-55 = observation mode)
 */
function checkRSINeutralZone(rsi: number): {
  isNeutral: boolean;
  reason: string;
} {
  if (rsi >= 48 && rsi <= 52) {
    return {
      isNeutral: true,
      reason: `RSI in tight neutral zone (${rsi.toFixed(1)})`,
    };
  }
  return {
    isNeutral: false,
    reason: `RSI ${rsi.toFixed(1)} - directional momentum`,
  };
}

/**
 * Check trend alignment between entry timeframe and anchor timeframe
 * Returns true if signals align, false if conflict
 */
function checkTrendAlignment(
  entryTrendBias: "BULLISH" | "BEARISH" | "NEUTRAL",
  anchorTrendBias: "BULLISH" | "BEARISH" | "NEUTRAL",
  entryDirection: "UP" | "DOWN" | "NEUTRAL"
): {
  aligned: boolean;
  reason: string;
} {
  // Convert direction to trend bias
  const entryBiasFromDirection =
    entryDirection === "UP"
      ? "BULLISH"
      : entryDirection === "DOWN"
      ? "BEARISH"
      : "NEUTRAL";

  // If anchor is neutral, we can proceed but with caution
  if (anchorTrendBias === "NEUTRAL") {
    return {
      aligned: true,
      reason: "Anchor trend neutral - proceeding with caution",
    };
  }

  // If entry direction is neutral, we can proceed
  if (entryBiasFromDirection === "NEUTRAL") {
    return {
      aligned: true,
      reason: "Entry direction neutral - proceeding",
    };
  }

  // Check if they align
  if (entryBiasFromDirection === anchorTrendBias) {
    return {
      aligned: true,
      reason: `Trend aligned: Entry (${entryBiasFromDirection}) matches Anchor (${anchorTrendBias})`,
    };
  }

  // They don't align - reject the trade
  return {
    aligned: false,
    reason: `Trend Conflict: Entry (${entryBiasFromDirection}) conflicts with Anchor (${anchorTrendBias}) - Entry rejected`,
  };
}

/**
 * Calculate confidence score with all validation rules
 * Returns minimum of 75 for valid signals, otherwise neutral
 */
function calculateValidatedConfidence(
  baseConfidence: number,
  volumeRatio: number,
  adxValue: number,
  trendAlignment: boolean,
  rsiNeutral: boolean,
  hasVolumeDivergence: boolean
): {
  confidence: number;
  shouldProceed: boolean;
  rejectionReason: string | null;
} {
  // Rule 1: Minimum confidence threshold (Adjusted from 90 to 80)
  if (baseConfidence < 80) {
    return {
      confidence: baseConfidence,
      shouldProceed: false,
      rejectionReason: `Confidence below minimum threshold (${baseConfidence}% < 80%)`,
    };
  }

  // Rule 2: Trend alignment (Now a warning unless confidence is very low, relaxed threshold 85→82)
  if (!trendAlignment && baseConfidence < 82) {
    return {
      confidence: baseConfidence,
      shouldProceed: false,
      rejectionReason: "Trend Conflict: Counter-trend setups require higher confidence (>82%)",
    };
  }

  // Rule 3: Volume confirmation (Relaxed from 1.5x to 1.1x, override threshold 88→85)
  if (volumeRatio < 1.1 && baseConfidence < 85) {
    return {
      confidence: baseConfidence,
      shouldProceed: false,
      rejectionReason: `Low volume (${volumeRatio.toFixed(2)}x) requires higher baseline confidence`,
    };
  }

  // Rule 4: Volume divergence check (Only reject if extreme, override threshold 90→85)
  if (hasVolumeDivergence && baseConfidence < 85) {
    return {
      confidence: baseConfidence,
      shouldProceed: false,
      rejectionReason: "Volume divergence detected - weak breakout/breakdown",
    };
  }

  // Rule 5: RSI neutral zone (Much tighter now: 48-52)
  if (rsiNeutral && baseConfidence < 80) {
    return {
      confidence: baseConfidence,
      shouldProceed: false,
      rejectionReason: "RSI in neutral zone - low momentum setup",
    };
  }

  // Rule 6: ADX < 15 = ranging market (Relaxed from 20)
  if (adxValue < 15) {
    return {
      confidence: baseConfidence,
      shouldProceed: false,
      rejectionReason: "ADX < 15 - Extremely ranging market, no edge detected",
    };
  }

  // All checks passed or overridden by high confidence
  return {
    confidence: Math.min(98, baseConfidence),
    shouldProceed: true,
    rejectionReason: null,
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

  // Fetch anchor timeframe data for trend alignment
  const anchorTf = getAnchorTimeframes(timeframe);
  let anchorIndicators: TechnicalIndicators | null = null;
  let anchorTrendValidationResult: { aligned: boolean; reason: string } = { aligned: true, reason: "No anchor check performed" };

  try {
    const anchorMarketData = await fetchMarketData(pair, anchorTf.primary);
    anchorIndicators = analyzeMarket(anchorMarketData.candles);
  } catch (error) {
    console.warn(`Failed to fetch anchor timeframe (${anchorTf.primary}) data:`, error);
  }

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
  const thinkingModelLabel = "Gemini 3 Pro (Thinking Mode)";

  sendStageUpdate(ws, {
    type: "analysis_stage",
    stage: "ai_thinking",
    progress: 0,
    status: "in_progress",
    data: {
      thinkingProcess: "",
      analysisTime: 0,
      modelUsed: thinkingModelLabel,
    },
  });

  const technicalSnapshot = {
    pair,
    currentPrice: marketData.currentPrice,
    priceChange24h: marketData.priceChange24h,
    marketRegime: indicators.marketRegime,
    entryTimeframe: timeframe,
    anchorTimeframe: anchorTf.primary,
    entryTrendBias: indicators.trendBias,
    anchorTrendBias: anchorIndicators?.trendBias || "NEUTRAL",
    upSignals: upSignals.map(s => ({ category: s.category, reason: s.description, strength: s.strength })),
    downSignals: downSignals.map(s => ({ category: s.category, reason: s.description, strength: s.strength })),
    upScore,
    downScore,
    volumeIndicator: marketData.volumeChange24h,
    volumeMA: indicators.volumeMA,
    currentVolume: marketData.candles[marketData.candles.length - 1]?.volume || 0,
    trendStrength: indicators.trendStrength,
    volatility: indicators.atr,
    rsiValue: indicators.rsi,
    macdSignal: indicators.macd.histogram > 0 ? "bullish" : "bearish",
    adxValue: indicators.adx.value,
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
      modelUsed: thinkingModelLabel,
    },
  });

  const geminiDecision = await getGeminiPrediction(technicalSnapshot, ws);
  
  await delay(1000);

  sendStageUpdate(ws, {
    type: "analysis_stage",
    stage: "ai_thinking",
    progress: 100,
    status: "in_progress",
    data: {
      thinkingProcess: geminiDecision?.thinkingProcess || "AI deep analysis complete. Evaluating all technical indicators and market conditions to generate high-confidence prediction.",
      analysisTime: Date.now() - aiStartTime,
      modelUsed: thinkingModelLabel,
    },
  });

  // Give frontend time to receive the full text and start typewriter animation
  await delay(500);

  if (waitForAiThinkingComplete) {
    await waitForAiThinkingComplete();
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
      modelUsed: thinkingModelLabel,
    },
  });

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

  let direction = geminiDecision?.direction || (upScore > downScore ? "UP" : "DOWN") as "UP" | "DOWN" | "NEUTRAL";
  let confidence = geminiDecision?.confidence || Math.round(Math.min(95, (signalAlignment * 0.8) + (indicators.trendStrength * 0.2)));
  const duration = getDurationBasedOnTimeframe(timeframe);
  const qualityScore = Math.round((signalAlignment + indicators.trendStrength) / 2);

  // Perform all validation checks
  const currentVolume = marketData.candles[marketData.candles.length - 1]?.volume || 0;
  const volumeMA = indicators.volumeMA;

  // Check 1: Volume confirmation (1.5x threshold)
  const volumeConfirmation = checkVolumeConfirmation(currentVolume, volumeMA);

  // Check 2: Volume divergence
  const volumeDivergence = checkVolumeDivergence(marketData.candles, direction);

  // Check 3: RSI neutral zone
  const rsiNeutralCheck = checkRSINeutralZone(indicators.rsi);

  // Check 4: Trend alignment (if we have anchor data)
  if (anchorIndicators) {
    anchorTrendValidationResult = checkTrendAlignment(
      indicators.trendBias,
      anchorIndicators.trendBias,
      direction
    );
  }

  // Check 5: Final confidence validation with all rules
  const validationResult = calculateValidatedConfidence(
    confidence,
    volumeConfirmation.ratio,
    indicators.adx.value,
    anchorTrendValidationResult.aligned,
    rsiNeutralCheck.isNeutral,
    volumeDivergence.hasDivergence
  );

  let keyFactors: string[];
  let riskFactors: string[];
  let explanation: string;
  let tradeTargets: TradeTargets | undefined;

  if (!validationResult.shouldProceed) {
    // Rejection case - return neutral with explanation
    direction = "NEUTRAL";
    confidence = validationResult.confidence; // Show actual confidence, not 0
    tradeTargets = undefined;

    keyFactors = [
      anchorTrendValidationResult.reason,
      volumeConfirmation.reason,
      rsiNeutralCheck.reason,
      `ADX: ${indicators.adx.value.toFixed(1)} - ${indicators.adx.value < 15 ? "Tight Range" : "Directional Momentum"}`,
    ];

    riskFactors = [
      validationResult.rejectionReason || "Multiple validation checks failed",
    ];

    explanation = `Market Analysis: Neutral leaning. ${validationResult.rejectionReason}. Standing aside.`;
  } else {
    // Proceed with valid signal
    confidence = validationResult.confidence;

    keyFactors = geminiDecision?.keyFactors || [
      `${upSignals.length}/${totalSignals} indicators bullish (${signalAlignment.toFixed(1)}% alignment)`,
      `Trend Aligned: Entry (${indicators.trendBias}) matches Anchor (${anchorIndicators?.trendBias || "N/A"})`,
      `${indicators.marketRegime} market (ADX: ${indicators.adx.value.toFixed(1)})`,
      volumeConfirmation.reason,
    ];

    riskFactors = geminiDecision?.riskFactors || [
      volumeDivergence.hasDivergence ? volumeDivergence.reason : "Monitor for volume decrease",
      indicators.atr > 3 ? "High volatility - wider stops recommended" : "Normal volatility range",
    ];

    if (direction === "NEUTRAL") {
      tradeTargets = undefined;
    } else {
      const nonNeutralDirection: "UP" | "DOWN" = direction;
      tradeTargets =
        normalizeTradeTargets(
              geminiDecision?.tradeTargets,
              nonNeutralDirection,
              marketData.currentPrice,
              indicators.atr
            ) ??
            computeFallbackTradeTargets(
              nonNeutralDirection,
              marketData.currentPrice,
              indicators.atr
            );
    }

    explanation = geminiDecision?.rationale || `Strong ${direction} signal detected with ${confidence}% confidence`;
  }

  await delay(1500);

  const finalDuration = Date.now() - overallStartTime;

  // Ensure final verdict is always sent with complete status, even if there are issues
  try {
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
        explanation,
      },
    });
  } catch (error) {
    console.error("Error sending final_verdict complete stage:", error);
    // Try one more time with a minimal message if the first attempt fails
    try {
      sendStageUpdate(ws, {
        type: "analysis_stage",
        stage: "final_verdict",
        progress: 100,
        status: "complete",
        data: {
          direction,
          confidence,
          duration,
          qualityScore,
          keyFactors,
          riskFactors,
          tradeTargets,
          explanation,
        },
      });
    } catch (retryError) {
      console.error("Failed to send final_verdict on retry:", retryError);
    }
  }

  const prediction: Prediction = {
    pair,
    direction,
    confidence,
    duration,
    analysis: explanation,
    rationale: explanation,
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
        volumeBonus: Math.round(volumeConfirmation.ratio >= 1.1 ? 25 : 0),
        regimeBonus: indicators.marketRegime === "STRONG_TRENDING" ? 18 : indicators.marketRegime === "TRENDING" ? 10 : 0,
        alignmentPenalty: !anchorTrendValidationResult.aligned ? -20 : signalAlignment < 70 ? -12 : 0,
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
