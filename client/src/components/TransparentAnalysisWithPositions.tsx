import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronUp,
  Database,
  LineChart,
  Scale,
  Brain,
  CheckCircle2,
  Loader2,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
} from "lucide-react";
import type {
  AnalysisStage,
  TechnicalIndicatorDetail,
  MarketDataSnapshot,
  SignalAggregationData,
  AIThinkingData,
  FinalVerdictData,
  TradingPair,
  Timeframe,
} from "@shared/schema";
import { PositionManagerChart } from "@/components/PositionManagerChart";

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

interface TransparentAnalysisWithPositionsProps {
  stages: AnalysisStage[];
  tradingPair?: TradingPair;
  timeframe?: Timeframe;
  onStageComplete?: (stage: string) => void;
  isLoadedSession?: boolean;
  onPositionSync?: (position: Position, analysisData: FinalVerdictData) => void;
}

const stageConfig = {
  data_collection: {
    icon: Database,
    title: "Data Collection",
    description: "Fetching live market data from Binance",
    gradient: "from-blue-500 to-cyan-500",
    color: "text-blue-400",
  },
  technical_calculation: {
    icon: LineChart,
    title: "Technical Analysis",
    description: "Computing 23+ technical indicators",
    gradient: "from-purple-500 to-pink-500",
    color: "text-purple-400",
  },
  signal_aggregation: {
    icon: Scale,
    title: "Signal Aggregation",
    description: "Weighing all signals for optimal confidence",
    gradient: "from-orange-500 to-red-500",
    color: "text-orange-400",
  },
  ai_thinking: {
    icon: Brain,
    title: "AI Deep Analysis",
    description: "Gemini 3 Pro analyzing market conditions",
    gradient: "from-pink-500 to-rose-500",
    color: "text-pink-400",
  },
  final_verdict: {
    icon: Sparkles,
    title: "Final Verdict",
    description: "Generating high-confidence prediction",
    gradient: "from-green-500 to-emerald-500",
    color: "text-green-400",
  },
};

const timeframeToTradingViewInterval: Record<Timeframe, string> = {
  M1: "1",
  M3: "3",
  M5: "5",
  M15: "15",
  M30: "30",
  M45: "45",
  H1: "60",
  H2: "120",
  H3: "180",
  H4: "240",
  D1: "D",
  W1: "W",
};

function toTradingViewSymbol(pair?: TradingPair): string {
  if (!pair) return "BINANCE:BTCUSDT";
  const [base, quote] = pair.split("/");
  if (!base || !quote) return pair;

  if (quote === "USDT") {
    return `BINANCE:${base}${quote}`;
  }

  if (quote === "USD") {
    return `FX:${base}${quote}`;
  }

  return `${base}${quote}`;
}

function getPriceDecimals(price?: number) {
  if (price === undefined) return 2;
  if (price >= 100) return 2;
  if (price >= 10) return 3;
  if (price >= 1) return 4;
  return 6;
}

