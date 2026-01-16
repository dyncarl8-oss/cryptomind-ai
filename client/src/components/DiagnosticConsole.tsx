import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { ProtocolAction } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    Terminal,
    Cpu,
    Wifi,
    ShieldCheck,
    Activity,
    AlertTriangle,
    CheckCircle2,
    Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DiagnosticConsoleProps {
    logs: ProtocolAction[];
}

export function DiagnosticConsole({ logs }: DiagnosticConsoleProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [displayedLogs, setDisplayedLogs] = useState<ProtocolAction[]>([]);
    const [systemLatency, setSystemLatency] = useState(45);

    // Auto-scroll effect
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [displayedLogs]);

    // Simulate incoming log delay/typing effect
    useEffect(() => {
        if (logs.length > displayedLogs.length) {
            const nextLog = logs[displayedLogs.length];
            const timer = setTimeout(() => {
                setDisplayedLogs((prev: ProtocolAction[]) => [...prev, nextLog]);
                // Slight randomization of latency for realism
                setSystemLatency((prev: number) => Math.max(20, Math.min(150, prev + (Math.random() * 20 - 10))));
            }, 150); // Fast typing speed
            return () => clearTimeout(timer);
        }
    }, [logs, displayedLogs]);

    return (
        <div className="w-full space-y-4 font-mono text-sm">
            {/* HUD Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-lg bg-black/40 border border-primary/20 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Terminal className="w-5 h-5 text-primary animate-pulse" />
                        <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
                    </div>
                    <span className="font-bold text-primary tracking-widest uppercase">System Log: Live Diagnostics</span>
                </div>

                <div className="flex items-center gap-2 sm:gap-4">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center gap-1.5">
                        <Wifi className="w-3 h-3" />
                        <span className="hidden sm:inline">NET:</span> SECURE
                    </Badge>
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 flex items-center gap-1.5">
                        <ShieldCheck className="w-3 h-3" />
                        <span className="hidden sm:inline">ENC:</span> AES-256
                    </Badge>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Activity className="w-3 h-3 text-primary" />
                        <span>LATENCY: {Math.floor(systemLatency)}ms</span>
                    </div>
                </div>
            </div>

            {/* Main Terminal Window */}
            <div className="relative rounded-xl overflow-hidden border border-primary/30 bg-black/80 shadow-[0_0_30px_-10px_rgba(var(--primary),0.3)]">
                {/* Scanlines effect overlay */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 bg-[length:100%_2px,3px_100%]" />

                <ScrollArea className="h-64 px-4 py-4" ref={scrollRef}>
                    <div className="space-y-1.5">
                        <AnimatePresence>
                            {displayedLogs.map((log) => (
                                <motion.div
                                    key={log.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex items-start gap-3 hover:bg-white/5 p-1 rounded transition-colors"
                                >
                                    <span className="text-muted-foreground min-w-[80px] font-mono">[{log.timestamp}]</span>
                                    <span className="text-primary/70 mx-2">&gt;</span>

                                    <div className="flex-1 break-all font-mono">
                                        <span className={`${log.status === "SUCCESS" || log.status === "success" ? "text-emerald-400" :
                                                log.status === "WARNING" || log.status === "warning" ? "text-amber-400" :
                                                    log.status === "CRITICAL" || log.status === "critical" ? "text-red-400" : "text-blue-400"
                                            } uppercase mr-2`}>
                                            {log.status === "SUCCESS" || log.status === "success" ? "" : log.action}
                                        </span>
                                        <span className="text-gray-300 uppercase">{log.details || log.message}</span>
                                    </div>

                                    {log.latency && (
                                        <span className="text-xs text-muted-foreground/60 hidden sm:inline-block">
                                            {log.latency}ms
                                        </span>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Blinking cursor at the end */}
                        <motion.div
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ repeat: Infinity, duration: 0.8 }}
                            className="w-2 h-4 bg-primary inline-block ml-2 align-middle"
                        />
                    </div>
                </ScrollArea>
            </div>

            {/* Footer Status Bar */}
            <div className="flex justify-between text-[10px] text-muted-foreground px-2 uppercase tracking-wider">
                <span>System Version: v2.4.0-alpha</span>
                <span className="animate-pulse text-primary">● Live Feed Active</span>
            </div>
        </div>
    );
}
