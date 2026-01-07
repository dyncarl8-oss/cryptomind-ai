import { type TradingPair } from "@shared/schema";
import { fetchMarketData } from "./crypto-data";
import { analyzeMarket, type TechnicalIndicators } from "./technical-analysis";
import { getGeminiPrediction } from "./gemini-decision";

export interface Prediction {
  pair: TradingPair;
  direction: "UP" | "DOWN" | "NEUTRAL";
  confidence: number;
  duration: string;
  analysis?: string;
  rationale?: string;
  riskFactors?: string[];
  detailedAnalysis?: {
    indicators?: IndicatorDetail[];
    upSignals?: WeightedSignal[];
    downSignals?: WeightedSignal[];
    upScore?: number;
    downScore?: number;
    signalAlignment?: number;
    qualityScore?: number;
    marketRegime?: string;
    confidenceBreakdown?: {
      baseScore: number;
      volumeBonus: number;
      regimeBonus: number;
      alignmentPenalty: number;
      qualityBoost: number;
      rawScore: number;
      finalConfidence: number;
    };
    thinkingProcess?: string;
    keyFactors?: string[];
  };
}

export interface IndicatorDetail {
  name: string;
  value: string;
  direction: "UP" | "DOWN" | "NEUTRAL";
  strength: number;
  weight: number;
  reason: string;
  category: string;
}

interface WeightedSignal {
  direction: "UP" | "DOWN" | "NEUTRAL";
  strength: number;
  weight: number;
  reason: string;
  category: string;
}

function analyzeRSI(indicators: TechnicalIndicators): WeightedSignal {
  const { rsi } = indicators;
  
  if (rsi < 20) {
    return {
      direction: "UP",
      strength: 95,
      weight: 1.3,
      reason: `RSI extremely oversold at ${rsi.toFixed(1)}`,
      category: "Momentum",
    };
  } else if (rsi < 30) {
    return {
      direction: "UP",
      strength: 85,
      weight: 1.2,
      reason: `RSI oversold at ${rsi.toFixed(1)}`,
      category: "Momentum",
    };
  } else if (rsi > 80) {
    return {
      direction: "DOWN",
      strength: 95,
      weight: 1.3,
      reason: `RSI extremely overbought at ${rsi.toFixed(1)}`,
      category: "Momentum",
    };
  } else if (rsi > 70) {
    return {
      direction: "DOWN",
      strength: 85,
      weight: 1.2,
      reason: `RSI overbought at ${rsi.toFixed(1)}`,
      category: "Momentum",
    };
  } else if (rsi < 40) {
    return {
      direction: "UP",
      strength: 55,
      weight: 1.0,
      reason: "RSI trending low",
      category: "Momentum",
    };
  } else if (rsi > 60) {
    return {
      direction: "DOWN",
      strength: 55,
      weight: 1.0,
      reason: "RSI trending high",
      category: "Momentum",
    };
  }
  
  return {
    direction: "NEUTRAL",
    strength: 0,
    weight: 0.5,
    reason: "RSI neutral",
    category: "Momentum",
  };
}

function analyzeStochastic(indicators: TechnicalIndicators): WeightedSignal {
  const { stochastic } = indicators;
  const { k, d } = stochastic;
  
  if (k < 20 && d < 20) {
    return {
      direction: "UP",
      strength: 90,
      weight: 1.2,
      reason: `Stochastic oversold (K:${k.toFixed(0)} D:${d.toFixed(0)})`,
      category: "Momentum",
    };
  } else if (k > 80 && d > 80) {
    return {
      direction: "DOWN",
      strength: 90,
      weight: 1.2,
      reason: `Stochastic overbought (K:${k.toFixed(0)} D:${d.toFixed(0)})`,
      category: "Momentum",
    };
  } else if (k < d && k < 50) {
    return {
      direction: "UP",
      strength: 65,
      weight: 1.0,
      reason: "Stochastic bullish crossover signal",
      category: "Momentum",
    };
  } else if (k > d && k > 50) {
    return {
      direction: "DOWN",
      strength: 65,
      weight: 1.0,
      reason: "Stochastic bearish crossover signal",
      category: "Momentum",
    };
  }
  
  return {
    direction: "NEUTRAL",
    strength: 0,
    weight: 0.8,
    reason: "Stochastic neutral",
    category: "Momentum",
  };
}

