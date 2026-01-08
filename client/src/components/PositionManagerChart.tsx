import { useState, useEffect, useRef, useCallback } from "react";
import { TradingViewAdvancedChart } from "@/components/TradingViewAdvancedChart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { 
  Target, 
  Shield, 
  TrendingUp, 
  TrendingDown, 
  Edit3, 
  Save, 
  X,
  Plus,
  Minus,
  Move,
  RotateCcw
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
}: PositionManagerChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tvWidgetRef = useRef<any>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [editingPosition, setEditingPosition] = useState<string | null>(null);
  const [showPositionPanel, setShowPositionPanel] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [newPosition, setNewPosition] = useState<Partial<Position>>({
    type: "long",
    entryPrice: 0,
    stopLoss: 0,
    takeProfit: 0,
    quantity: 1,
  });

  // Generate unique position ID
  const generatePositionId = () => `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Add new position
  const addPosition = useCallback(() => {
    if (!newPosition.entryPrice || !newPosition.type) return;

    const position: Position = {
      id: generatePositionId(),
      type: newPosition.type,
      entryPrice: newPosition.entryPrice,
      stopLoss: newPosition.stopLoss,
      takeProfit: newPosition.takeProfit,
      quantity: newPosition.quantity,
      timestamp: Date.now(),
      isActive: true,
    };

    setPositions(prev => [...prev, position]);
    onPositionUpdate?.(position);

    // Reset form
    setNewPosition({
      type: "long",
      entryPrice: 0,
      stopLoss: 0,
      takeProfit: 0,
      quantity: 1,
    });
    setShowPositionPanel(false);
  }, [newPosition, onPositionUpdate]);

  // Update position
  const updatePosition = useCallback((positionId: string, updates: Partial<Position>) => {
    setPositions(prev => 
      prev.map(pos => 
        pos.id === positionId ? { ...pos, ...updates } : pos
      )
    );
    
    const updatedPosition = positions.find(p => p.id === positionId);
    if (updatedPosition) {
      onPositionUpdate?.({ ...updatedPosition, ...updates });
    }
  }, [positions, onPositionUpdate]);

  // Delete position
  const deletePosition = useCallback((positionId: string) => {
    setPositions(prev => prev.filter(pos => pos.id !== positionId));
    setEditingPosition(null);
  }, []);

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

      {/* Position Controls Overlay */}
      <div className="absolute top-4 right-4 z-20 space-y-2">
        <Button
          onClick={() => setShowPositionPanel(!showPositionPanel)}
          size="sm"
          className="bg-primary/90 hover:bg-primary backdrop-blur-sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          Position
        </Button>
      </div>

      {/* Position Management Panel */}
      {showPositionPanel && (
        <div className="absolute top-16 right-4 z-30 w-80">
          <Card className="bg-card/95 backdrop-blur-sm border-border/50 shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm">
                Position Manager
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPositionPanel(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* New Position Form */}
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={newPosition.type === "long" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewPosition(prev => ({ ...prev, type: "long" }))}
                    className="text-xs"
                  >
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Long
                  </Button>
                  <Button
                    variant={newPosition.type === "short" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewPosition(prev => ({ ...prev, type: "short" }))}
                    className="text-xs"
                  >
                    <TrendingDown className="w-3 h-3 mr-1" />
                    Short
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Entry Price</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newPosition.entryPrice || ""}
                    onChange={(e) => setNewPosition(prev => ({ 
                      ...prev, 
                      entryPrice: parseFloat(e.target.value) || 0 
                    }))}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Stop Loss</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newPosition.stopLoss || ""}
                    onChange={(e) => setNewPosition(prev => ({ 
                      ...prev, 
                      stopLoss: parseFloat(e.target.value) || undefined 
                    }))}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Take Profit</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newPosition.takeProfit || ""}
                    onChange={(e) => setNewPosition(prev => ({ 
                      ...prev, 
                      takeProfit: parseFloat(e.target.value) || undefined 
                    }))}
                    className="text-xs"
                  />
                </div>

                <Button onClick={addPosition} className="w-full text-xs" size="sm">
                  <Save className="w-3 h-3 mr-1" />
                  Add Position
                </Button>
              </div>

              {/* Active Positions */}
              {positions.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Active Positions</Label>
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
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {position.type === "long" ? (
                              <TrendingUp className="w-3 h-3 text-green-400" />
                            ) : (
                              <TrendingDown className="w-3 h-3 text-red-400" />
                            )}
                            <Badge variant="outline" className="text-xs">
                              {position.type.toUpperCase()}
                            </Badge>
                            <Badge
                              variant={
                                status === "profitable" ? "default" :
                                status === "stopped" ? "destructive" : "secondary"
                              }
                              className="text-xs"
                            >
                              {status}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingPosition(
                              editingPosition === position.id ? null : position.id
                            )}
                            className="h-6 w-6 p-0"
                          >
                            <Edit3 className="w-3 h-3" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-1 text-xs mb-2">
                          <div>Entry: ${position.entryPrice.toFixed(2)}</div>
                          {position.stopLoss && (
                            <div className="text-red-400">
                              SL: ${position.stopLoss.toFixed(2)}
                            </div>
                          )}
                          {position.takeProfit && (
                            <div className="text-green-400">
                              TP: ${position.takeProfit.toFixed(2)}
                            </div>
                          )}
                          {riskReward && (
                            <div className="text-blue-400">
                              R:R {riskReward.toFixed(2)}
                            </div>
                          )}
                        </div>

                        <div className="flex justify-between items-center text-xs">
                          <div className={cn(
                            "font-medium",
                            pnl >= 0 ? "text-green-400" : "text-red-400"
                          )}>
                            {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                            <span className="ml-1 text-muted-foreground">
                              ({pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(1)}%)
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deletePosition(position.id)}
                            className="h-6 text-red-400 hover:text-red-300"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>

                        {/* Edit Form */}
                        {editingPosition === position.id && (
                          <div className="mt-2 pt-2 border-t border-border/30 space-y-2">
                            <Input
                              type="number"
                              placeholder="Update Stop Loss"
                              value={position.stopLoss || ""}
                              onChange={(e) => updatePosition(position.id, {
                                stopLoss: parseFloat(e.target.value) || undefined
                              })}
                              className="text-xs h-7"
                            />
                            <Input
                              type="number"
                              placeholder="Update Take Profit"
                              value={position.takeProfit || ""}
                              onChange={(e) => updatePosition(position.id, {
                                takeProfit: parseFloat(e.target.value) || undefined
                              })}
                              className="text-xs h-7"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Price Overlay */}
      <div className="absolute bottom-4 left-4 z-20">
        <Card className="bg-card/95 backdrop-blur-sm border-border/50 shadow-lg">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="text-xs text-muted-foreground">Current Price</div>
              <div className="font-mono font-bold text-lg">
                ${currentPrice.toFixed(2)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}