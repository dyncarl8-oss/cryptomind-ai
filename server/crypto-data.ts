import { type TradingPair } from "@shared/schema";
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();


const CRYPTOCOMPARE_API_BASE = "https://min-api.cryptocompare.com/data";

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MarketData {
  currentPrice: number;
  candles: Candle[];
  priceChange24h: number;
  volumeChange24h: number;
}

// Map trading pairs to CryptoCompare symbols
const pairToSymbols = (pair: TradingPair): { from: string; to: string } => {
  const mapping: Record<string, { from: string; to: string }> = {
    "BTC/USDT": { from: "BTC", to: "USDT" },
    "ETH/USDT": { from: "ETH", to: "USDT" },
    "XRP/USDT": { from: "XRP", to: "USDT" },
    "BNB/USDT": { from: "BNB", to: "USDT" },
    "SOL/USDT": { from: "SOL", to: "USDT" },
    "TRX/USDT": { from: "TRX", to: "USDT" },
    "DOGE/USDT": { from: "DOGE", to: "USDT" },
    "ADA/USDT": { from: "ADA", to: "USDT" },
    "LINK/USDT": { from: "LINK", to: "USDT" },
    "HYPE/USDT": { from: "HYPE", to: "USDT" },
    "XMR/USDT": { from: "XMR", to: "USDT" },
    "LTC/USDT": { from: "LTC", to: "USDT" },
    "HBAR/USDT": { from: "HBAR", to: "USDT" },
    "AVAX/USDT": { from: "AVAX", to: "USDT" },
    "SUI/USDT": { from: "SUI", to: "USDT" },
    "SHIB/USDT": { from: "SHIB", to: "USDT" },
    "WLFI/USDT": { from: "WLFI", to: "USDT" },
    "UNI/USDT": { from: "UNI", to: "USDT" },
    "DOT/USDT": { from: "DOT", to: "USDT" },
    "AAVE/USDT": { from: "AAVE", to: "USDT" },
    "PEPE/USDT": { from: "PEPE", to: "USDT" },
    "XLM/USDT": { from: "XLM", to: "USDT" },
    "ONDO/USDT": { from: "ONDO", to: "USDT" },
    "ALGO/USDT": { from: "ALGO", to: "USDT" },
    "EUR/USD": { from: "EUR", to: "USD" },
    "GBP/USD": { from: "GBP", to: "USD" },
    "AUD/USD": { from: "AUD", to: "USD" },
    "XAU/USD": { from: "XAU", to: "USD" },
    "US100/USD": { from: "US100", to: "USD" },
  };

  if (pair in mapping) {
    return mapping[pair];
  }

  throw new Error(`Trading pair ${pair} is not supported`);
};

const fetchHeaders = {
  'Accept': 'application/json',
};

const timeframeToMinutes = (timeframe: string): number => {
  const mapping: Record<string, number> = {
    "M1": 1,
    "M3": 3,
    "M5": 5,
    "M15": 15,
    "M30": 30,
    "M45": 45,
    "H1": 60,
    "H2": 120,
    "H3": 180,
    "H4": 240,
    "D1": 1440,
    "W1": 10080,
  };
  return mapping[timeframe] || 5;
};

const getHistoEndpoint = (timeframe: string): { endpoint: string; aggregate: number; limit: number } => {
  // Use histominute for short timeframes with standard aggregates
  if (["M1", "M3", "M5", "M15", "M30", "M45"].includes(timeframe)) {
    const minutes = timeframeToMinutes(timeframe);
    return { endpoint: "histominute", aggregate: minutes, limit: 300 };
  }

  // Use histohour for hour-based timeframes (within API limits)
  // Note: limit * aggregate must be <= 2000 to avoid API reduction
  if (["H1", "H2", "H3", "H4"].includes(timeframe)) {
    const hours = timeframeToMinutes(timeframe) / 60;
    return { endpoint: "histohour", aggregate: hours, limit: 300 };
  }

  // For daily timeframe, use histoday endpoint with daily aggregation
  // This gives us proper daily candles instead of aggregated hourly data
  if (["D1"].includes(timeframe)) {
    return { endpoint: "histoday", aggregate: 1, limit: 300 };
  }

  // For weekly, use histoday with 7-day aggregate for true weekly bars
  // Using histoday with aggregate 7 gives us weekly candles within API limits
  if (["W1"].includes(timeframe)) {
    return { endpoint: "histoday", aggregate: 7, limit: 300 };
  }

  // Default to histominute with 1 minute
  return { endpoint: "histominute", aggregate: 1, limit: 300 };
};

const convertYahooCandles = (quotes: any[]): Candle[] => {
  return quotes.map(p => ({
    timestamp: new Date(p.date).getTime(),
    open: p.open || 0,
    high: p.high || 0,
    low: p.low || 0,
    close: p.close || 0,
    volume: p.volume || 0,
  })).filter(c => c.open !== 0);
};