function analyzeMACD(indicators: TechnicalIndicators): WeightedSignal {
  const { macd } = indicators;
  const diff = macd.value - macd.signal;
  const histogramStrength = Math.abs(macd.histogram);
  
  if (diff > 0 && macd.histogram > 0) {
    const strength = Math.min(50 + histogramStrength * 100, 100);
    return {
      direction: "UP",
      strength,
      weight: 1.4,
      reason: "MACD strong bullish momentum",
      category: "Trend",
    };
  } else if (diff < 0 && macd.histogram < 0) {
    const strength = Math.min(50 + histogramStrength * 100, 100);
    return {
      direction: "DOWN",
      strength,
      weight: 1.4,
      reason: "MACD strong bearish momentum",
      category: "Trend",
    };
  } else if (diff > 0) {
    return {
      direction: "UP",
      strength: 60,
      weight: 1.1,
      reason: "MACD bullish crossover",
      category: "Trend",
    };
  } else if (diff < 0) {
    return {
      direction: "DOWN",
      strength: 60,
      weight: 1.1,
      reason: "MACD bearish crossover",
      category: "Trend",
    };
  }
  
  return {
    direction: "NEUTRAL",
    strength: 0,
    weight: 0.9,
    reason: "MACD neutral",
    category: "Trend",
  };
}

function analyzeMovingAverages(indicators: TechnicalIndicators, currentPrice: number): WeightedSignal {
  const { movingAverages } = indicators;
  const { sma20, sma50, sma100, sma200, ema12, ema26, ema50 } = movingAverages;
  
  let bullishSignals = 0;
  let bearishSignals = 0;
  let totalStrength = 0;
  const reasons: string[] = [];
  
  if (currentPrice > sma20) {
    bullishSignals++;
    totalStrength += 15;
  } else {
    bearishSignals++;
    totalStrength += 15;
  }
  
  if (currentPrice > sma50) {
    bullishSignals++;
    totalStrength += 20;
  } else {
    bearishSignals++;
    totalStrength += 20;
  }
  
  if (currentPrice > sma100) {
    bullishSignals++;
    totalStrength += 15;
  } else {
    bearishSignals++;
    totalStrength += 15;
  }
  
  if (currentPrice > sma200) {
    bullishSignals++;
    totalStrength += 20;
  } else {
    bearishSignals++;
    totalStrength += 20;
  }
  
  if (ema12 > ema26) {
    bullishSignals++;
    totalStrength += 15;
  } else {
    bearishSignals++;
    totalStrength += 15;
  }
  
  if (sma20 > sma50) {
    bullishSignals++;
    totalStrength += 15;
  } else {
    bearishSignals++;
    totalStrength += 15;
  }
  
  const totalSignals = 6;
  const agreement = bullishSignals > bearishSignals
    ? (bullishSignals / totalSignals) * 100
    : (bearishSignals / totalSignals) * 100;
  
  if (bullishSignals >= 5) {
    return {
      direction: "UP",
      strength: 95,
      weight: 1.5,
      reason: `${bullishSignals}/${totalSignals} MA indicators strongly bullish`,
      category: "Trend",
    };
  } else if (bullishSignals > bearishSignals) {
    return {
      direction: "UP",
      strength: (bullishSignals / totalSignals) * totalStrength,
      weight: 1.3,
      reason: `${bullishSignals}/${totalSignals} MA indicators bullish`,
      category: "Trend",
    };
  } else if (bearishSignals >= 5) {
    return {
      direction: "DOWN",
      strength: 95,
      weight: 1.5,
      reason: `${bearishSignals}/${totalSignals} MA indicators strongly bearish`,
      category: "Trend",
    };
  } else if (bearishSignals > bullishSignals) {
    return {
      direction: "DOWN",
      strength: (bearishSignals / totalSignals) * totalStrength,
      weight: 1.3,
      reason: `${bearishSignals}/${totalSignals} MA indicators bearish`,
      category: "Trend",
    };
  }
  
  return {
    direction: "NEUTRAL",
    strength: 0,
    weight: 1.0,
    reason: "MA indicators mixed",
    category: "Trend",
  };
}

