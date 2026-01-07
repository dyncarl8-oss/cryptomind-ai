import { Button } from "@/components/ui/button";
import { timeframes, timeframeLabels, type Timeframe } from "@shared/schema";
import { Clock } from "lucide-react";

interface TimeframeSelectorProps {
  onSelectTimeframe: (timeframe: Timeframe) => void;
  selectedTimeframe?: Timeframe;
}

export function TimeframeSelector({ onSelectTimeframe, selectedTimeframe }: TimeframeSelectorProps) {
  return (
    <div className="space-y-4 md:space-y-5 p-4 md:p-5 rounded-xl bg-card/40 border border-card-border/50 backdrop-blur-sm" data-testid="timeframe-selector">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-5 h-5 text-primary" />
        <div className="text-sm md:text-base font-bold text-foreground">Select Trading Timeframe</div>
      </div>
      
      <div className="space-y-2.5 md:space-y-3">
        <div className="text-xs md:text-sm font-bold text-foreground/80 uppercase tracking-wider">Quick Scalping</div>
        <div className="flex flex-wrap gap-2 md:gap-2.5 lg:gap-3">
          {["SECONDS", "M1", "M3"].map((tf) => {
            const timeframe = tf as Timeframe;
            return (
              <Button
                key={timeframe}
                variant={selectedTimeframe === timeframe ? "default" : "outline"}
                size="sm"
                onClick={() => onSelectTimeframe(timeframe)}
                className="text-xs md:text-sm"
                data-testid={`button-timeframe-${timeframe}`}
              >
                {timeframeLabels[timeframe]}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2.5 md:space-y-3">
        <div className="text-xs md:text-sm font-bold text-foreground/80 uppercase tracking-wider">Swing Trading</div>
        <div className="flex flex-wrap gap-2 md:gap-2.5 lg:gap-3">
          {["M5", "M15", "M30", "H1"].map((tf) => {
            const timeframe = tf as Timeframe;
            return (
              <Button
                key={timeframe}
                variant={selectedTimeframe === timeframe ? "default" : "outline"}
                size="sm"
                onClick={() => onSelectTimeframe(timeframe)}
                className="text-xs md:text-sm"
                data-testid={`button-timeframe-${timeframe}`}
              >
                {timeframeLabels[timeframe]}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2.5 md:space-y-3">
        <div className="text-xs md:text-sm font-bold text-foreground/80 uppercase tracking-wider">Position Trading</div>
        <div className="flex flex-wrap gap-2 md:gap-2.5 lg:gap-3">
          {["H2", "H4", "H8", "D1", "W1"].map((tf) => {
            const timeframe = tf as Timeframe;
            return (
              <Button
                key={timeframe}
                variant={selectedTimeframe === timeframe ? "default" : "outline"}
                size="sm"
                onClick={() => onSelectTimeframe(timeframe)}
                className="text-xs md:text-sm"
                data-testid={`button-timeframe-${timeframe}`}
              >
                {timeframeLabels[timeframe]}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
