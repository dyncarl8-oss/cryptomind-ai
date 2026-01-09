import { type TradingPair } from "@shared/schema";
import { generateAIPrediction, type Prediction as AIPrediction } from "./ai-prediction";

export interface Prediction {
  pair: TradingPair;
  direction: "UP" | "DOWN" | "NEUTRAL";
  confidence: number;
  duration: string;
  analysis?: string;
}

export async function generatePrediction(pair: TradingPair): Promise<Prediction> {
  // Use real AI-powered prediction with live market data
  const prediction = await generateAIPrediction(pair);
  return prediction;
}
