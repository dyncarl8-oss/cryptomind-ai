import { useEffect, useState } from "react";
import { Loader2, Check, TrendingUp, BarChart3, Sparkles, Target } from "lucide-react";

interface AnalysisStep {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ANALYSIS_STEPS: AnalysisStep[] = [
  { id: "fetch", label: "Fetching market data", icon: TrendingUp },
  { id: "analyze", label: "Analyzing indicators", icon: BarChart3 },
  { id: "ai", label: "Consulting AI model", icon: Sparkles },
  { id: "finalize", label: "Finalizing prediction", icon: Target },
];

export function AnalysisLoadingIndicator() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (currentStep >= ANALYSIS_STEPS.length - 1) return;

    const timer = setTimeout(() => {
      setCurrentStep((prev) => Math.min(prev + 1, ANALYSIS_STEPS.length - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [currentStep]);

  return (
    <div className="space-y-2.5" data-testid="analysis-loading-indicator">
      {ANALYSIS_STEPS.map((step, index) => {
        const Icon = step.icon;
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        
        return (
          <div
            key={step.id}
            className="flex items-center gap-3"
            data-testid={`analysis-step-${step.id}`}
          >
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
              {isCompleted ? (
                <Check className="w-4 h-4 text-chart-2" />
              ) : isCurrent ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              ) : (
                <Icon className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            
            <span
              className={`text-sm font-medium transition-colors ${
                isCompleted
                  ? "text-chart-2"
                  : isCurrent
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
