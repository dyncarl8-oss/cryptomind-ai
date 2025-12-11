import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, MinusIcon } from "@heroicons/react/24/solid";
import { Badge } from "@/components/ui/badge";

interface PredictionCardProps {
  prediction: {
    pair: string;
    direction: "UP" | "DOWN" | "NEUTRAL";
    confidence: number;
    duration: string;
  };
}

export function PredictionCard({ prediction }: PredictionCardProps) {
  const isUp = prediction.direction === "UP";
  const isDown = prediction.direction === "DOWN";
  const isNeutral = prediction.direction === "NEUTRAL";

  return (
    <div
      className={`rounded-xl p-5 backdrop-blur-sm transition-all border ${
        isNeutral 
          ? "border-border/40 bg-card/40" 
          : "border-accent/30 bg-gradient-to-br from-accent/10 to-transparent"
      }`}
      data-testid="prediction-card"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {isUp && (
            <div className="w-10 h-10 rounded-lg bg-chart-2/20 border border-chart-2/30 flex items-center justify-center">
              <ArrowTrendingUpIcon className="w-5 h-5 text-chart-2" />
            </div>
          )}
          {isDown && (
            <div className="w-10 h-10 rounded-lg bg-destructive/20 border border-destructive/30 flex items-center justify-center">
              <ArrowTrendingDownIcon className="w-5 h-5 text-destructive" />
            </div>
          )}
          {isNeutral && (
            <div className="w-10 h-10 rounded-lg bg-muted/20 border border-border/40 flex items-center justify-center">
              <MinusIcon className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <div className="text-2xl font-black tracking-tight">
              {isNeutral ? "No actionable signal" : prediction.direction}
            </div>
            <div className="text-xs text-muted-foreground/70">
              {prediction.duration}
            </div>
          </div>
        </div>
        
        <div className={`text-2xl font-bold ${
          isUp ? "text-chart-2" : isDown ? "text-destructive" : "text-muted-foreground"
        }`}>
          {prediction.confidence}%
        </div>
      </div>
    </div>
  );
}
