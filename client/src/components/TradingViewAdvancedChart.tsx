import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";

interface TradingViewAdvancedChartProps {
  symbol: string;
  interval: string;
  className?: string;
}

export function TradingViewAdvancedChart({
  symbol,
  interval,
  className,
}: TradingViewAdvancedChartProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const widgetConfig = useMemo(
    () => ({
      autosize: true,
      symbol,
      interval,
      timezone: "Etc/UTC",
      theme,
      style: "1",
      locale: "en",
      enable_publishing: false,
      allow_symbol_change: true,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    }),
    [symbol, interval, theme]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "100%";
    widget.style.width = "100%";
    container.appendChild(widget);

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify(widgetConfig);

    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [widgetConfig]);

  return (
    <div
      className={cn(
        "h-full w-full overflow-hidden rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm",
        className
      )}
    >
      <div ref={containerRef} className="tradingview-widget-container h-full w-full" />
    </div>
  );
}