function analyzeBollingerBands(indicators: TechnicalIndicators, currentPrice: number): WeightedSignal {
  const { bollingerBands } = indicators;
  const { upper, middle, lower, bandwidth } = bollingerBands;
  
  const range = upper - lower;
  const position = (currentPrice - lower) / range;
  
  const squeezeFactor = bandwidth < 3 ? 1.3 : 1.0;
  
  if (position < 0.1) {
    return {
      direction: "UP",
      strength: 95,
      weight: 1.2 * squeezeFactor,
      reason: "Price at extreme lower Bollinger Band",
      category: "Volatility",
    };
  } else if (position < 0.2) {
    return {
      direction: "UP",
      strength: 85,
      weight: 1.1 * squeezeFactor,
      reason: "Price near lower Bollinger Band",
      category: "Volatility",
    };
  } else if (position > 0.9) {
    return {
      direction: "DOWN",
      strength: 95,
      weight: 1.2 * squeezeFactor,
      reason: "Price at extreme upper Bollinger Band",
      category: "Volatility",
    };
  } else if (position > 0.8) {
    return {
      direction: "DOWN",
      strength: 85,
      weight: 1.1 * squeezeFactor,
      reason: "Price near upper Bollinger Band",
      category: "Volatility",
    };
  } else if (position < 0.4) {
    return {
      direction: "UP",
      strength: 55,
      weight: 0.9,
      reason: "Price below BB middle",
      category: "Volatility",
    };
  } else if (position > 0.6) {
    return {
      direction: "DOWN",
      strength: 55,
      weight: 0.9,
      reason: "Price above BB middle",
      category: "Volatility",
    };
  }
  
  return {
    direction: "NEUTRAL",
    strength: 0,
    weight: 0.7,
    reason: "Price at BB middle",
    category: "Volatility",
  };
}

function analyzeADX(indicators: TechnicalIndicators): WeightedSignal {
  const { adx, trendStrength } = indicators;
  
  if (adx.value > 50 && adx.plusDI > adx.minusDI) {
    return {
      direction: "UP",
      strength: 95,
      weight: 1.6,
      reason: `Very strong uptrend (ADX:${adx.value.toFixed(0)})`,
      category: "Trend",
    };
  } else if (adx.value > 50 && adx.minusDI > adx.plusDI) {
    return {
      direction: "DOWN",
      strength: 95,
      weight: 1.6,
      reason: `Very strong downtrend (ADX:${adx.value.toFixed(0)})`,
      category: "Trend",
    };
  } else if (adx.value > 30 && adx.plusDI > adx.minusDI) {
    return {
      direction: "UP",
      strength: 80,
      weight: 1.4,
      reason: `Strong uptrend (ADX:${adx.value.toFixed(0)})`,
      category: "Trend",
    };
  } else if (adx.value > 30 && adx.minusDI > adx.plusDI) {
    return {
      direction: "DOWN",
      strength: 80,
      weight: 1.4,
      reason: `Strong downtrend (ADX:${adx.value.toFixed(0)})`,
      category: "Trend",
    };
  } else if (adx.value > 20 && adx.plusDI > adx.minusDI) {
    return {
      direction: "UP",
      strength: 60,
      weight: 1.1,
      reason: "Moderate uptrend forming",
      category: "Trend",
    };
  } else if (adx.value > 20 && adx.minusDI > adx.plusDI) {
    return {
      direction: "DOWN",
      strength: 60,
      weight: 1.1,
      reason: "Moderate downtrend forming",
      category: "Trend",
    };
  }
  
  return {
    direction: "NEUTRAL",
    strength: 30,
    weight: 0.6,
    reason: "Weak trend, ranging market",
    category: "Trend",
  };
}

