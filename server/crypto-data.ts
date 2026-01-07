import { type TradingPair } from "@shared/schema";

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
    "SECONDS": 1,
    "M1": 1,
    "M3": 3,
    "M5": 5,
    "M15": 15,
    "M30": 30,
    "H1": 60,
    "H2": 120,
    "H4": 240,
    "H8": 480,
    "D1": 1440,
    "W1": 10080,
  };
  return mapping[timeframe] || 5;
};

const getHistoEndpoint = (timeframe: string): { endpoint: string; aggregate: number; limit: number } => {
  // Use histominute for short timeframes with standard aggregates
  if (["SECONDS", "M1", "M3", "M5", "M15", "M30"].includes(timeframe)) {
    const minutes = timeframeToMinutes(timeframe);
    return { endpoint: "histominute", aggregate: minutes, limit: 100 };
  }
  
  // Use histohour for hour-based timeframes (within API limits)
  // Note: limit * aggregate must be <= 2000 to avoid API reduction
  if (["H1", "H2", "H4", "H8"].includes(timeframe)) {
    const hours = timeframeToMinutes(timeframe) / 60;
    return { endpoint: "histohour", aggregate: hours, limit: 100 };
  }
  
  // For daily timeframe, use histoday endpoint with daily aggregation
  // This gives us proper daily candles instead of aggregated hourly data
  if (["D1"].includes(timeframe)) {
    return { endpoint: "histoday", aggregate: 1, limit: 100 };
  }
  
  // For weekly, use histoday with 7-day aggregate for true weekly bars
  // Using histoday with aggregate 7 gives us weekly candles within API limits
  if (["W1"].includes(timeframe)) {
    return { endpoint: "histoday", aggregate: 7, limit: 100 };
  }
  
  // Default to histominute with 1 minute
  return { endpoint: "histominute", aggregate: 1, limit: 100 };
};

export async function fetchMarketData(pair: TradingPair, timeframe: string = "SECONDS"): Promise<MarketData> {
  const { from, to } = pairToSymbols(pair);
  
  try {
    console.log(`[CryptoCompare API] Fetching market data for ${pair} (${from}/${to})`);
    
    // Fetch current price
    const priceResponse = await fetch(
      `${CRYPTOCOMPARE_API_BASE}/price?fsym=${from}&tsyms=${to}`,
      { headers: fetchHeaders }
    );
    
    if (!priceResponse.ok) {
      const errorText = await priceResponse.text();
      console.error(`[CryptoCompare API] Price error - Status: ${priceResponse.status}, Body: ${errorText}`);
      throw new Error(`Failed to fetch price for ${pair}: Status ${priceResponse.status}`);
    }
    
    const priceData = await priceResponse.json();
    const currentPrice = priceData[to];
    
    if (!currentPrice) {
      throw new Error(`Price data not available for ${pair}`);
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
    if (candles.length < 100) {
      const needed = 100 - candles.length;
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
