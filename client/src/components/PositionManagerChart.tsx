import { useState, useEffect, useRef, useCallback } from "react";
import { TradingViewAdvancedChart } from "@/components/TradingViewAdvancedChart";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Target, 
  Shield, 
  TrendingUp, 
  TrendingDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TradingPair, Timeframe } from "@shared/schema";

interface Position {
  id: string;
  type: "long" | "short";
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  quantity?: number;
  timestamp: number;
  isActive: boolean;
  analysisId?: string;
}

interface PositionManagerChartProps {
  symbol: string;
  interval: string;
  className?: string;
  minimal?: boolean;
  tradingPair?: TradingPair;
  timeframe?: Timeframe;
  onPositionUpdate?: (position: Position) => void;
  onAnalysisSync?: (position: Position, analysisData: any) => void;
  initialPositions?: Position[];
}

export function PositionManagerChart({
  symbol,
  interval,
  className,
  minimal = false,
  tradingPair,
  timeframe,
  onPositionUpdate,
  onAnalysisSync,
  initialPositions = [],
}: PositionManagerChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tvWidgetRef = useRef<any>(null);
  const [positions, setPositions] = useState<Position[]>(initialPositions);
  const [currentPrice, setCurrentPrice] = useState<number>(0);

  // Update positions when initialPositions changes
  useEffect(() => {
    setPositions(initialPositions);
  }, [initialPositions]);

  // Add position from AI analysis
  const addPositionFromAnalysis = useCallback((position: Position) => {
    setPositions(prev => [...prev, position]);
    onPositionUpdate?.(position);
  }, [onPositionUpdate]);

  // Calculate P&L for position
  const calculatePnL = useCallback((position: Position, price: number) => {
    if (position.type === "long") {
      const pnl = (price - position.entryPrice) * (position.quantity || 1);
      const pnlPercent = ((price - position.entryPrice) / position.entryPrice) * 100;
      return { pnl, pnlPercent };
    } else {
      const pnl = (position.entryPrice - price) * (position.quantity || 1);
      const pnlPercent = ((position.entryPrice - price) / position.entryPrice) * 100;
      return { pnl, pnlPercent };
    }
  }, []);

  // Get position status
  const getPositionStatus = useCallback((position: Position, price: number) => {
    if (!position.isActive) return "closed";
    
    if (position.type === "long") {
      if (position.stopLoss && price <= position.stopLoss) return "stopped";
      if (position.takeProfit && price >= position.takeProfit) return "profitable";
    } else {
      if (position.stopLoss && price >= position.stopLoss) return "stopped";
      if (position.takeProfit && price <= position.takeProfit) return "profitable";
    }
    
    return "open";
  }, []);

  // Calculate R:R ratio
  const calculateRiskReward = useCallback((position: Position) => {
    if (!position.stopLoss || !position.takeProfit) return null;
    
    if (position.type === "long") {
      const risk = position.entryPrice - position.stopLoss;
      const reward = position.takeProfit - position.entryPrice;
      return reward / risk;
    } else {
      const risk = position.stopLoss - position.entryPrice;
      const reward = position.entryPrice - position.takeProfit;
      return reward / risk;
    }
  }, []);

  // Listen for positions from analysis
  useEffect(() => {
    // Auto-add positions when they come from analysis
    if (onAnalysisSync) {
      const handleNewPosition = (position: Position, analysisData: any) => {
        addPositionFromAnalysis(position);
      };
      
      // Store reference for parent to call
      (chartContainerRef.current as any).handleAnalysisPosition = handleNewPosition;
    }
  }, [onAnalysisSync, addPositionFromAnalysis]);

  return (
    <div className={cn("relative h-full w-full", className)}>
      {/* TradingView Chart */}
      <div ref={chartContainerRef} className="h-full w-full">
        <TradingViewAdvancedChart
          symbol={symbol}
          interval={interval}
          className="h-full w-full"
          minimal={minimal}
        />
      </div>

      {/* Position Controls Overlay - REMOVED MANUAL CONTROLS */}
      {/* Positions are now automatically created from AI analysis */}

      {/* Position Management Panel - REMOVED MANUAL CONTROLS */}
      {/* All positions are now automatically created from AI analysis */}

      {/* Clean Position Display - No Manual Controls */}
      {positions.length > 0 && (
        <div className="absolute top-4 right-4 z-20 w-80 max-h-96 overflow-y-auto">
          <Card className="bg-card/95 backdrop-blur-sm border-border/50 shadow-xl">
            <CardContent className="p-3 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground mb-2">
                Active Positions ({positions.length})
              </div>
              {positions.map((position) => {
                const status = getPositionStatus(position, currentPrice);
                const { pnl, pnlPercent } = calculatePnL(position, currentPrice);
                const riskReward = calculateRiskReward(position);
                
                return (
                  <div
                    key={position.id}
                    className={cn(
                      "p-2 rounded-lg border transition-colors",
                      status === "profitable" && "border-green-500/50 bg-green-500/10",
                      status === "stopped" && "border-red-500/50 bg-red-500/10",
                      status === "open" && "border-border/50 bg-muted/20"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        {position.type === "long" ? (
                          <TrendingUp className="w-3 h-3 text-green-400" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-red-400" />
                        )}
                        <Badge variant="outline" className="text-xs px-1 py-0">
                          {position.type.toUpperCase()}
                        </Badge>
                        <Badge
                          variant={
                            status === "profitable" ? "default" :
                            status === "stopped" ? "destructive" : "secondary"
                          }
                          className="text-xs px-1 py-0"
                        >
                          {status}
                        </Badge>
                      </div>
                    </div>

                    <div className="text-xs space-y-1">
                      <div>Entry: ${position.entryPrice.toFixed(4)}</div>
                      {position.stopLoss && (
                        <div className="text-red-400">
                          SL: ${position.stopLoss.toFixed(4)}
                        </div>
                      )}
                      {position.takeProfit && (
                        <div className="text-green-400">
                          TP: ${position.takeProfit.toFixed(4)}
                        </div>
                      )}
                      {riskReward && (
                        <div className="text-blue-400">
                          R:R {riskReward.toFixed(2)}
                        </div>
                      )}
                    </div>

                    <div className={cn(
                      "text-xs font-medium mt-1",
                      pnl >= 0 ? "text-green-400" : "text-red-400"
                    )}>
                      {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                      <span className="ml-1 text-muted-foreground">
                        ({pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}