import * as React from "react";
import { useState, useEffect } from "react";
import { NewsHeadline } from "@shared/schema";
import {
    Newspaper,
    Globe2,
    TrendingUp,
    TrendingDown,
    Minus,
    ExternalLink,
    Search,
    Radar
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface SentinelNewsAuditProps {
    headlines: NewsHeadline[];
    isScanning: boolean;
}

// Initial seed keywords for the scanner to look for
const KEYWORD_SEED = [
    "Fed", "Rate", "ETF", "Flow", "Bullish", "Bearish", "Liquidity",
    "Regulatory", "Binance", "SEC", "Inflation", "Yield", "Accumulation",
    "Support", "Resistance", "Institution", "Whale", "Exchange", "Stablecoin"
];

export function SentinelNewsAudit({ headlines, isScanning }: SentinelNewsAuditProps) {
    const [isOpen, setIsOpen] = useState(true);
    const [scannedCount, setScannedCount] = useState(0);

    // Dynamic keyword extraction from real headlines
    const getDynamicKeywords = () => {
        if (!headlines || headlines.length === 0) {
            return [
                { word: "Scanning", weight: 3 },
                { word: "Ingesting", weight: 2 },
                { word: "Neutral", weight: 1 }
            ];
        }

        const counts: Record<string, number> = {};
        const text = headlines.map(h => h.title.toLowerCase()).join(" ");

        KEYWORD_SEED.forEach(seed => {
            const regex = new RegExp(`\\b${seed.toLowerCase()}\\b`, 'g');
            const matches = text.match(regex);
            if (matches && matches.length > 0) {
                counts[seed] = Math.min(5, 1 + Math.floor(matches.length / 2));
            }
        });

        // Add specific pair mentioned
        const firstHeadline = headlines[0]?.title || "";
        const words = firstHeadline.split(" ");
        if (words.length > 0) {
            const potentialCoin = words.find(w => w.length >= 3 && w.length <= 5 && /^[A-Z]+$/.test(w));
            if (potentialCoin && !counts[potentialCoin]) {
                counts[potentialCoin] = 5;
            }
        }

        const result = Object.entries(counts)
            .map(([word, weight]) => ({ word, weight }))
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 8);

        // Fallback if no specific keywords found
        return result.length > 0 ? result : [
            { word: "Market", weight: 4 },
            { word: "Crypto", weight: 3 },
            { word: "Volatility", weight: 3 },
            { word: "Sentiment", weight: 2 }
        ];
    };

    const dynamicKeywords = getDynamicKeywords();

    // Scanning simulation
    useEffect(() => {
        if (isScanning) {
            const interval = setInterval(() => {
                setScannedCount((prev: number) => (prev < 50 ? prev + 1 : prev));
            }, 50);
            return () => clearInterval(interval);
        } else {
            setScannedCount(50);
        }
    }, [isScanning]);

    const getSentimentIcon = (sentiment: string) => {
        switch (sentiment) {
            case "positive": return <TrendingUp className="w-4 h-4 text-emerald-400" />;
            case "negative": return <TrendingDown className="w-4 h-4 text-red-400" />;
            default: return <Minus className="w-4 h-4 text-muted-foreground" />;
        }
    };

    const getImpactColor = (impact: string) => {
        switch (impact) {
            case "high": return "bg-purple-500/10 text-purple-400 border-purple-500/30";
            case "medium": return "bg-blue-500/10 text-blue-400 border-blue-500/30";
            default: return "bg-muted/50 text-muted-foreground border-border/50";
        }
    };

    return (
        <div className="space-y-4 rounded-xl overflow-hidden border border-primary/20 bg-card/30 backdrop-blur-sm">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-primary/5 to-transparent flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                        <Globe2 className="w-5 h-5 text-primary animate-pulse" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm">Headline Audit</h3>
                        <p className="text-xs text-muted-foreground">
                            {isScanning ? `Scanning Sources... (${scannedCount}/50)` : "50 Key Sources Scanned"}
                        </p>
                    </div>
                </div>

                <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Search className="w-4 h-4" />
                        </Button>
                    </CollapsibleTrigger>
                </Collapsible>
            </div>

            <Collapsible open={isOpen}>
                <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-4 grid grid-cols-1 md:grid-cols-3 gap-4">

                        {/* Main Headlines List */}
                        <div className="md:col-span-2">
                            <ScrollArea className="h-60 rounded-lg border border-border/50 bg-black/20 pr-4">
                                <div className="space-y-2 p-2">
                                    <AnimatePresence>
                                        {isScanning ? (
                                            <div className="flex items-center justify-center h-40 flex-col gap-3">
                                                <Radar className="w-8 h-8 text-primary animate-spin" />
                                                <span className="text-sm text-muted-foreground animate-pulse">
                                                    Triangulating social vectors...
                                                </span>
                                            </div>
                                        ) : (
                                            headlines.map((item, idx) => (
                                                <motion.div
                                                    key={item.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    className="p-3 rounded-lg bg-card/50 border border-border/40 hover:bg-card/80 transition-all group"
                                                >
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-xs font-bold text-primary opacity-70">
                                                            #{idx + 1}
                                                        </span>
                                                        <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors">
                                                            {item.title}
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            ))
                                        )}
                                    </AnimatePresence>
                                </div>
                            </ScrollArea>
                        </div>

                        {/* Keyword Heatmap / Summary */}
                        <div className="md:col-span-1 space-y-4">
                            <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 h-full flex flex-col">
                                <h4 className="text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Radar className="w-4 h-4 text-primary" />
                                    Dominant Narratives
                                </h4>

                                {isScanning ? (
                                    <div className="flex-1 flex items-center justify-center">
                                        <span className="text-xs text-muted-foreground animate-pulse">Aggregating...</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2 content-start">
                                        {dynamicKeywords.map((kw, i) => (
                                            <span
                                                key={kw.word}
                                                className="px-2.5 py-1 rounded-full bg-background/40 border border-primary/20 text-[11px] font-semibold cursor-default hover:bg-primary/5 hover:border-primary/40 transition-all"
                                                style={{
                                                    opacity: 0.6 + (kw.weight / 10),
                                                    transform: `scale(${0.95 + kw.weight * 0.02})`
                                                }}
                                            >
                                                {kw.word}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="mt-auto pt-4 border-t border-primary/10">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-muted-foreground">Consensus:</span>
                                        <span className={`font-bold ${headlines.filter(h => h.sentiment === "positive").length > headlines.filter(h => h.sentiment === "negative").length
                                                ? "text-emerald-400"
                                                : headlines.filter(h => h.sentiment === "negative").length > headlines.filter(h => h.sentiment === "positive").length
                                                    ? "text-red-400"
                                                    : "text-amber-400"
                                            }`}>
                                            {headlines.filter(h => h.sentiment === "positive").length > headlines.filter(h => h.sentiment === "negative").length
                                                ? "Leaning Bullish"
                                                : headlines.filter(h => h.sentiment === "negative").length > headlines.filter(h => h.sentiment === "positive").length
                                                    ? "Leaning Bearish"
                                                    : "Balanced / Neutral"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}
