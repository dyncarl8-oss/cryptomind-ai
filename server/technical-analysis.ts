interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  rsi: number;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  movingAverages: {
    sma20: number;
    sma50: number;
    sma100: number;
    sma200: number;
    ema12: number;
    ema26: number;
    ema50: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
  };
  volumeIndicator: number;
  stochastic: {
    k: number;
    d: number;
  };
  adx: {
    value: number;
    plusDI: number;
    minusDI: number;
  };
  atr: number;
  obv: number;
  momentum: number;
  roc: number;
  supportResistance: {
    nearestSupport: number;
    nearestResistance: number;
    distanceToSupport: number;
    distanceToResistance: number;
  };
  trendStrength: number;
  marketRegime: "STRONG_TRENDING" | "TRENDING" | "RANGING";
}

export function calculateRSI(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) {
    return 50; // Neutral if not enough data
  }
  
  const prices = candles.map(c => c.close);
  let gains = 0;
  let losses = 0;
  
  // Calculate initial average gain and loss
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  return rsi;
}

export function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) {
    return prices[prices.length - 1];
  }
  
  const multiplier = 2 / (period + 1);
  let ema = prices.slice(-period).reduce((a, b) => a + b) / period;
  
  for (let i = prices.length - period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

export function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) {
    return prices.reduce((a, b) => a + b) / prices.length;
  }
  
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b) / period;
}

export function calculateMACD(candles: Candle[]): {
  value: number;
  signal: number;
  histogram: number;
} {
  const prices = candles.map(c => c.close);
  
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macdValue = ema12 - ema26;
  
  // Calculate signal line (9-day EMA of MACD)
  const macdValues: number[] = [];
  for (let i = 26; i <= prices.length; i++) {
    const slice = prices.slice(0, i);
    const e12 = calculateEMA(slice, 12);
    const e26 = calculateEMA(slice, 26);
    macdValues.push(e12 - e26);
  }
  
  const signal = calculateEMA(macdValues, 9);
  const histogram = macdValue - signal;
  
  return {
    value: macdValue,
    signal,
    histogram,
  };
}

