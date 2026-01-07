import { PredictionCard } from "../PredictionCard";

const upPrediction = {
  pair: "BTC/USDT" as const,
  direction: "UP" as const,
  confidence: 82,
  duration: "45 seconds",
};

const downPrediction = {
  pair: "ETH/USDT" as const,
  direction: "DOWN" as const,
  confidence: 67,
  duration: "1 minute",
};

export default function PredictionCardExample() {
  return (
    <div className="space-y-4 p-4 bg-background max-w-md">
      <PredictionCard prediction={upPrediction} />
      <PredictionCard prediction={downPrediction} />
    </div>
  );
}