export async function fetchMarketData(pair: TradingPair, timeframe: string = "M1"): Promise<MarketData> {
  const { from, to } = pairToSymbols(pair);

  // Use Yahoo Finance for XAU/USD and US100/USD
  if (pair === "XAU/USD" || pair === "US100/USD") {
    try {
      const yfSymbol = pair === "XAU/USD" ? "XAUUSD=X" : "^NDX";
      console.log(`[Yahoo Finance] Fetching market data for ${pair} (${yfSymbol})`);

      const quote = await yf.quote(yfSymbol);
      const currentPrice = quote.regularMarketPrice || 0;
      const priceChange24h = quote.regularMarketChangePercent || 0;

      // Yahoo timeframe mapping
      const yahooTimeframeMap: Record<string, string> = {
        "M1": "1m", "M3": "2m", "M5": "5m", "M15": "15m", "M30": "30m",
        "H1": "1h", "H2": "1h", "H4": "1h", "D1": "1d", "W1": "1wk"
      };

      const interval = yahooTimeframeMap[timeframe] || "15m";

      // Calculate start date based on timeframe to get enough data
      const now = new Date();
      let period1: Date;
      if (["M1", "M3", "M5"].includes(timeframe)) {
        period1 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days
      } else if (["M15", "M30", "H1", "H2", "H4"].includes(timeframe)) {
        period1 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days
      } else if (timeframe === "D1") {
        period1 = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year
      } else {
        period1 = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000); // 5 years
      }

      const chartData = await yf.chart(yfSymbol, {
        interval: interval as any,
        period1: period1
      });
      const candles = convertYahooCandles(chartData.quotes);

      console.log(`[Yahoo Finance] Successfully fetched data for ${pair}: $${currentPrice.toFixed(2)}`);

      return {
        currentPrice,
        candles,
        priceChange24h,
        volumeChange24h: 0,
      };
    } catch (error) {
      console.error(`[Yahoo Finance] Error for ${pair}:`, error);
      // Fallback to synthetic if Yahoo fails
    }
  }

  try {
    console.log(`[CryptoCompare API] Fetching market data for ${pair} (${from}/${to})`);

    // Fetch current price
    let currentPrice = 0;
    try {
      const priceResponse = await fetch(
        `${CRYPTOCOMPARE_API_BASE}/price?fsym=${from}&tsyms=${to}`,
        { headers: fetchHeaders }
      );

      if (priceResponse.ok) {
        const priceData = await priceResponse.json();
        currentPrice = priceData[to];
      } else {
        console.warn(`[CryptoCompare API] Price fetch status ${priceResponse.status} for ${pair}`);
      }
    } catch (error) {
      console.error(`[CryptoCompare API] Price fetch error for ${pair}:`, error);
    }

    if (!currentPrice) {
      console.log(`[CryptoCompare API] Using synthetic price for ${pair}`);
      // Default fallback prices based on pair type
      if (pair.includes("XAU")) currentPrice = 2000;
      else if (pair.includes("US100")) currentPrice = 18000;
      else if (pair.includes("BTC")) currentPrice = 50000;
      else currentPrice = 100;
    }

    // Fetch 24h stats
    const dayStatsResponse = await fetch(
      `${CRYPTOCOMPARE_API_BASE}/generateAvg?fsym=${from}&tsym=${to}&e=CCCAGG`,
      { headers: fetchHeaders }
    );

    let priceChange24h = 0;
    if (dayStatsResponse.ok) {
      const dayStatsData = await dayStatsResponse.json();
      if (dayStatsData.RAW && dayStatsData.RAW.CHANGE24HOUR) {
        const change = dayStatsData.RAW.CHANGE24HOUR;
        priceChange24h = (change / currentPrice) * 100;
      }
    }

    // Fetch historical data based on timeframe
    const { endpoint, aggregate, limit } = getHistoEndpoint(timeframe);
    const histoResponse = await fetch(
      `${CRYPTOCOMPARE_API_BASE}/v2/${endpoint}?fsym=${from}&tsym=${to}&limit=${limit}&aggregate=${aggregate}`,
      { headers: fetchHeaders }
    );

    if (!histoResponse.ok) {
      console.error(`[CryptoCompare API] History error - Status: ${histoResponse.status}`);
      // Create synthetic candles with appropriate spacing based on timeframe
      const intervalMs = timeframeToMinutes(timeframe) * 60 * 1000;
      const syntheticCandles = Array.from({ length: 100 }, (_, i) => {
        const timestamp = Date.now() - (100 - i) * intervalMs;
        const priceVariation = 1 + (Math.random() - 0.5) * 0.01;
        const price = currentPrice * priceVariation;
        return {
          timestamp,
          open: price,
          high: price * 1.001,
          low: price * 0.999,
          close: price,
          volume: 1000,
        };
      });

      return {
        currentPrice,
        candles: syntheticCandles,
        priceChange24h,
        volumeChange24h: 0,
      };
    }

    const histoData = await histoResponse.json();

    if (histoData.Response === "Error") {
      console.error(`[CryptoCompare API] History error:`, histoData.Message);
      // Create synthetic candles with appropriate spacing based on timeframe
      const intervalMs = timeframeToMinutes(timeframe) * 60 * 1000;
      const syntheticCandles = Array.from({ length: 100 }, (_, i) => {
        const timestamp = Date.now() - (100 - i) * intervalMs;
        const priceVariation = 1 + (Math.random() - 0.5) * 0.01;
        const price = currentPrice * priceVariation;
        return {
          timestamp,
          open: price,
          high: price * 1.001,
          low: price * 0.999,
          close: price,
          volume: 1000,
        };
      });

      return {
        currentPrice,
        candles: syntheticCandles,
        priceChange24h,
        volumeChange24h: 0,
      };
    }

    const histoPoints = histoData.Data?.Data || [];

    // Convert to candles - always use volumeto for consistency
    const candles: Candle[] = histoPoints.map((point: any) => ({
      timestamp: point.time * 1000, // Convert to milliseconds
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      volume: point.volumeto || 0,
    }));

    // If we don't have enough candles, fill with synthetic data
    if (candles.length < 300) {
      const needed = 300 - candles.length;
      const intervalMs = timeframeToMinutes(timeframe) * 60 * 1000;
      const oldestTimestamp = candles.length > 0 ? candles[0].timestamp : Date.now();
      const syntheticCandles = Array.from({ length: needed }, (_, i) => {
        const timestamp = oldestTimestamp - (needed - i) * intervalMs;
        const priceVariation = 1 + (Math.random() - 0.5) * 0.01;
        const price = currentPrice * priceVariation;
        return {
          timestamp,
          open: price,
          high: price * 1.001,
          low: price * 0.999,
          close: price,
          volume: 1000,
        };
      });
      candles.unshift(...syntheticCandles);
    }

    // Calculate volume change
    const avgVolume = candles.reduce((sum, c) => sum + c.volume, 0) / candles.length;
    const recentVolume = candles.slice(-10).reduce((sum, c) => sum + c.volume, 0) / 10;
    const volumeChange24h = avgVolume > 0 ? ((recentVolume / avgVolume - 1) * 100) : 0;

    console.log(`[CryptoCompare API] Successfully fetched data for ${pair}: $${currentPrice.toFixed(2)}, 24h: ${priceChange24h.toFixed(2)}%`);

    return {
      currentPrice,
      candles,
      priceChange24h,
      volumeChange24h,
    };
  } catch (error) {
    console.error(`Error fetching market data for ${pair}:`, error);
    throw error;
  }
}

