import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Info,
  Settings2,
  Edit3,
  Save,
  X,
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

interface TransparentAnalysisProps {
  stages: AnalysisStage[];
  tradingPair?: TradingPair;
  timeframe?: Timeframe;
  onStageComplete?: (stage: string) => void;
  isLoadedSession?: boolean;
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

function TradePositionOverlay({
  targets,
  direction,
  currentPrice,
  priceDecimals,
}: {
  targets: NonNullable<FinalVerdictData["tradeTargets"]>;
  direction: "UP" | "DOWN";
  currentPrice?: number;
  priceDecimals: number;
}) {
  const { entry, target, stop } = targets;
  const isLong = direction === "UP";

  const entryAvg = (entry.low + entry.high) / 2;
  const targetAvg = (target.low + target.high) / 2;
  
  const profit = Math.abs(targetAvg - entryAvg);
  const risk = Math.abs(entryAvg - stop);
  
  // Calculate heights proportional to R:R but within reasonable bounds
  const totalHeight = 200;
  const rrRatio = profit / risk;
  
  // Clamp the ratio so it doesn't look crazy
  const clampedRR = Math.max(0.3, Math.min(4, rrRatio));
  const profitHeight = (clampedRR / (clampedRR + 1)) * totalHeight;
  const riskHeight = totalHeight - profitHeight;

  const profitPercent = ((profit / entryAvg) * 100).toFixed(2);
  const riskPercent = ((risk / entryAvg) * 100).toFixed(2);

  return (
    <motion.div 
      drag
      dragMomentum={false}
      className="absolute right-10 top-1/2 -translate-y-1/2 w-24 sm:w-28 flex flex-col cursor-grab active:cursor-grabbing select-none z-10 opacity-90 hover:opacity-100 transition-opacity duration-300 group/overlay"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 0.9, x: 0 }}
    >
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover/overlay:opacity-100 transition-opacity duration-200 pointer-events-none">
        <div className="bg-primary/80 text-[10px] text-primary-foreground px-2 py-0.5 rounded-full flex items-center gap-1 font-black whitespace-nowrap shadow-lg">
          <Edit3 className="w-2.5 h-2.5" />
          DRAG
        </div>
      </div>
      {/* Target Zone */}
      <div 
        className={cn(
          "relative flex flex-col items-center justify-center border border-green-500/50 backdrop-blur-[1px] overflow-hidden transition-all duration-500",
          isLong ? "bg-green-500/30 rounded-t-md border-b-0" : "bg-green-500/30 rounded-b-md order-2 border-t-0"
        )}
        style={{ height: `${profitHeight}px` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-green-500/10 to-transparent opacity-50" />
        <div className={cn("absolute flex flex-col items-center gap-0.5 z-10 px-1 text-center", isLong ? "top-2" : "bottom-2")}>
          <span className="text-[8px] sm:text-[9px] font-black text-green-400 uppercase tracking-tighter drop-shadow-sm">Target</span>
          <span className="text-[10px] sm:text-[12px] font-mono font-bold text-white drop-shadow-md">+{profitPercent}%</span>
        </div>
        <div className={cn("absolute z-10", isLong ? "bottom-1" : "top-1")}>
          <span className="text-[7px] sm:text-[8px] font-bold text-green-400/60 tracking-tight">R:R {(profit/risk).toFixed(2)}</span>
        </div>
      </div>
      
      {/* Entry Line Indicator */}
      <div className="relative h-0 w-full z-20">
        <div className="absolute -left-1 -right-1 h-[2px] bg-white shadow-[0_0_10px_rgba(255,255,255,1)]" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 bg-white text-black text-[7px] sm:text-[8px] font-black px-1 py-0.5 rounded-l-sm shadow-xl">
          {entryAvg.toFixed(priceDecimals)}
        </div>
      </div>
      
      {/* Stop Zone */}
      <div 
        className={cn(
          "relative flex flex-col items-center justify-center border border-red-500/50 backdrop-blur-[1px] overflow-hidden transition-all duration-500",
          isLong ? "bg-red-500/30 rounded-b-md border-t-0" : "bg-red-500/30 rounded-t-md order-1 border-b-0"
        )}
        style={{ height: `${riskHeight}px` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-red-500/10 to-transparent opacity-50" />
        <div className={cn("absolute flex flex-col items-center gap-0.5 z-10 px-1 text-center", isLong ? "bottom-2" : "top-2")}>
          <span className="text-[8px] sm:text-[9px] font-black text-red-400 uppercase tracking-tighter drop-shadow-sm">Stop</span>
          <span className="text-[10px] sm:text-[12px] font-mono font-bold text-white drop-shadow-md">-{riskPercent}%</span>
        </div>
      </div>
    </motion.div>
  );
}

function FinalVerdictDisplay({
  data,
  tradingPair,
  timeframe,
  currentPrice,
}: {
  data: FinalVerdictData;
  tradingPair?: TradingPair;
  timeframe?: Timeframe;
  currentPrice?: number;
}) {
  const [editedTargets, setEditedTargets] = useState(data.tradeTargets);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setEditedTargets(data.tradeTargets);
  }, [data.tradeTargets]);

  const symbol = toTradingViewSymbol(tradingPair);
  const interval = timeframe
    ? timeframeToTradingViewInterval[timeframe]
    : timeframeToTradingViewInterval.M15;

  const priceDecimals = getPriceDecimals(currentPrice);
  const isActionable = data.direction !== "NEUTRAL";

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
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold uppercase tracking-wide bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Trade Targets
            </div>
            {isActionable && data.tradeTargets && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold transition-all hover:bg-primary/10 text-primary border border-primary/20"
              >
                {isEditing ? (
                  <>
                    <Save className="w-3 h-3" />
                    Save Targets
                  </>
                ) : (
                  <>
                    <Edit3 className="w-3 h-3" />
                    Adjust Setup
                  </>
                )}
              </button>
            )}
          </div>

