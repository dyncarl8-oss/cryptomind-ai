import * as React from "react";
import { AuditCheck } from "@shared/schema";
import {
    CheckCircle2,
    XCircle,
    AlertCircle,
    ShieldAlert,
    TrendingUp,
    Zap,
    Activity
} from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

interface DecisionMatrixProps {
    checks: AuditCheck[];
    score: number;
}

const categoryIcons = {
    Liquidity: Activity,
    Momentum: TrendingUp,
    "Market Structure": Zap
};

const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-amber-400";
    return "text-red-400";
};

const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
        case "pass":
            return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
        case "fail":
            return "bg-red-500/10 border-red-500/30 text-red-400";
        case "warn":
            return "bg-amber-500/10 border-amber-500/30 text-amber-400";
        default:
            return "bg-muted/50 border-border/50 text-muted-foreground";
    }
};

export function DecisionMatrix({ checks, score }: DecisionMatrixProps) {
    const passedChecks = checks.filter(c => c.status === "pass" || c.status === "PASS").length;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up">
            {/* Left Column: Holistic Score */}
            <div className="md:col-span-1 flex flex-col items-center justify-center p-6 rounded-xl bg-gradient-to-br from-card to-card/50 border border-primary/10 shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(var(--primary),0.1),transparent_70%)]" />

                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-primary" />
                    Safety Score
                </h3>

                <div className="mb-4 text-sm font-medium text-muted-foreground">
                    {passedChecks}/{checks.length} Checks Passed
                </div>

                {/* Radial Gauge */}
                <div className="relative w-40 h-40 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                        {/* Background Circle */}
                        <circle
                            cx="80"
                            cy="80"
                            r="70"
                            className="stroke-muted/20"
                            strokeWidth="12"
                            fill="transparent"
                        />
                        {/* Progress Circle */}
                        <motion.circle
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: score / 100 }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            cx="80"
                            cy="80"
                            r="70"
                            className={`stroke-current ${getScoreColor(score)}`}
                            strokeWidth="12"
                            fill="transparent"
                            strokeDasharray="440" // 2 * PI * 70
                            strokeLinecap="round"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-4xl font-black ${getScoreColor(score)}`}>
                            {score}
                        </span>
                        <span className="text-xs uppercase tracking-wider text-muted-foreground mt-1">
                            / 100
                        </span>
                    </div>
                </div>

                <div className="mt-6 text-center space-y-1">
                    <p className="text-sm font-medium text-foreground">
                        {score >= 80 ? "High Integrity" : score >= 60 ? "Caution Required" : "High Risk"}
                    </p>
                </div>
            </div>

            {/* Right Column: Flat List */}
            <div className="md:col-span-2 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    <Activity className="w-4 h-4" />
                    Validation Points
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {checks.map((check, idx) => (
                        <TooltipProvider key={idx}>
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <div
                                        className={`
                                            relative p-3 rounded-lg border backdrop-blur-sm transition-all cursor-help
                                            flex items-center justify-between
                                            ${getStatusColor(check.status.toLowerCase())}
                                        `}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-1.5 rounded-full bg-background/50 backdrop-blur-md">
                                                {(check.status.toLowerCase() === "pass" || check.status === "PASS") && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                                                {(check.status.toLowerCase() === "fail" || check.status === "FAIL") && <XCircle className="w-4 h-4 text-red-400" />}
                                                {(check.status.toLowerCase() === "warn" || check.status === "WARN") && <AlertCircle className="w-4 h-4 text-amber-400" />}
                                            </div>
                                            <span className="font-medium text-sm">{check.name}</span>
                                        </div>
                                        <Badge variant="secondary" className="font-mono text-[10px] bg-background/40">
                                            {check.message || check.value}
                                        </Badge>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-black/90 border-primary/20 p-3 max-w-[250px] space-y-1">
                                    <div className="flex justify-between items-center text-xs font-bold text-primary mb-1">
                                        <span>Status: {check.status}</span>
                                        <span className={check.status.toLowerCase() === "pass" ? "text-emerald-400" : "text-red-400"}>
                                            Value: {check.value}
                                        </span>
                                    </div>
                                    {check.message && (
                                        <p className="text-xs text-muted-foreground leading-snug">
                                            {check.message}
                                        </p>
                                    )}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ))}
                </div>
            </div>
        </div>
    );
}