function analyzeMomentum(indicators: TechnicalIndicators): WeightedSignal {
  const { momentum, roc } = indicators;
  
  if (momentum > 3 && roc > 3) {
    return {
      direction: "UP",
      strength: 85,
      weight: 1.2,
      reason: "Strong bullish momentum",
      category: "Momentum",
    };
  } else if (momentum < -3 && roc < -3) {
    return {
      direction: "DOWN",
      strength: 85,
      weight: 1.2,
      reason: "Strong bearish momentum",
      category: "Momentum",
    };
  } else if (momentum > 1.5) {
    return {
      direction: "UP",
      strength: 65,
      weight: 1.0,
      reason: "Positive momentum building",
      category: "Momentum",
    };
  } else if (momentum < -1.5) {
    return {
      direction: "DOWN",
      strength: 65,
      weight: 1.0,
      reason: "Negative momentum building",
      category: "Momentum",
    };
  }
  
  return {
    direction: "NEUTRAL",
    strength: 0,
    weight: 0.8,
    reason: "Momentum neutral",
    category: "Momentum",
  };
}

function analyzeSupportResistance(indicators: TechnicalIndicators, currentPrice: number): WeightedSignal {
  const { supportResistance } = indicators;
  const { distanceToSupport, distanceToResistance } = supportResistance;
  
  if (distanceToSupport < 0.5) {
    return {
      direction: "UP",
      strength: 90,
      weight: 1.3,
      reason: "Price at strong support level",
      category: "Price Action",
    };
  } else if (distanceToResistance < 0.5) {
    return {
      direction: "DOWN",
      strength: 90,
      weight: 1.3,
      reason: "Price at strong resistance level",
      category: "Price Action",
    };
  } else if (distanceToSupport < 1.5) {
    return {
      direction: "UP",
      strength: 65,
      weight: 1.1,
      reason: "Price near support level",
      category: "Price Action",
    };
  } else if (distanceToResistance < 1.5) {
    return {
      direction: "DOWN",
      strength: 65,
      weight: 1.1,
      reason: "Price near resistance level",
      category: "Price Action",
    };
  }
  
  return {
    direction: "NEUTRAL",
    strength: 0,
    weight: 0.9,
    reason: "Price between support and resistance",
    category: "Price Action",
  };
}

function analyzeVolume(indicators: TechnicalIndicators, direction: "UP" | "DOWN"): number {
  const { volumeIndicator, obv } = indicators;
  
  if (volumeIndicator > 20 && obv > 0) {
    return direction === "UP" ? 25 : -15;
  } else if (volumeIndicator > 10 && obv > 0) {
    return direction === "UP" ? 15 : -8;
  } else if (volumeIndicator < -20 && obv < 0) {
    return direction === "DOWN" ? 25 : -15;
  } else if (volumeIndicator < -10 && obv < 0) {
    return direction === "DOWN" ? 15 : -8;
  } else if (volumeIndicator > 5) {
    return direction === "UP" ? 8 : -5;
  } else if (volumeIndicator < -5) {
    return direction === "DOWN" ? 8 : -5;
  }
  
  return 0;
}