          <div className="p-3 rounded-xl bg-card/50 border border-border/40 backdrop-blur-sm space-y-3">
            {isActionable && editedTargets ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-2 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    ENTRY
                  </div>
                  {isEditing ? (
                    <div className="space-y-1">
                      <input
                        type="number"
                        step="any"
                        value={editedTargets.entry.low}
                        onChange={(e) => setEditedTargets({
                          ...editedTargets,
                          entry: { ...editedTargets.entry, low: parseFloat(e.target.value) || 0 }
                        })}
                        className="w-full bg-background/50 border border-border rounded px-1.5 py-0.5 text-xs font-mono"
                      />
                      <input
                        type="number"
                        step="any"
                        value={editedTargets.entry.high}
                        onChange={(e) => setEditedTargets({
                          ...editedTargets,
                          entry: { ...editedTargets.entry, high: parseFloat(e.target.value) || 0 }
                        })}
                        className="w-full bg-background/50 border border-border rounded px-1.5 py-0.5 text-xs font-mono"
                      />
                    </div>
                  ) : (
                    <div className="font-mono text-base sm:text-lg font-bold text-primary">
                      {formatRange(
                        editedTargets.entry.low,
                        editedTargets.entry.high,
                        priceDecimals
                      )}
                    </div>
                  )}
                </div>

                <div className="p-2 rounded-lg bg-green-500/5 border border-green-500/20">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    TARGET
                  </div>
                  {isEditing ? (
                    <div className="space-y-1">
                      <input
                        type="number"
                        step="any"
                        value={editedTargets.target.low}
                        onChange={(e) => setEditedTargets({
                          ...editedTargets,
                          target: { ...editedTargets.target, low: parseFloat(e.target.value) || 0 }
                        })}
                        className="w-full bg-background/50 border border-border rounded px-1.5 py-0.5 text-xs font-mono"
                      />
                      <input
                        type="number"
                        step="any"
                        value={editedTargets.target.high}
                        onChange={(e) => setEditedTargets({
                          ...editedTargets,
                          target: { ...editedTargets.target, high: parseFloat(e.target.value) || 0 }
                        })}
                        className="w-full bg-background/50 border border-border rounded px-1.5 py-0.5 text-xs font-mono"
                      />
                    </div>
                  ) : (
                    <div className="font-mono text-base sm:text-lg font-bold text-green-400">
                      {formatRange(
                        editedTargets.target.low,
                        editedTargets.target.high,
                        priceDecimals
                      )}
                    </div>
                  )}
                </div>

                <div className="p-2 rounded-lg bg-red-500/5 border border-red-500/20">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    STOP
                  </div>
                  {isEditing ? (
                    <input
                      type="number"
                      step="any"
                      value={editedTargets.stop}
                      onChange={(e) => setEditedTargets({
                        ...editedTargets,
                        stop: parseFloat(e.target.value) || 0
                      })}
                      className="w-full bg-background/50 border border-border rounded px-1.5 py-0.5 text-xs font-mono"
                    />
                  ) : (
                    <div className="font-mono text-base sm:text-lg font-bold text-red-400">
                      {formatPrice(editedTargets.stop, priceDecimals)}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No actionable trade setup detected. Waiting for a higher-confidence entry.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold uppercase tracking-wide bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Interactive Live Chart
            </div>
            <div className="group relative">
              <Info className="w-4 h-4 text-muted-foreground cursor-help hover:text-primary transition-colors" />
              <div className="absolute bottom-full right-0 mb-2 w-72 p-3 bg-card/95 backdrop-blur-md text-foreground text-xs rounded-xl shadow-2xl border border-primary/20 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50 scale-95 group-hover:scale-100 origin-bottom-right">
                <div className="font-bold mb-1 text-primary flex items-center gap-1">
                  <Settings2 className="w-3 h-3" />
                  Chart Display Info
                </div>
                The SL/TP levels are AI-generated recommendations. You can <b>drag</b> the overlay to move it, or use the <b>Adjust Setup</b> button to change the prices.
                <div className="mt-2 pt-2 border-t border-border/50 text-green-400 font-medium">
                  Pro Tip: Use the "Long/Short Position" tools in the TradingView sidebar to place interactive markers directly on the chart.
                </div>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-border/40">
            <PositionManagerChart
              symbol={symbol}
              interval={interval}
              minimal={true}
              className="h-[300px] sm:h-[350px] md:h-[400px] border-0"
              tradingPair={tradingPair}
              timeframe={timeframe}
            />
            {isActionable && editedTargets && (
              <TradePositionOverlay 
                targets={editedTargets}
                direction={data.direction as "UP" | "DOWN"}
                currentPrice={currentPrice} 
                priceDecimals={priceDecimals} 
              />
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <div className="text-sm font-bold uppercase tracking-wide bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            KEY FACTORS
          </div>
          <div className="space-y-1">
            {(data.keyFactors ?? []).map((factor, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-2 rounded-lg bg-green-500/5 border border-green-500/20 backdrop-blur-sm"
              >
                <span className="text-green-400 mt-0.5 font-bold">•</span>
                <span className="text-sm leading-relaxed flex-1">{factor}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-bold uppercase tracking-wide bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent flex items-center gap-2">
            <span className="text-orange-400">⚠</span>
            RISK FACTORS
          </div>
          <div className="space-y-1">
            {(data.riskFactors ?? []).map((risk, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-2 rounded-lg bg-orange-500/5 border border-orange-500/20 backdrop-blur-sm"
              >
                <span className="text-orange-400 mt-0.5">⚠</span>
                <span className="text-sm leading-relaxed flex-1">{risk}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-card/50 border border-border/40 backdrop-blur-sm">
          <span className="text-sm font-medium uppercase tracking-wide">
            Quality Score
          </span>
          <span className="text-xl sm:text-2xl font-black text-primary">{data.qualityScore}%</span>
        </div>
      </div>
    </div>
  );
}

export function TransparentAnalysis({
  stages,
  tradingPair,
  timeframe,
  onStageComplete,
  isLoadedSession,
}: TransparentAnalysisProps) {
  const [expandedStages, setExpandedStages] = useState<string[]>([]);
  const autoExpandedRef = useRef<Set<string>>(new Set());
  const stageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const lastInProgressStageRef = useRef<string | null>(null);

  const marketDataStage = stages.find(
    (s) => s.stage === "data_collection" && s.data
  );
  const currentPrice =
    typeof (marketDataStage?.data as any)?.currentPrice === "number"
      ? ((marketDataStage?.data as any).currentPrice as number)
      : undefined;

  const toggleStage = (stageName: string) => {
    setExpandedStages((prev) =>
      prev.includes(stageName)
        ? prev.filter((s) => s !== stageName)
        : [...prev, stageName]
    );
  };

  useEffect(() => {
    if (stages.length === 0) {
      autoExpandedRef.current.clear();
      setExpandedStages([]);
      lastInProgressStageRef.current = null;
      return;
    }

    const allNonComplete = stages.every(s => s.status === "pending" || s.status === "in_progress");
    const isNewRun = allNonComplete && autoExpandedRef.current.size > 0;

    if (isNewRun) {
      autoExpandedRef.current.clear();
      setExpandedStages([]);
      lastInProgressStageRef.current = null;
    }

    stages.forEach((stage, index) => {
      const shouldAutoExpand =
        stage.status === "complete" ||
        (stage.stage === "final_verdict" && stage.data && !autoExpandedRef.current.has(stage.stage));

      if (shouldAutoExpand && !autoExpandedRef.current.has(stage.stage)) {
        autoExpandedRef.current.add(stage.stage);
        setTimeout(() => {
          setExpandedStages((prev) =>
            prev.includes(stage.stage) ? prev : [...prev, stage.stage]
          );
        }, 300);
      }
    });
  }, [stages]);

  useLayoutEffect(() => {
    const inProgressStage = stages.find(s => s.status === "in_progress");
    if (inProgressStage && inProgressStage.stage !== lastInProgressStageRef.current) {
      lastInProgressStageRef.current = inProgressStage.stage;
      setTimeout(() => {
        const element = stageRefs.current[inProgressStage.stage];
        if (element) {
          try {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
          } catch (error) {
            console.warn("Scroll failed for stage:", inProgressStage.stage, error);
          }
        }
      }, 100);
    }
  }, [stages]);

  return (
    <Card className="mt-4 overflow-hidden border border-primary/30 shadow-xl backdrop-blur-sm" data-testid="transparent-analysis">
      <CardHeader className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5">
        <CardTitle className="flex items-center gap-3 text-xl">
          <LineChart className="w-6 h-6 text-primary" />
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-black">
            Live AI Analysis
          </span>
        </CardTitle>
        <CardDescription className="font-medium">
          Watch the AI analyze in real-time - complete transparency
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        {stages.map((stage, idx) => (
          <div 
            key={`${stage.stage}-${idx}`} 
            className="space-y-3"
            ref={(el) => { stageRefs.current[stage.stage] = el; }}
          >
            <StageIndicator stage={stage} />

            {stage.stage === "ai_thinking" && stage.data && (
              <div className="mt-4 animate-slide-up">
                <AIThinkingDisplay 
                  data={stage.data as AIThinkingData}
                  onComplete={() => onStageComplete?.("ai_thinking")}
                  isLoadedSession={isLoadedSession}
                />
              </div>
            )}

            {(stage.status === "complete" || (stage.stage === "final_verdict" && stage.data)) && stage.data && stage.stage !== "ai_thinking" && (
              <Collapsible
                open={expandedStages.includes(stage.stage)}
                onOpenChange={() => toggleStage(stage.stage)}
              >
                <CollapsibleTrigger
                  className="flex items-center gap-2 w-full text-sm font-medium text-primary hover:text-accent transition-colors mt-2 p-2 rounded-lg hover:bg-muted/50"
                  data-testid={`toggle-stage-${stage.stage}`}
                >
                  {expandedStages.includes(stage.stage) ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  <span>
                    {expandedStages.includes(stage.stage) ? "Hide detailed breakdown" : "View detailed breakdown"}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 p-5 rounded-xl bg-card/50 border border-border/40 backdrop-blur-sm animate-slide-up">
                  {stage.stage === "data_collection" && (
                    <MarketDataDisplay data={stage.data as MarketDataSnapshot} />
                  )}
                  {stage.stage === "technical_calculation" &&
                    "indicators" in stage.data && (
                      <TechnicalIndicatorsDisplay
                        indicators={
                          stage.data.indicators as TechnicalIndicatorDetail[]
                        }
                      />
                    )}
                  {stage.stage === "signal_aggregation" && (
                    <SignalAggregationDisplay
                      data={stage.data as SignalAggregationData}
                    />
                  )}
                  {stage.stage === "final_verdict" && (
                    <FinalVerdictDisplay
                      data={stage.data as FinalVerdictData}
                      tradingPair={tradingPair}
                      timeframe={timeframe}
                      currentPrice={currentPrice}
                    />
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
