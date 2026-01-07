import { useState, useEffect, useRef, useLayoutEffect } from "react";
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
import { TradingViewAdvancedChart } from "@/components/TradingViewAdvancedChart";

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
    description: "CryptoMind AI analyzing market conditions",
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
  SECONDS: "1",
  M1: "1",
  M3: "3",
  M5: "5",
  M15: "15",
  M30: "30",
  H1: "60",
  H2: "120",
  H4: "240",
  H8: "480",
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

  return (
    <div className="space-y-3 animate-slide-up" data-testid={`analysis-stage-${stage.stage}`}>
      <div className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/40 backdrop-blur-sm transition-all duration-300">
        <div className="flex items-center gap-4 flex-1">
          <div className={`relative`}>
            {isInProgress && !isAiThinkingStage ? (
              <div className="relative">
                <Loader2 className={`w-6 h-6 animate-spin ${config.color}`} />
                <div className="absolute inset-0 blur-md opacity-50">
                  <Loader2 className={`w-6 h-6 animate-spin ${config.color}`} />
                </div>
              </div>
            ) : (
              <div className="relative">
                <Icon className={`w-6 h-6 ${isComplete ? 'text-green-400' : config.color}`} />
                {isComplete && (
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
        {isComplete && (
          <CheckCircle2 className="w-5 h-5 text-green-400" />
        )}
      </div>
      <Progress 
        value={stage.progress} 
        className={`h-2 ${isInProgress ? 'animate-pulse' : ''}`}
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

  useEffect(() => {
    if (!data.thinkingProcess) {
      setDisplayedText("");
      setIsTyping(false);
      isTypingRef.current = false;
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
      setIsTyping(false);
      isTypingRef.current = false;
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
      return;
    }

    if (displayedText.length < data.thinkingProcess.length) {
      isTypingRef.current = true;
      setIsTyping(true);
      
      const startLength = displayedText.length;
      const targetLength = data.thinkingProcess.length;
      let currentIndex = startLength;

      const typeNextChar = () => {
        if (currentIndex < targetTextRef.current.length) {
          const charsToAdd = Math.min(3, targetTextRef.current.length - currentIndex);
          currentIndex += charsToAdd;
          const nextText = targetTextRef.current.slice(0, currentIndex);
          setDisplayedText(nextText);
          
          if (!userScrolledRef.current && containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
          }
          
          requestAnimationFrame(typeNextChar);
        } else {
          setIsTyping(false);
          isTypingRef.current = false;
          if (!completedRef.current) {
            completedRef.current = true;
            onComplete?.();
          }
        }
      };

      requestAnimationFrame(typeNextChar);
    } else if (displayedText.length === data.thinkingProcess.length && displayedText.length > 0 && !completedRef.current) {
      if (isTyping) {
        setIsTyping(false);
      }
      completedRef.current = true;
      onComplete?.();
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
  currentPrice,
}: {
  data: FinalVerdictData;
  tradingPair?: TradingPair;
  timeframe?: Timeframe;
  currentPrice?: number;
}) {
  const symbol = toTradingViewSymbol(tradingPair);
  const interval = timeframe
    ? timeframeToTradingViewInterval[timeframe]
    : timeframeToTradingViewInterval.M15;

  const priceDecimals = getPriceDecimals(currentPrice);
  const isActionable = data.direction !== "NEUTRAL";

  return (
    <div className="space-y-6" data-testid="final-verdict-display">
      <div className="grid grid-cols-3 gap-4 p-5 rounded-xl bg-gradient-to-br from-primary/10 via-accent/10 to-primary/10 border border-primary/30 backdrop-blur-sm">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Direction
          </div>
          <div className="text-3xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {data.direction}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Confidence
          </div>
          <div className="text-3xl font-black text-green-400">
            {data.confidence}%
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Duration
          </div>
          <div className="text-2xl font-bold text-primary">{data.duration}</div>
        </div>
      </div>

      {data.explanation && (
        <div className="p-5 rounded-xl bg-gradient-to-br from-blue-500/5 via-cyan-500/5 to-blue-500/5 border border-blue-500/20 backdrop-blur-sm">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{data.explanation}</p>
        </div>
      )}

      <div className="space-y-6">
        <div className="space-y-3">
          <div className="text-sm font-bold uppercase tracking-wide bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Trade Targets
          </div>

          <div className="p-4 rounded-xl bg-card/50 border border-border/40 backdrop-blur-sm space-y-3">
            {isActionable && data.tradeTargets ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    ENTRY
                  </div>
                  <div className="font-mono text-lg font-bold text-primary">
                    {formatRange(
                      data.tradeTargets.entry.low,
                      data.tradeTargets.entry.high,
                      priceDecimals
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    TARGET
                  </div>
                  <div className="font-mono text-lg font-bold text-green-400">
                    {formatRange(
                      data.tradeTargets.target.low,
                      data.tradeTargets.target.high,
                      priceDecimals
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    STOP
                  </div>
                  <div className="font-mono text-lg font-bold text-red-400">
                    {formatPrice(data.tradeTargets.stop, priceDecimals)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No actionable trade setup detected. Waiting for a higher-confidence entry.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-bold uppercase tracking-wide bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Live Chart
          </div>
          <TradingViewAdvancedChart
            symbol={symbol}
            interval={interval}
            className="h-[280px] sm:h-[320px]"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-3">
          <div className="text-sm font-bold uppercase tracking-wide bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            KEY FACTORS
          </div>
          <div className="space-y-2">
            {(data.keyFactors ?? []).map((factor, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20 backdrop-blur-sm"
              >
                <span className="text-green-400 mt-0.5 font-bold">•</span>
                <span className="text-sm leading-relaxed flex-1">{factor}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-bold uppercase tracking-wide bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent flex items-center gap-2">
            <span className="text-orange-400">⚠</span>
            RISK FACTORS
          </div>
          <div className="space-y-2">
            {(data.riskFactors ?? []).map((risk, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20 backdrop-blur-sm"
              >
                <span className="text-orange-400 mt-0.5">⚠</span>
                <span className="text-sm leading-relaxed flex-1">{risk}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-card/50 border border-border/40 backdrop-blur-sm">
          <span className="text-sm font-medium uppercase tracking-wide">
            Quality Score
          </span>
          <span className="text-2xl font-black text-primary">{data.qualityScore}%</span>
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
      if (stage.status === "complete" && !autoExpandedRef.current.has(stage.stage)) {
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

            {stage.status === "complete" && stage.data && stage.stage !== "ai_thinking" && (
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