function formatPrice(value: number, decimals: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatRange(low: number, high: number, decimals: number) {
  return `${formatPrice(low, decimals)} - ${formatPrice(high, decimals)}`;
}

function StageIndicator({ stage }: { stage: AnalysisStage }) {
  const config = stageConfig[stage.stage];
  const Icon = config.icon;
  const isComplete = stage.status === "complete";
  const isInProgress = stage.status === "in_progress";
  const isAiThinkingStage = stage.stage === "ai_thinking";
  const isFinalVerdictStage = stage.stage === "final_verdict";
  const hasFinalVerdictData = isFinalVerdictStage && stage.data;

  // Don't show spinner for final_verdict if we have data, even if status isn't complete yet
  const shouldShowSpinner = isInProgress && !isAiThinkingStage && !(isFinalVerdictStage && hasFinalVerdictData);

  return (
    <div className="space-y-3 animate-slide-up" data-testid={`analysis-stage-${stage.stage}`}>
      <div className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/40 backdrop-blur-sm transition-all duration-300">
        <div className="flex items-center gap-4 flex-1">
          <div className={`relative`}>
            {shouldShowSpinner ? (
              <div className="relative">
                <Loader2 className={`w-6 h-6 animate-spin ${config.color}`} />
                <div className="absolute inset-0 blur-md opacity-50">
                  <Loader2 className={`w-6 h-6 animate-spin ${config.color}`} />
                </div>
              </div>
            ) : (
              <div className="relative">
                <Icon className={`w-6 h-6 ${isComplete || hasFinalVerdictData ? 'text-green-400' : config.color}`} />
                {(isComplete || hasFinalVerdictData) && (
                  <div className="absolute inset-0 blur-md opacity-50">
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="font-bold text-base mb-1">{config.title}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              {config.description}
              {stage.duration && (
                <Badge variant="outline" className="text-xs px-2 py-0.5">
                  {(stage.duration / 1000).toFixed(1)}s
                </Badge>
              )}
            </div>
          </div>
        </div>
        {(isComplete || hasFinalVerdictData) && (
          <CheckCircle2 className="w-5 h-5 text-green-400" />
        )}
      </div>
      <Progress
        value={stage.progress}
        className={`h-2 ${isInProgress && !hasFinalVerdictData ? 'animate-pulse' : ''}`}
      />
    </div>
  );
}

function MarketDataDisplay({ data }: { data: MarketDataSnapshot }) {
  return (
    <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-card/50 border border-border/40 backdrop-blur-sm">
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground font-medium">Current Price</div>
        <div className="font-mono font-bold text-2xl glow-text">
          ${data.currentPrice.toFixed(2)}
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground font-medium">24h Change</div>
        <div
          className={`font-mono font-bold text-2xl flex items-center gap-2 ${data.priceChange24h >= 0 ? "text-green-400" : "text-red-400"}`}
        >
          {data.priceChange24h >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          {data.priceChange24h >= 0 ? "+" : ""}
          {data.priceChange24h.toFixed(2)}%
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground font-medium">Volume Change</div>
        <div
          className={`font-mono font-semibold text-lg ${data.volumeChange24h >= 0 ? "text-green-400" : "text-red-400"}`}
        >
          {data.volumeChange24h >= 0 ? "+" : ""}
          {data.volumeChange24h.toFixed(1)}%
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-xs text-muted-foreground font-medium">Data Points</div>
        <div className="font-mono font-semibold text-lg text-primary">
          {data.candlesRetrieved} candles
        </div>
      </div>
    </div>
  );
}

function TechnicalIndicatorsDisplay({
  indicators,
}: {
  indicators: TechnicalIndicatorDetail[];
}) {
  const categories = ["MOMENTUM", "TREND", "VOLATILITY", "VOLUME"];

  return (
    <div className="space-y-5">
      {categories.map((category) => {
        const categoryIndicators = indicators.filter((i) => i.category === category);
        if (categoryIndicators.length === 0) return null;

        return (
          <div key={category} className="space-y-3">
            <div className="text-sm font-bold uppercase tracking-wide bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {category} INDICATORS
            </div>
            <div className="space-y-2">
              {categoryIndicators.map((indicator, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg bg-card/40 border border-border/30 backdrop-blur-sm transition-all duration-200"
                  data-testid={`indicator-${indicator.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm">{indicator.name}</span>
                      <Badge
                        variant={
                          indicator.signal === "UP"
                            ? "default"
                            : indicator.signal === "DOWN"
                              ? "destructive"
                              : "secondary"
                        }
                        className="text-xs px-2"
                      >
                        {indicator.signal}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{indicator.description}</div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="font-mono text-base font-bold text-primary">{indicator.value}</div>
                    <div className="text-xs text-muted-foreground">Strength: {indicator.strength}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SignalAggregationDisplay({ data }: { data: SignalAggregationData }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 backdrop-blur-sm">
          <div className="text-3xl font-black text-green-400 mb-1">{data.upSignalsCount}</div>
          <div className="text-xs font-medium text-green-300">UP Signals</div>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-red-500/10 to-rose-500/10 border border-red-500/30 backdrop-blur-sm">
          <div className="text-3xl font-black text-red-400 mb-1">{data.downSignalsCount}</div>
          <div className="text-xs font-medium text-red-300">DOWN Signals</div>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-muted/50 to-muted border border-border/40 backdrop-blur-sm">
          <div className="text-3xl font-black mb-1">{data.neutralSignalsCount}</div>
          <div className="text-xs font-medium text-muted-foreground">Neutral</div>
        </div>
      </div>

      <div className="space-y-3 p-4 rounded-xl bg-card/50 border border-border/40 backdrop-blur-sm">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">UP Score</span>
          <span className="font-mono font-bold text-lg text-green-400">
            {data.upScore.toFixed(1)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">DOWN Score</span>
          <span className="font-mono font-bold text-lg text-red-400">
            {data.downScore.toFixed(1)}
          </span>
        </div>
        <div className="h-px bg-border my-2" />
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Signal Alignment</span>
          <span className="font-mono font-bold text-xl text-primary">
            {data.signalAlignment.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Market Regime</span>
          <Badge variant="outline" className="font-semibold">{data.marketRegime}</Badge>
        </div>
      </div>
    </div>
  );
}

function AIThinkingDisplay({ data, onComplete, isLoadedSession }: { data: AIThinkingData; onComplete?: () => void; isLoadedSession?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const isTypingRef = useRef(false);
  const targetTextRef = useRef("");
  const userScrolledRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const completedRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  // Cleanup function to cancel any in-flight animations
  const cleanupAnimation = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsTyping(false);
    isTypingRef.current = false;
  };

  useEffect(() => {
    if (!data.thinkingProcess) {
      setDisplayedText("");
      cleanupAnimation();
      targetTextRef.current = "";
      completedRef.current = false;
      return;
    }

    if (targetTextRef.current !== data.thinkingProcess) {
      targetTextRef.current = data.thinkingProcess;
      completedRef.current = false;
    }

    if (isTypingRef.current) {
      return;
    }

    if (isLoadedSession) {
      setDisplayedText(data.thinkingProcess);
      cleanupAnimation();
      if (!completedRef.current) {
        completedRef.current = true;
        // Use setTimeout to ensure proper state update order
        setTimeout(() => {
          onComplete?.();
        }, 0);
      }
      return;
    }

    if (displayedText.length < data.thinkingProcess.length) {
      isTypingRef.current = true;
      setIsTyping(true);
      
      const startLength = displayedText.length;
      let currentIndex = startLength;

      const typeNextChar = () => {
        if (currentIndex < targetTextRef.current.length && isTypingRef.current) {
          const charsToAdd = Math.min(3, targetTextRef.current.length - currentIndex);
          currentIndex += charsToAdd;
          const nextText = targetTextRef.current.slice(0, currentIndex);
          setDisplayedText(nextText);
          
          if (!userScrolledRef.current && containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
          }
          
          animationFrameRef.current = requestAnimationFrame(typeNextChar);
        } else if (isTypingRef.current) {
          cleanupAnimation();
          if (!completedRef.current) {
            completedRef.current = true;
            onComplete?.();
          }
        }
      };

      animationFrameRef.current = requestAnimationFrame(typeNextChar);
    }
  }, [data.thinkingProcess, displayedText.length, isLoadedSession]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 10;
    
    userScrolledRef.current = !isAtBottom;
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      if (isAtBottom) {
        userScrolledRef.current = false;
      }
    }, 1000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 rounded-xl bg-card/50 border border-border/40 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-pink-400 animate-pulse" />
          <span className="font-bold text-sm">AI Thought Process</span>
        </div>
        <Badge variant="outline" className="font-semibold text-xs bg-gradient-to-r from-pink-500/10 to-purple-500/10 border-pink-500/30">
          {data.modelUsed}
        </Badge>
      </div>
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="p-5 rounded-xl bg-card/50 border border-primary/30 backdrop-blur-sm max-h-80 overflow-y-auto scroll-smooth"
      >
        <div className="text-sm font-mono leading-relaxed whitespace-pre-wrap">
          {displayedText || "AI is analyzing..."}
          {isTyping && displayedText && <span className="animate-pulse text-primary ml-1">▊</span>}
        </div>
      </div>
    </div>
  );
}

function FinalVerdictDisplay({
  data,
  tradingPair,
  timeframe,
  onPositionCreate,
}: {
  data: FinalVerdictData;
  tradingPair?: TradingPair;
  timeframe?: Timeframe;
  onPositionCreate?: (direction: "long" | "short", entry: number, stopLoss?: number, takeProfit?: number) => void;
}) {
  const symbol = toTradingViewSymbol(tradingPair);
  const interval = timeframe
    ? timeframeToTradingViewInterval[timeframe]
    : timeframeToTradingViewInterval.M15;

  const isActionable = data.direction !== "NEUTRAL";

  // Create position from analysis
  const handleCreatePosition = (direction: "long" | "short") => {
    if (!data.tradeTargets || !isActionable) return;

    const { entry, target, stop } = data.tradeTargets;
    const entryAvg = (entry.low + entry.high) / 2;
    const targetAvg = (target.low + target.high) / 2;
    const stopAvg = (stop.low + stop.high) / 2;

    onPositionCreate?.(direction, entryAvg, stopAvg, targetAvg);
  };

  return (
    <div className="space-y-4" data-testid="final-verdict-display">
      <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-gradient-to-br from-primary/10 via-accent/10 to-primary/10 border border-primary/30 backdrop-blur-sm">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Direction
          </div>
          <div className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {data.direction}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Confidence
          </div>
          <div className="text-2xl sm:text-3xl font-black text-green-400">
            {data.confidence}%
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Duration
          </div>
          <div className="text-xl sm:text-2xl font-bold text-primary">{data.duration}</div>
        </div>
      </div>

      {data.explanation && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/5 via-cyan-500/5 to-blue-500/5 border border-blue-500/20 backdrop-blur-sm">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{data.explanation}</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm font-bold uppercase tracking-wide bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Trade Targets
          </div>
          {isActionable && data.tradeTargets ? (
            <div className="grid grid-cols-1 gap-3">
              <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-green-500/10 border border-green-500/30 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-green-400" />
                    <span className="font-bold text-sm">Entry Zone</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {formatRange(data.tradeTargets.entry.low, data.tradeTargets.entry.high, 4)}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Long Entry:</span>
                    <div className="font-mono font-bold">
                      {formatRange(data.tradeTargets.entry.low, data.tradeTargets.entry.high, 4)}
                    </div>
                  </div>
                  {data.direction === "DOWN" && (
                    <div>
                      <span className="text-muted-foreground">Short Entry:</span>
                      <div className="font-mono font-bold">
                        {formatRange(data.tradeTargets.entry.low, data.tradeTargets.entry.high, 4)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-green-500/10 border border-green-500/30 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="font-bold text-sm">Take Profit</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {formatRange(data.tradeTargets.target.low, data.tradeTargets.target.high, 4)}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Target range with optimal R:R ratio
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gradient-to-br from-red-500/10 via-rose-500/10 to-red-500/10 border border-red-500/30 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-red-400" />
                    <span className="font-bold text-sm">Stop Loss</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {formatRange(data.tradeTargets.stop.low, data.tradeTargets.stop.high, 4)}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Risk management level
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-muted/30 border border-border/40 backdrop-blur-sm text-center">
              <div className="text-muted-foreground text-sm">No actionable trade signals</div>
            </div>
          )}
        </div>

        {/* Quick Position Creation Buttons */}
        {isActionable && data.tradeTargets && (
          <div className="flex gap-2">
            {data.direction === "UP" && (
              <button
                onClick={() => handleCreatePosition("long")}
                className="flex-1 p-3 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 hover:from-green-500/30 hover:to-emerald-500/30 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-bold text-green-400 hover:text-green-300"
              >
                <TrendingUp className="w-4 h-4" />
                Create Long Position
              </button>
            )}
            {data.direction === "DOWN" && (
              <button
                onClick={() => handleCreatePosition("short")}
                className="flex-1 p-3 rounded-xl bg-gradient-to-r from-red-500/20 to-rose-500/20 border border-red-500/30 hover:from-red-500/30 hover:to-rose-500/30 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-bold text-red-400 hover:text-red-300"
              >
                <TrendingDown className="w-4 h-4" />
                Create Short Position
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function TransparentAnalysisWithPositions({
  stages,
  tradingPair,
  timeframe,
  onStageComplete,
  isLoadedSession,
  onPositionSync,
}: TransparentAnalysisWithPositionsProps) {
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [analysisData, setAnalysisData] = useState<FinalVerdictData | null>(null);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(["final_verdict"]));

  // Get the final verdict data when available
  useEffect(() => {
    const finalVerdictStage = stages.find(stage => stage.stage === "final_verdict");
    if (finalVerdictStage?.data) {
      setAnalysisData(finalVerdictStage.data);
    }
  }, [stages]);

  // Handle position creation from analysis
  const handlePositionCreate = (
    direction: "long" | "short",
    entry: number,
    stopLoss?: number,
    takeProfit?: number
  ) => {
    if (!analysisData) return;

    const position: Position = {
      id: `analysis_${Date.now()}`,
      type: direction,
      entryPrice: entry,
      stopLoss,
      takeProfit,
      quantity: 1,
      timestamp: Date.now(),
      isActive: true,
      analysisId: "current_analysis",
    };

    // Sync with parent component
    onPositionSync?.(position, analysisData);
  };

  const symbol = toTradingViewSymbol(tradingPair);
  const interval = timeframe
    ? timeframeToTradingViewInterval[timeframe]
    : timeframeToTradingViewInterval.M15;

  return (
    <div className="space-y-6">
      {/* Enhanced Chart with Position Management */}
      <div className="h-[600px] w-full">
        <PositionManagerChart
          symbol={symbol}
          interval={interval}
          className="h-full w-full"
          tradingPair={tradingPair}
          timeframe={timeframe}
          onPositionUpdate={(position) => {
            console.log("Position updated:", position);
          }}
          onAnalysisSync={(position, analysisData) => {
            onPositionSync?.(position, analysisData);
          }}
        />
      </div>

      {/* Analysis Stages */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {stages.map((stage, index) => {
            const isExpanded = expandedStages.has(stage.stage);
            const config = stageConfig[stage.stage];
            const Icon = config.icon;

            return (
              <Collapsible
                key={stage.stage}
                open={isExpanded}
                onOpenChange={(open) => {
                  const newExpanded = new Set(expandedStages);
                  if (open) {
                    newExpanded.add(stage.stage);
                  } else {
                    newExpanded.delete(stage.stage);
                  }
                  setExpandedStages(newExpanded);
                }}
              >
                <CollapsibleTrigger className="w-full">
                  <StageIndicator stage={stage} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4">
                  <div className="ml-12 space-y-4">
                    {stage.stage === "data_collection" && stage.data && (
                      <MarketDataDisplay data={stage.data} />
                    )}
                    {stage.stage === "technical_calculation" && stage.data && (
                      <TechnicalIndicatorsDisplay indicators={stage.data.indicators} />
                    )}
                    {stage.stage === "signal_aggregation" && stage.data && (
                      <SignalAggregationDisplay data={stage.data} />
                    )}
                    {stage.stage === "ai_thinking" && stage.data && (
                      <AIThinkingDisplay
                        data={stage.data}
                        onComplete={() => onStageComplete?.("ai_thinking")}
                        isLoadedSession={isLoadedSession}
                      />
                    )}
                    {stage.stage === "final_verdict" && stage.data && (
                      <FinalVerdictDisplay
                        data={stage.data}
                        tradingPair={tradingPair}
                        timeframe={timeframe}
                        onPositionCreate={handlePositionCreate}
                      />
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        {/* Quick Stats Sidebar */}
        <div className="space-y-4">
          <Card className="bg-card/50 border-border/40 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Analysis Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stages.map((stage) => {
                const config = stageConfig[stage.stage];
                const Icon = config.icon;
                const isComplete = stage.status === "complete";
                const isFinalVerdict = stage.stage === "final_verdict";
                const hasData = stage.data && 
                  ((isFinalVerdict && stage.data) || (!isFinalVerdict && Object.keys(stage.data).length > 0));

                return (
                  <div key={stage.stage} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${isComplete ? 'text-green-400' : 'text-muted-foreground'}`} />
                      <span className="text-sm">{config.title}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {hasData && (
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                      )}
                      {isComplete && (
                        <CheckCircle2 className="w-3 h-3 text-green-400" />
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {analysisData && (
            <Card className="bg-card/50 border-border/40 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Quick Trade</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center">
                  <div className="text-2xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
                    {analysisData.direction}
                  </div>
                  <div className="text-lg font-bold text-green-400 mb-3">
                    {analysisData.confidence}% Confidence
                  </div>
                  {analysisData.tradeTargets && isActionable && (
                    <div className="space-y-2">
                      {analysisData.direction === "UP" && (
                        <button
                          onClick={() => handlePositionCreate(
                            "long",
                            (analysisData.tradeTargets.entry.low + analysisData.tradeTargets.entry.high) / 2,
                            (analysisData.tradeTargets.stop.low + analysisData.tradeTargets.stop.high) / 2,
                            (analysisData.tradeTargets.target.low + analysisData.tradeTargets.target.high) / 2
                          )}
                          className="w-full p-2 rounded-lg bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 hover:from-green-500/30 hover:to-emerald-500/30 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-bold text-green-400"
                        >
                          <TrendingUp className="w-4 h-4" />
                          Long {analysisData.direction}
                        </button>
                      )}
                      {analysisData.direction === "DOWN" && (
                        <button
                          onClick={() => handlePositionCreate(
                            "short",
                            (analysisData.tradeTargets.entry.low + analysisData.tradeTargets.entry.high) / 2,
                            (analysisData.tradeTargets.stop.low + analysisData.tradeTargets.stop.high) / 2,
                            (analysisData.tradeTargets.target.low + analysisData.tradeTargets.target.high) / 2
                          )}
                          className="w-full p-2 rounded-lg bg-gradient-to-r from-red-500/20 to-rose-500/20 border border-red-500/30 hover:from-red-500/30 hover:to-rose-500/30 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-bold text-red-400"
                        >
                          <TrendingDown className="w-4 h-4" />
                          Short {analysisData.direction}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}