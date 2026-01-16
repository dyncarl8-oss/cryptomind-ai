import * as React from "react";
import { useState, useEffect } from "react";
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
} from "lucide-react";
import type {
  AnalysisStage,
  TechnicalIndicatorDetail,
  MarketDataSnapshot,
  SignalAggregationData,
  AIThinkingData,
  FinalVerdictData,
} from "@shared/schema";

interface TransparentAnalysisProps {
  stages: AnalysisStage[];
}

const stageConfig = {
  data_collection: {
    icon: Database,
    title: "Data Collection",
    description: "Fetching live market data from Binance",
    color: "text-blue-500",
  },
  technical_calculation: {
    icon: LineChart,
    title: "Technical Indicator Calculation",
    description: "Computing 23+ technical indicators",
    color: "text-purple-500",
  },
  signal_aggregation: {
    icon: Scale,
    title: "Signal Aggregation",
    description: "Weighing all signals and finding alignment",
    color: "text-orange-500",
  },
  ai_thinking: {
    icon: Brain,
    title: "AI Deep Analysis",
    description: "Gemini 3 Pro Preview analyzing in progress",
    color: "text-pink-500",
  },
  final_verdict: {
    icon: CheckCircle2,
    title: "Final Verdict",
    description: "Generating comprehensive prediction",
    color: "text-green-500",
  },
};

