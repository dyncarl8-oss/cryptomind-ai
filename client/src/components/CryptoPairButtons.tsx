import { Button } from "@/components/ui/button";
import { type TradingPair, cryptoPairs, forexPairs } from "@shared/schema";

interface CryptoPairButtonsProps {
  onSelect: (pair: TradingPair) => void;
}

export function CryptoPairButtons({ onSelect }: CryptoPairButtonsProps) {
  return (
    <div className="flex flex-col gap-4" data-testid="crypto-pair-buttons">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Crypto Pairs</h3>
        <div className="flex gap-2 flex-wrap">
          {cryptoPairs.map((pair) => (
            <Button
              key={pair}
              variant="secondary"
              size="sm"
              onClick={() => onSelect(pair)}
              className="rounded-full font-medium"
              data-testid={`button-crypto-${pair.toLowerCase().replace("/", "-")}`}
            >
              {pair}
            </Button>
          ))}
        </div>
      </div>
      
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Forex Pairs</h3>
        <div className="flex gap-2 flex-wrap">
          {forexPairs.map((pair) => (
            <Button
              key={pair}
              variant="secondary"
              size="sm"
              onClick={() => onSelect(pair)}
              className="rounded-full font-medium"
              data-testid={`button-forex-${pair.toLowerCase().replace("/", "-")}`}
            >
              {pair}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