function combineWeightedSignals(
  signals: WeightedSignal[],
  volumeBonus: number,
  marketRegime: "STRONG_TRENDING" | "TRENDING" | "RANGING"
): {
  direction: "UP" | "DOWN" | "NEUTRAL";
  confidence: number;
  reasons: string[];
  signalAlignment: number;
  qualityScore: number;
} {
  let upScore = 0;
  let downScore = 0;
  let upCount = 0;
  let downCount = 0;
  const upReasons: string[] = [];
  const downReasons: string[] = [];
  
  console.log('\n📊 Analyzing Signals:');
  
  for (const signal of signals) {
    const weightedStrength = signal.strength * signal.weight;
    
    if (signal.direction === "UP") {
      upScore += weightedStrength;
      upCount++;
      upReasons.push(signal.reason);
      console.log(`  ↗️  ${signal.category}: ${signal.reason} (Strength: ${signal.strength.toFixed(0)}, Weight: ${signal.weight.toFixed(1)})`);
    } else if (signal.direction === "DOWN") {
      downScore += weightedStrength;
      downCount++;
      downReasons.push(signal.reason);
      console.log(`  ↘️  ${signal.category}: ${signal.reason} (Strength: ${signal.strength.toFixed(0)}, Weight: ${signal.weight.toFixed(1)})`);
    } else {
      console.log(`  ➡️  ${signal.category}: ${signal.reason}`);
    }
  }
  
  const totalNonNeutral = upCount + downCount;
  
  if (totalNonNeutral === 0 || (upScore === 0 && downScore === 0)) {
    console.log('⚠️  No clear signals - returning NEUTRAL');
    return {
      direction: "NEUTRAL",
      confidence: 0,
      reasons: ["Insufficient market data for prediction"],
      signalAlignment: 0,
      qualityScore: 0,
    };
  }
  
  let direction: "UP" | "DOWN";
  if (upScore === downScore) {
    direction = upCount >= downCount ? "UP" : "DOWN";
  } else {
    direction = upScore > downScore ? "UP" : "DOWN";
  }
  
  const winningScore = direction === "UP" ? upScore : downScore;
  const losingScore = direction === "UP" ? downScore : upScore;
  const alignedCount = direction === "UP" ? upCount : downCount;
  
  const signalAlignment = totalNonNeutral > 0 ? (alignedCount / totalNonNeutral) * 100 : 0;
  
  console.log(`\n📈 Score Summary:`);
  console.log(`  UP Score: ${upScore.toFixed(1)} (${upCount} signals)`);
  console.log(`  DOWN Score: ${downScore.toFixed(1)} (${downCount} signals)`);
  console.log(`  Direction: ${direction} | Alignment: ${signalAlignment.toFixed(0)}%`);
  
  let confidencePenalty = 0;
  if (signalAlignment < 85) {
    confidencePenalty = (85 - signalAlignment) * 1.2;
  }
  
  if (losingScore > 50) {
    confidencePenalty += (losingScore * 0.5);
  }
  
  const rawConfidence = Math.max(0, winningScore + volumeBonus - confidencePenalty);
  
  const regimeMultiplier = marketRegime === "STRONG_TRENDING" ? 1.15 : 
                           marketRegime === "TRENDING" ? 1.05 : 0.9;
  
  const minConfidence = 70;
  const maxConfidence = 99;
  const range = maxConfidence - minConfidence;
  
  const normalizedScore = Math.min(rawConfidence / 180, 1.0);
  let scaledConfidence = minConfidence + (normalizedScore * range);
  scaledConfidence *= regimeMultiplier;
  
  const alignmentBoost = signalAlignment >= 95 ? 3 : signalAlignment >= 88 ? 2 : 0;
  scaledConfidence += alignmentBoost;
  
  const finalConfidence = Math.round(Math.max(minConfidence, Math.min(maxConfidence, scaledConfidence)));
  
  const qualityScore = (signalAlignment * 0.4) + ((finalConfidence - minConfidence) / range * 60);
  
  console.log(`\n🎯 Confidence Calculation:`);
  console.log(`  Raw Score: ${rawConfidence.toFixed(1)}`);
  console.log(`  Normalized: ${(normalizedScore * 100).toFixed(1)}%`);
  console.log(`  Penalty: ${confidencePenalty.toFixed(1)}`);
  console.log(`  Regime (${marketRegime}): ${regimeMultiplier.toFixed(2)}x`);
  console.log(`  Final Confidence: ${finalConfidence}%`);
  console.log(`  Quality Score: ${qualityScore.toFixed(0)}%\n`);
  
  return {
    direction,
    confidence: finalConfidence,
    reasons: direction === "UP" ? upReasons : downReasons,
    signalAlignment: Math.round(signalAlignment),
    qualityScore: Math.round(qualityScore),
  };
}

function determineDuration(
  confidence: number,
  indicators: TechnicalIndicators,
  signalAlignment: number,
  marketRegime: "STRONG_TRENDING" | "TRENDING" | "RANGING"
): string {
  const { volumeIndicator, atr } = indicators;
  
  if (marketRegime === "STRONG_TRENDING" && confidence >= 92 && signalAlignment >= 90) {
    return "10-15 seconds";
  } else if (confidence >= 95 && Math.abs(volumeIndicator) > 20 && signalAlignment >= 85) {
    return "15-20 seconds";
  } else if (confidence >= 92 && Math.abs(volumeIndicator) > 15 && signalAlignment >= 80) {
    return "20-30 seconds";
  } else if (confidence >= 90 && signalAlignment >= 75) {
    return "30-45 seconds";
  } else if (confidence >= 85) {
    return "45-60 seconds";
  } else if (confidence >= 80) {
    return "60-90 seconds";
  } else {
    return "90-120 seconds";
  }
}