function StageIndicator({ stage }: { stage: AnalysisStage }) {
  const config = stageConfig[stage.stage];
  const Icon = config.icon;
  const isComplete = stage.status === "complete";
  const isInProgress = stage.status === "in_progress";

  return (
    <div className="space-y-2" data-testid={`analysis-stage-${stage.stage}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`${config.color}`}>
            {isInProgress ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Icon className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="font-semibold text-sm">{config.title}</div>
            <div className="text-xs text-muted-foreground">
              {config.description}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {stage.duration && (
            <Badge variant="outline" className="text-xs">
              {(stage.duration / 1000).toFixed(1)}s
            </Badge>
          )}
          {isComplete && (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          )}
        </div>
      </div>
      <Progress value={stage.progress} className="h-2" />
    </div>
  );
}

function MarketDataDisplay({ data }: { data: MarketDataSnapshot }) {
  const priceDecimals = data.currentPrice >= 1
    ? 2
    : data.currentPrice >= 0.1
      ? 3
      : data.currentPrice >= 0.01
        ? 4
        : data.currentPrice >= 0.001
          ? 6
          : data.currentPrice >= 0.0001
            ? 8
            : 10;

  return (
    <div
      className="grid grid-cols-2 gap-3 text-sm"
      data-testid="market-data-display"
    >
      <div>
        <div className="text-xs text-muted-foreground">Current Price</div>
        <div className="font-mono font-semibold">
          ${data.currentPrice.toLocaleString(undefined, { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })}
        </div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">24h Change</div>
        <div
          className={`font-mono font-semibold ${data.priceChange24h >= 0 ? "text-green-500" : "text-red-500"}`}
        >
          {data.priceChange24h >= 0 ? "+" : ""}
          {data.priceChange24h.toFixed(2)}%
        </div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Volume Change</div>
        <div
          className={`font-mono ${data.volumeChange24h >= 0 ? "text-green-500" : "text-red-500"}`}
        >
          {data.volumeChange24h >= 0 ? "+" : ""}
          {data.volumeChange24h.toFixed(1)}%
        </div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Data Points</div>
        <div className="font-mono">{data.candlesRetrieved} candles</div>
      </div>
    </div>
  );
}

function TechnicalIndicatorsDisplay({
  indicators,
}: {
  indicators: TechnicalIndicatorDetail[];
}) {
  const categories = [
    "MOMENTUM",
    "TREND",
    "VOLATILITY",
    "VOLUME",
    "PRICE_ACTION",
  ];

  return (
    <div className="space-y-4" data-testid="technical-indicators-display">
      {categories.map((category) => {
        const categoryIndicators = indicators.filter(
          (i) => i.category === category
        );
        if (categoryIndicators.length === 0) return null;

        return (
          <div key={category} className="space-y-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              {category} INDICATORS
            </div>
            <div className="space-y-2">
              {categoryIndicators.map((indicator, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-md bg-card-elevated"
                  data-testid={`indicator-${indicator.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        {indicator.name}
                      </span>
                      <Badge
                        variant={
                          indicator.signal === "UP"
                            ? "default"
                            : indicator.signal === "DOWN"
                              ? "destructive"
                              : "secondary"
                        }
                        className="text-xs"
                      >
                        {indicator.signal}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {indicator.description}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-semibold">
                      {indicator.value}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Strength: {indicator.strength}
                    </div>
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
  const totalSignals = data.upSignalsCount + data.downSignalsCount + data.neutralSignalsCount;

  return (
    <div className="space-y-3" data-testid="signal-aggregation-display">
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20">
          <div className="text-2xl font-bold text-green-500">
            {data.upSignalsCount}
          </div>
          <div className="text-xs text-muted-foreground">UP Signals</div>
        </div>
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20">
          <div className="text-2xl font-bold text-red-500">
            {data.downSignalsCount}
          </div>
          <div className="text-xs text-muted-foreground">DOWN Signals</div>
        </div>
        <div className="p-3 rounded-md bg-muted">
          <div className="text-2xl font-bold">{data.neutralSignalsCount}</div>
          <div className="text-xs text-muted-foreground">Neutral</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">UP Score</span>
          <span className="font-mono font-semibold text-green-500">
            {data.upScore.toFixed(1)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">DOWN Score</span>
          <span className="font-mono font-semibold text-red-500">
            {data.downScore.toFixed(1)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Signal Alignment</span>
          <span className="font-mono font-semibold">
            {data.signalAlignment.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Market Regime</span>
          <Badge variant="outline">{data.marketRegime}</Badge>
        </div>
      </div>
    </div>
  );
}

function AIThinkingDisplay({ data }: { data: AIThinkingData }) {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    if (!data.thinkingProcess) return;

    let currentIndex = 0;
    const text = data.thinkingProcess;
    setIsTyping(true);

    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, 20);

    return () => clearInterval(interval);
  }, [data.thinkingProcess]);

  return (
    <div className="space-y-3" data-testid="ai-thinking-display">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-pink-500" />
          <span className="text-sm font-semibold">AI Thought Process</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {data.modelUsed}
        </Badge>
      </div>
      <div className="p-3 rounded-md bg-card-elevated border border-border max-h-64 overflow-y-auto">
        <div className="text-sm font-mono whitespace-pre-wrap">
          {displayedText}
          {isTyping && <span className="animate-pulse">▊</span>}
        </div>
      </div>
    </div>
  );
}

function FinalVerdictDisplay({ data }: { data: FinalVerdictData }) {
  const priceDecimals = data.tradeTargets
    ? (data.tradeTargets.entry.low >= 100
      ? 2
      : data.tradeTargets.entry.low >= 10
        ? 3
        : data.tradeTargets.entry.low >= 1
          ? 4
          : data.tradeTargets.entry.low >= 0.1
            ? 5
            : data.tradeTargets.entry.low >= 0.01
              ? 6
              : data.tradeTargets.entry.low >= 0.001
                ? 7
                : data.tradeTargets.entry.low >= 0.0001
                  ? 8
                  : data.tradeTargets.entry.low >= 0.00001
                    ? 9
                    : 10)
    : 2;

  return (
    <div className="space-y-3" data-testid="final-verdict-display">
      <div className="flex items-center justify-between p-4 rounded-md bg-primary/10 border border-primary/20">
        <div>
          <div className="text-sm text-muted-foreground">Direction</div>
          <div className="text-2xl font-bold">{data.direction}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Confidence</div>
          <div className="text-2xl font-bold">{data.confidence}%</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Duration</div>
          <div className="text-lg font-semibold">{data.duration}</div>
        </div>
      </div>

      {data.explanation && (
        <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/20">
          <p className="text-sm leading-relaxed">{data.explanation}</p>
        </div>
      )}

      {data.direction !== "NEUTRAL" && data.tradeTargets && (
        <div>
          <div className="text-sm font-semibold mb-2">Trade Targets</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-md bg-card-elevated">
              <div className="text-xs text-muted-foreground font-semibold">ENTRY</div>
              <div className="font-mono font-semibold">
                {data.tradeTargets.entry.low.toLocaleString(undefined, { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })} - {data.tradeTargets.entry.high.toLocaleString(undefined, { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })}
              </div>
            </div>
            <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20">
              <div className="text-xs text-muted-foreground font-semibold">TARGET</div>
              <div className="font-mono font-semibold text-green-600 dark:text-green-400">
                {data.tradeTargets.target.low.toLocaleString(undefined, { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })} - {data.tradeTargets.target.high.toLocaleString(undefined, { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })}
              </div>
            </div>
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20">
              <div className="text-xs text-muted-foreground font-semibold">STOP</div>
              <div className="font-mono font-semibold text-red-600 dark:text-red-400">
                {data.tradeTargets.stop.toLocaleString(undefined, { minimumFractionDigits: priceDecimals, maximumFractionDigits: priceDecimals })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="text-sm font-semibold mb-2">Key Factors</div>
        <ul className="space-y-1">
          {(data.keyFactors ?? []).map((factor, idx) => (
            <li key={idx} className="text-sm flex items-start gap-2">
              <span className="text-green-500 mt-1">•</span>
              <span>{factor}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="text-sm font-semibold mb-2 text-orange-500">
          Risk Factors
        </div>
        <ul className="space-y-1">
          {(data.riskFactors ?? []).map((risk, idx) => (
            <li key={idx} className="text-sm flex items-start gap-2">
              <span className="text-orange-500 mt-1">⚠</span>
              <span>{risk}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between p-3 rounded-md bg-muted">
        <span className="text-sm text-muted-foreground">Quality Score</span>
        <span className="text-lg font-bold">{data.qualityScore}%</span>
      </div>
    </div>
  );
}

export function TransparentAnalysis({ stages }: TransparentAnalysisProps) {
  const [expandedStages, setExpandedStages] = useState<string[]>([]);

  const toggleStage = (stageName: string) => {
    setExpandedStages((prev) =>
      prev.includes(stageName)
        ? prev.filter((s) => s !== stageName)
        : [...prev, stageName]
    );
  };

  return (
    <Card className="mt-4" data-testid="transparent-analysis">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LineChart className="w-5 h-5" />
          Live Analysis Progress
        </CardTitle>
        <CardDescription>
          Watch the AI analyze in real-time - complete transparency
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stages.map((stage, idx) => (
          <div key={`${stage.stage}-${idx}`}>
            <StageIndicator stage={stage} />

            {stage.status === "complete" && stage.data && (
              <Collapsible
                open={expandedStages.includes(stage.stage)}
                onOpenChange={() => toggleStage(stage.stage)}
              >
                <CollapsibleTrigger
                  className="flex items-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground mt-2"
                  data-testid={`toggle-stage-${stage.stage}`}
                >
                  {expandedStages.includes(stage.stage) ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  <span>View detailed breakdown</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 p-3 rounded-md bg-muted/50 border border-border">
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
                  {stage.stage === "ai_thinking" && (
                    <AIThinkingDisplay data={stage.data as AIThinkingData} />
                  )}
                  {stage.stage === "final_verdict" && (
                    <FinalVerdictDisplay data={stage.data as FinalVerdictData} />
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
