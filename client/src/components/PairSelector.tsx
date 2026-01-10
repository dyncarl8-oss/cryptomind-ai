import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  cryptoPairs,
  forexPairs,
  commoditiesPairs,
  indicesPairs,
  type TradingPair
} from "@shared/schema";

interface PairSelectorProps {
  onSelectPair: (pair: TradingPair) => void;
  selectedPair?: TradingPair;
}

export function PairSelector({ onSelectPair, selectedPair }: PairSelectorProps) {
  return (
    <div className="space-y-4 md:space-y-5 p-4 md:p-5 rounded-xl bg-card/40 border border-card-border/50 backdrop-blur-sm" data-testid="pair-selector">
      <div className="space-y-2.5 md:space-y-3">
        <div className="text-xs md:text-sm font-bold text-foreground/80 uppercase tracking-wider">Crypto</div>
        <div className="flex flex-wrap gap-2 md:gap-2.5 lg:gap-3">
          {cryptoPairs.map((pair) => (
            <Button
              key={pair}
              variant={selectedPair === pair ? "default" : "outline"}
              size="sm"
              onClick={() => onSelectPair(pair)}
              className="text-xs md:text-sm"
              data-testid={`button-pair-${pair.replace('/', '-')}`}
            >
              {pair}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5 md:space-y-3">
        <div className="text-xs md:text-sm font-bold text-foreground/80 uppercase tracking-wider">Forex</div>
        <div className="flex flex-wrap gap-2 md:gap-2.5 lg:gap-3">
          {forexPairs.map((pair) => (
            <Button
              key={pair}
              variant={selectedPair === pair ? "default" : "outline"}
              size="sm"
              onClick={() => onSelectPair(pair)}
              className="text-xs md:text-sm"
              data-testid={`button-pair-${pair.replace('/', '-')}`}
            >
              {pair}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5 md:space-y-3">
        <div className="text-xs md:text-sm font-bold text-foreground/80 uppercase tracking-wider">Commodities</div>
        <div className="flex flex-wrap gap-2 md:gap-2.5 lg:gap-3">
          {commoditiesPairs.map((pair) => (
            <Button
              key={pair}
              variant={selectedPair === pair ? "default" : "outline"}
              size="sm"
              onClick={() => onSelectPair(pair)}
              className="text-xs md:text-sm"
              data-testid={`button-pair-${pair.replace('/', '-')}`}
            >
              {pair}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5 md:space-y-3">
        <div className="text-xs md:text-sm font-bold text-foreground/80 uppercase tracking-wider">Indices</div>
        <div className="flex flex-wrap gap-2 md:gap-2.5 lg:gap-3">
          {indicesPairs.map((pair) => (
            <Button
              key={pair}
              variant={selectedPair === pair ? "default" : "outline"}
              size="sm"
              onClick={() => onSelectPair(pair)}
              className="text-xs md:text-sm"
              data-testid={`button-pair-${pair.replace('/', '-')}`}
            >
              {pair}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