export function calculateBollingerBands(candles: Candle[], period: number = 20): {
  upper: number;
  middle: number;
  lower: number;
} {
  const prices = candles.map(c => c.close);
  const sma = calculateSMA(prices, period);
  
  // Calculate standard deviation
  const slice = prices.slice(-period);
  const squaredDiffs = slice.map(price => Math.pow(price - sma, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b) / period;
  const stdDev = Math.sqrt(variance);
  
  return {
    upper: sma + (stdDev * 2),
    middle: sma,
    lower: sma - (stdDev * 2),
  };
}

export function calculateVolumeIndicator(candles: Candle[]): number {
  // Calculate volume trend - positive if volume is increasing, negative if decreasing
  if (candles.length < 10) return 0;
  
  const recentVolumes = candles.slice(-5).map(c => c.volume);
  const olderVolumes = candles.slice(-10, -5).map(c => c.volume);
  
  const recentAvg = recentVolumes.reduce((a, b) => a + b) / recentVolumes.length;
  const olderAvg = olderVolumes.reduce((a, b) => a + b) / olderVolumes.length;
  
  // Return percentage change
  return ((recentAvg / olderAvg - 1) * 100);
}

export function calculateStochastic(candles: Candle[], kPeriod: number = 14, dPeriod: number = 3): {
  k: number;
  d: number;
} {
  if (candles.length < kPeriod) {
    return { k: 50, d: 50 };
  }
  
  const recentCandles = candles.slice(-kPeriod);
  const currentClose = candles[candles.length - 1].close;
  const highestHigh = Math.max(...recentCandles.map(c => c.high));
  const lowestLow = Math.min(...recentCandles.map(c => c.low));
  
  let k = 50;
  if (highestHigh !== lowestLow) {
    k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  }
  
  const kValues: number[] = [];
  for (let i = Math.max(0, candles.length - kPeriod - dPeriod); i < candles.length; i++) {
    const slice = candles.slice(Math.max(0, i - kPeriod + 1), i + 1);
    if (slice.length >= kPeriod) {
      const close = candles[i].close;
      const high = Math.max(...slice.map(c => c.high));
      const low = Math.min(...slice.map(c => c.low));
      if (high !== low) {
        kValues.push(((close - low) / (high - low)) * 100);
      }
    }
  }
  
  const d = kValues.length >= dPeriod
    ? kValues.slice(-dPeriod).reduce((a, b) => a + b) / dPeriod
    : k;
  
  return { k, d };
}

export function calculateADX(candles: Candle[], period: number = 14): {
  value: number;
  plusDI: number;
  minusDI: number;
} {
  if (candles.length < period + 1) {
    return { value: 0, plusDI: 0, minusDI: 0 };
  }
  
  const trValues: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevHigh = candles[i - 1].high;
    const prevLow = candles[i - 1].low;
    const prevClose = candles[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trValues.push(tr);
    
    const highMove = high - prevHigh;
    const lowMove = prevLow - low;
    
    plusDM.push(highMove > lowMove && highMove > 0 ? highMove : 0);
    minusDM.push(lowMove > highMove && lowMove > 0 ? lowMove : 0);
  }
  
  const atr = trValues.slice(-period).reduce((a, b) => a + b) / period;
  const avgPlusDM = plusDM.slice(-period).reduce((a, b) => a + b) / period;
  const avgMinusDM = minusDM.slice(-period).reduce((a, b) => a + b) / period;
  
  const plusDI = atr !== 0 ? (avgPlusDM / atr) * 100 : 0;
  const minusDI = atr !== 0 ? (avgMinusDM / atr) * 100 : 0;
  
  const dx = (plusDI + minusDI) !== 0
    ? (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100
    : 0;
  
  const dxValues: number[] = [];
  for (let i = period; i < Math.min(trValues.length, period * 2); i++) {
    const sliceTR = trValues.slice(i - period, i);
    const slicePlusDM = plusDM.slice(i - period, i);
    const sliceMinusDM = minusDM.slice(i - period, i);
    
    const atrVal = sliceTR.reduce((a, b) => a + b) / period;
    const pDM = slicePlusDM.reduce((a, b) => a + b) / period;
    const mDM = sliceMinusDM.reduce((a, b) => a + b) / period;
    
    const pDI = atrVal !== 0 ? (pDM / atrVal) * 100 : 0;
    const mDI = atrVal !== 0 ? (mDM / atrVal) * 100 : 0;
    
    if ((pDI + mDI) !== 0) {
      dxValues.push((Math.abs(pDI - mDI) / (pDI + mDI)) * 100);
    }
  }
  
  const adx = dxValues.length > 0
    ? dxValues.reduce((a, b) => a + b) / dxValues.length
    : dx;
  
  return { value: adx, plusDI, minusDI };
}

export function calculateATR(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) {
    return 0;
  }
  
  const trValues: number[] = [];
  
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trValues.push(tr);
  }
  
  const atr = trValues.slice(-period).reduce((a, b) => a + b) / period;
  return atr;
}

export function calculateOBV(candles: Candle[]): number {
  if (candles.length < 2) return 0;
  
  let obv = 0;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) {
      obv += candles[i].volume;
    } else if (candles[i].close < candles[i - 1].close) {
      obv -= candles[i].volume;
    }
  }
  
  return obv;
}

export function calculateMomentum(candles: Candle[], period: number = 10): number {
  if (candles.length < period + 1) return 0;
  
  const currentPrice = candles[candles.length - 1].close;
  const pastPrice = candles[candles.length - period - 1].close;
  
  return ((currentPrice - pastPrice) / pastPrice) * 100;
}

export function calculateROC(candles: Candle[], period: number = 12): number {
  if (candles.length < period + 1) return 0;
  
  const currentPrice = candles[candles.length - 1].close;
  const pastPrice = candles[candles.length - period - 1].close;
  
  return ((currentPrice - pastPrice) / pastPrice) * 100;
}