export async function generateAIPrediction(pair: TradingPair): Promise<Prediction> {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔮 Generating AI Prediction for ${pair}`);
    console.log(`${'='.repeat(60)}`);
    
    const marketData = await fetchMarketData(pair);
    console.log(`\n💹 Market Data:`);
    console.log(`  Current Price: $${marketData.currentPrice.toFixed(2)}`);
    console.log(`  24h Change: ${marketData.priceChange24h > 0 ? '+' : ''}${marketData.priceChange24h.toFixed(2)}%`);
    console.log(`  Volume Change: ${marketData.volumeChange24h > 0 ? '+' : ''}${marketData.volumeChange24h.toFixed(1)}%`);
    
    const indicators = analyzeMarket(marketData.candles);
    console.log(`\n📉 Technical Indicators:`);
    console.log(`  Market Regime: ${indicators.marketRegime}`);
    console.log(`  Trend Strength: ${indicators.trendStrength.toFixed(1)}%`);
    console.log(`  ADX: ${indicators.adx.value.toFixed(1)} | RSI: ${indicators.rsi.toFixed(1)}`);
    console.log(`  MACD Histogram: ${indicators.macd.histogram.toFixed(4)}`);
    
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
    
    const result = combineWeightedSignals(signals, 0, indicators.marketRegime);
    
    if (result.direction === "NEUTRAL" || result.qualityScore < 60) {
      console.log(`❌ No trade signal - Quality too low (${result.qualityScore.toFixed(0)}%)`);
      console.log(`${'='.repeat(60)}\n`);
      
      const analysis = `Market conditions unclear. Signal quality: ${result.qualityScore.toFixed(0)}%. Waiting for stronger setup. Current Price: $${marketData.currentPrice.toFixed(2)} (24h: ${marketData.priceChange24h > 0 ? '+' : ''}${marketData.priceChange24h.toFixed(2)}%)`;
      
      return {
        pair,
        direction: "NEUTRAL",
        confidence: 0,
        duration: "Waiting for setup",
        analysis,
      };
    }
    
    console.log(`\n🔊 Volume Analysis:`);
    const volumeBonus = analyzeVolume(indicators, result.direction);
    console.log(`  Volume Bonus: ${volumeBonus > 0 ? '+' : ''}${volumeBonus.toFixed(1)}`);
    
    const finalResult = combineWeightedSignals(signals, volumeBonus, indicators.marketRegime);
    
    if (finalResult.confidence < 90) {
      console.log(`⏳ Confidence too low (${finalResult.confidence}%) - waiting for better setup`);
      console.log(`${'='.repeat(60)}\n`);
      
      const analysis = `Signal confidence below threshold (${finalResult.confidence}%). Alignment: ${finalResult.signalAlignment}%. Market Regime: ${indicators.marketRegime}. Waiting for higher confidence setup. Current Price: $${marketData.currentPrice.toFixed(2)}`;
      
      return {
        pair,
        direction: "NEUTRAL",
        confidence: finalResult.confidence,
        duration: "Below confidence threshold",
        analysis,
      };
    }
    
    const upSignals = signals.filter(s => s.direction === "UP").map(s => ({
      category: s.category,
      reason: s.reason,
      strength: s.strength
    }));
    
    const downSignals = signals.filter(s => s.direction === "DOWN").map(s => ({
      category: s.category,
      reason: s.reason,
      strength: s.strength
    }));
    
    const upScore = signals.filter(s => s.direction === "UP")
      .reduce((sum, s) => sum + (s.strength * s.weight), 0);
    const downScore = signals.filter(s => s.direction === "DOWN")
      .reduce((sum, s) => sum + (s.strength * s.weight), 0);
    
    const geminiDecision = await getGeminiPrediction({
      pair,
      currentPrice: marketData.currentPrice,
      priceChange24h: marketData.priceChange24h,
      marketRegime: indicators.marketRegime,
      upSignals,
      downSignals,
      upScore,
      downScore,
      volumeIndicator: indicators.volumeIndicator,
      trendStrength: indicators.trendStrength,
      volatility: indicators.atr,
      rsiValue: indicators.rsi,
      macdSignal: indicators.macd.histogram > 0 ? "bullish" : "bearish"
    });
    
    if (geminiDecision && geminiDecision.direction !== "NEUTRAL") {
      console.log(`\n✅ GEMINI AI TRADE SIGNAL`);
      console.log(`  Direction: ${geminiDecision.direction}`);
      console.log(`  Confidence: ${geminiDecision.confidence}%`);
      console.log(`  Rationale: ${geminiDecision.rationale}`);
      console.log(`${'='.repeat(60)}\n`);
      
      const analysis = `${geminiDecision.rationale} Signal Alignment: ${finalResult.signalAlignment}%. Current Price: $${marketData.currentPrice.toFixed(2)}`;
      
      const regimeMultiplier = indicators.marketRegime === "STRONG_TRENDING" ? 1.15 : 
                               indicators.marketRegime === "TRENDING" ? 1.05 : 0.9;
      
      const duration = determineDuration(
        geminiDecision.confidence,
        indicators,
        finalResult.signalAlignment,
        indicators.marketRegime
      );
      
      return {
        pair,
        direction: geminiDecision.direction,
        confidence: geminiDecision.confidence,
        duration,
        analysis,
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
          upSignals: signals.filter(s => s.direction === "UP"),
          downSignals: signals.filter(s => s.direction === "DOWN"),
          upScore,
          downScore,
          signalAlignment: finalResult.signalAlignment,
          qualityScore: finalResult.qualityScore,
          marketRegime: indicators.marketRegime,
          confidenceBreakdown: {
            baseScore: upScore > downScore ? upScore : downScore,
            volumeBonus,
            regimeBonus: (regimeMultiplier - 1) * 100,
            alignmentPenalty: finalResult.signalAlignment < 85 ? (85 - finalResult.signalAlignment) * 1.2 : 0,
            qualityBoost: finalResult.signalAlignment >= 95 ? 3 : finalResult.signalAlignment >= 88 ? 2 : 0,
            rawScore: upScore > downScore ? upScore + volumeBonus : downScore + volumeBonus,
            finalConfidence: geminiDecision.confidence,
          },
          thinkingProcess: geminiDecision.thinkingProcess,
          keyFactors: geminiDecision.keyFactors,
        },
      };
    }
    
    console.log(`⚠️  Gemini unavailable - using fallback analysis`);
    
    const duration = determineDuration(
      finalResult.confidence,
      indicators,
      finalResult.signalAlignment,
      indicators.marketRegime
    );
    
    console.log(`\n✅ TRADE SIGNAL GENERATED (Fallback)`);
    console.log(`  Direction: ${finalResult.direction}`);
    console.log(`  Confidence: ${finalResult.confidence}%`);
    console.log(`  Duration: ${duration}`);
    console.log(`${'='.repeat(60)}\n`);
    
    const topReasons = finalResult.reasons.slice(0, 3).join(". ");
    const analysis = `${topReasons}. Signal Alignment: ${finalResult.signalAlignment}%. Market: ${indicators.marketRegime}. Trend Strength: ${indicators.trendStrength.toFixed(0)}%. Current Price: $${marketData.currentPrice.toFixed(2)} (24h: ${marketData.priceChange24h > 0 ? '+' : ''}${marketData.priceChange24h.toFixed(2)}%)`;
    
    return {
      pair,
      direction: finalResult.direction,
      confidence: finalResult.confidence,
      duration,
      analysis,
    };
  } catch (error) {
    console.error(`❌ AI Prediction error for ${pair}:`, error);
    
    return {
      pair,
      direction: "NEUTRAL",
      confidence: 0,
      duration: "Data unavailable",
      analysis: `Market data service temporarily unavailable. Cannot perform technical analysis for ${pair}. Please try again in a moment when live market data is restored.`,
    };
  }
}