export async function getCurrentPrice(pair: TradingPair): Promise<number> {
  const { from, to } = pairToSymbols(pair);

  if (pair === "XAU/USD" || pair === "US100/USD") {
    try {
      const yfSymbol = pair === "XAU/USD" ? "XAUUSD=X" : "^NDX";
      const quote = await yf.quote(yfSymbol);
      return quote.regularMarketPrice || 0;
    } catch (error) {
      console.error(`[Yahoo Finance] Price error for ${pair}:`, error);
      // Fallback to CryptoCompare/Synthetic
    }
  }

  try {
    const response = await fetch(
      `${CRYPTOCOMPARE_API_BASE}/price?fsym=${from}&tsyms=${to}`,
      { headers: fetchHeaders }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch price for ${pair}: Status ${response.status}`);
    }

    const data = await response.json();

    if (!data[to]) {
      throw new Error(`Price data not available for ${pair}`);
    }

    return data[to];
  } catch (error) {
    console.error(`Error fetching current price for ${pair}:`, error);
    throw error;
  }
}

/**
 * Get anchor timeframes for trend alignment checking
 * Based on the "Big Picture" rule:
 * - Scalping (1m, 3m, 5m) → Check 15m & 1hr → Match 1hr trend
 * - Swing (15m, 30m, 1hr) → Check 4hr & 1d → Match 4hr trend
 * - Position (2hr, 4hr, 1d) → Check 1d & 1w → Match 1w trend
 */
export function getAnchorTimeframes(entryTimeframe: string): { primary: string; secondary: string } {
  const scalping = ["M1", "M3", "M5"];
  const swing = ["M15", "M30", "H1"];
  const position = ["H2", "H4", "D1"];

  if (scalping.includes(entryTimeframe)) {
    return { primary: "H1", secondary: "M15" };
  } else if (swing.includes(entryTimeframe)) {
    return { primary: "H4", secondary: "D1" };
  } else if (position.includes(entryTimeframe)) {
    return { primary: "W1", secondary: "D1" };
  }

  // Default fallback
  return { primary: "H4", secondary: "D1" };
}
