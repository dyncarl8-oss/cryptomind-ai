import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, MinusIcon } from "@heroicons/react/24/solid";
import { Badge } from "@/components/ui/badge";

interface PredictionCardProps {
  prediction: {
    pair: string;
    direction: "UP" | "DOWN" | "NEUTRAL";
    confidence: number;
    duration: string;
    tradeTargets?: {
      entry: { low: number; high: number };
      target: { low: number; high: number };
      stop: number;
    };
  };
}

function getPriceDecimals(price: number) {
  if (price >= 100) return 2;
  if (price >= 10) return 3;
  if (price >= 1) return 4;
  if (price >= 0.1) return 5;
  if (price >= 0.01) return 6;
  if (price >= 0.001) return 7;
  if (price >= 0.0001) return 8;
  if (price >= 0.00001) return 9;
  return 10;
}

function formatPrice(value: number, decimals: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function PredictionCard({ prediction }: PredictionCardProps) {
  const isUp = prediction.direction === "UP";
  const isDown = prediction.direction === "DOWN";
  const isNeutral = prediction.direction === "NEUTRAL";

  const priceDecimals = prediction.tradeTargets
    ? getPriceDecimals(prediction.tradeTargets.entry.low)
    : 2;

  return (
    <div
      className={`rounded-xl p-5 backdrop-blur-sm transition-all border ${
        isNeutral 
          ? "border-border/40 bg-card/40" 
          : "border-accent/30 bg-gradient-to-br from-accent/10 to-transparent shadow-lg shadow-accent/5"
      }`}
      data-testid="prediction-card"
    >
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          {isUp && (
            <div className="w-10 h-10 rounded-lg bg-chart-2/20 border border-chart-2/30 flex items-center justify-center shadow-inner">
              <ArrowTrendingUpIcon className="w-5 h-5 text-chart-2" />
            </div>
          )}
          {isDown && (
            <div className="w-10 h-10 rounded-lg bg-destructive/20 border border-destructive/30 flex items-center justify-center shadow-inner">
              <ArrowTrendingDownIcon className="w-5 h-5 text-destructive" />
            </div>
          )}
          {isNeutral && (
            <div className="w-10 h-10 rounded-lg bg-muted/20 border border-border/40 flex items-center justify-center shadow-inner">
              <MinusIcon className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <div className="text-2xl font-black tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {isNeutral ? "No actionable signal" : prediction.direction}
            </div>
            <div className="text-xs text-muted-foreground/70 font-medium">
              {prediction.duration}
            </div>
          </div>
        </div>
        
        <div className={`text-2xl font-black ${
          isUp ? "text-chart-2" : isDown ? "text-destructive" : "text-muted-foreground"
        } glow-text`}>
          {prediction.confidence}%
        </div>
      </div>

      {!isNeutral && prediction.tradeTargets && (
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border/40">
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Entry</div>
            <div className="font-mono text-xs font-bold">
              {formatPrice(prediction.tradeTargets.entry.low, priceDecimals)}-{formatPrice(prediction.tradeTargets.entry.high, priceDecimals)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Target</div>
            <div className="font-mono text-xs font-bold text-chart-2">
              {formatPrice(prediction.tradeTargets.target.low, priceDecimals)}-{formatPrice(prediction.tradeTargets.target.high, priceDecimals)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Stop</div>
            <div className="font-mono text-xs font-bold text-destructive">
              {formatPrice(prediction.tradeTargets.stop, priceDecimals)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
