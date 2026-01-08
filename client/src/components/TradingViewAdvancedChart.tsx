import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";

interface TradingViewAdvancedChartProps {
  symbol: string;
  interval: string;
  className?: string;
  minimal?: boolean;
}

export function TradingViewAdvancedChart({
  symbol,
  interval,
  className,
  minimal = false,
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
      hide_top_toolbar: false,
      hide_side_toolbar: false,
      hide_legend: minimal,
      withdateranges: !minimal,
      allow_symbol_change: !minimal,
      save_image: false,
      details: !minimal,
      hotlist: !minimal,
      calendar: false,
      support_host: "https://www.tradingview.com",
      show_popup_button: false,
      popup_width: "1000",
      popup_height: "650",
      // Enable interactive drawing tools and position management
      enable_mouse_wheel_zoom: true,
      enable_mouse_wheel_zoom_mode: "bottom",
      enable_mouse_zoom: true,
      enable_drawing_tools: true,
      enable_drawings_access: {
        from: 1,
        to: Date.now() + 1000 * 60 * 60 * 24 * 365,
        tool_bar: {
          ["order.buy"]: {
            enabled: true,
            icon: "order.buy",
            title: "Buy Order",
          },
          ["order.sell"]: {
            enabled: true,
            icon: "order.sell", 
            title: "Sell Order",
          },
          ["position.long"]: {
            enabled: true,
            icon: "position.long",
            title: "Long Position",
          },
          ["position.short"]: {
            enabled: true,
            icon: "position.short",
            title: "Short Position",
          },
          ["chart_trading.study"]: {
            enabled: true,
            icon: "chart_trading.study",
            title: "Trading Study",
          },
        },
      },
    }),
    [symbol, interval, theme, minimal]
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