export function findSupportResistance(candles: Candle[], currentPrice: number): {
  nearestSupport: number;
  nearestResistance: number;
  distanceToSupport: number;
  distanceToResistance: number;
} {
  if (candles.length < 20) {
    return {
      nearestSupport: currentPrice * 0.98,
      nearestResistance: currentPrice * 1.02,
      distanceToSupport: 2,
      distanceToResistance: 2,
    };
  }
  
  const pivotPoints: number[] = [];
  const window = 5;
  
  for (let i = window; i < candles.length - window; i++) {
    const slice = candles.slice(i - window, i + window + 1);
    const center = candles[i];
    
    const isHigh = slice.every(c => c !== center ? center.high >= c.high : true);
    const isLow = slice.every(c => c !== center ? center.low <= c.low : true);
    
    if (isHigh) pivotPoints.push(center.high);
    if (isLow) pivotPoints.push(center.low);
  }
  
  const supports = pivotPoints.filter(p => p < currentPrice).sort((a, b) => b - a);
  const resistances = pivotPoints.filter(p => p > currentPrice).sort((a, b) => a - b);
  
  const nearestSupport = supports.length > 0 ? supports[0] : currentPrice * 0.97;
  const nearestResistance = resistances.length > 0 ? resistances[0] : currentPrice * 1.03;
  
  const distanceToSupport = ((currentPrice - nearestSupport) / currentPrice) * 100;
  const distanceToResistance = ((nearestResistance - currentPrice) / currentPrice) * 100;
  
  return {
    nearestSupport,
    nearestResistance,
    distanceToSupport,
    distanceToResistance,
  };
}

export function calculateTrendStrength(candles: Candle[], adxValue: number): number {
  if (candles.length < 20) return 0;
  
  const prices = candles.map(c => c.close);
  const sma20 = calculateSMA(prices, 20);
  const currentPrice = prices[prices.length - 1];
  
  const pricePositionScore = ((currentPrice - sma20) / sma20) * 100;
  
  let consecutiveMoves = 0;
  let lastDirection = 0;
  
  for (let i = candles.length - 1; i > candles.length - 11 && i > 0; i--) {
    const direction = candles[i].close > candles[i - 1].close ? 1 : -1;
    if (lastDirection === 0) {
      lastDirection = direction;
      consecutiveMoves = 1;
    } else if (direction === lastDirection) {
      consecutiveMoves++;
    } else {
      break;
    }
  }
  
  const momentumScore = consecutiveMoves * 10;
  const trendStrength = (adxValue + Math.abs(pricePositionScore) * 10 + momentumScore) / 3;
  
  return Math.min(100, trendStrength);
}

export function determineMarketRegime(adx: number, atr: number, currentPrice: number): "STRONG_TRENDING" | "TRENDING" | "RANGING" {
  const volatilityRatio = (atr / currentPrice) * 100;
  
  if (adx > 40 && volatilityRatio > 0.5) {
    return "STRONG_TRENDING";
  } else if (adx > 25) {
    return "TRENDING";
  } else {
    return "RANGING";
  }
}

export function analyzeMarket(candles: Candle[]): TechnicalIndicators {
  const prices = candles.map(c => c.close);
  const currentPrice = prices[prices.length - 1];
  
  const adx = calculateADX(candles, 14);
  const atr = calculateATR(candles, 14);
  const bollingerBands = calculateBollingerBands(candles, 20);
  const bandwidth = ((bollingerBands.upper - bollingerBands.lower) / bollingerBands.middle) * 100;
  
  const trendStrength = calculateTrendStrength(candles, adx.value);
  const marketRegime = determineMarketRegime(adx.value, atr, currentPrice);
  
  return {
    rsi: calculateRSI(candles, 14),
    macd: calculateMACD(candles),
    movingAverages: {
      sma20: calculateSMA(prices, 20),
      sma50: calculateSMA(prices, 50),
      sma100: calculateSMA(prices, 100),
      sma200: calculateSMA(prices, 200),
      ema12: calculateEMA(prices, 12),
      ema26: calculateEMA(prices, 26),
      ema50: calculateEMA(prices, 50),
    },
    bollingerBands: {
      ...bollingerBands,
      bandwidth,
    },
    volumeIndicator: calculateVolumeIndicator(candles),
    stochastic: calculateStochastic(candles, 14, 3),
    adx,
    atr,
    obv: calculateOBV(candles),
    momentum: calculateMomentum(candles, 10),
    roc: calculateROC(candles, 12),
    supportResistance: findSupportResistance(candles, currentPrice),
    trendStrength,
    marketRegime,
  };
}
