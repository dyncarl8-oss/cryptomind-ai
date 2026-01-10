import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function Terms() {
    return (
        <div className="min-h-screen w-full bg-background text-foreground p-6 md:p-12 overflow-y-auto">
            <div className="max-w-3xl mx-auto space-y-8 pb-12">
                <Link href="/">
                    <Button variant="ghost" size="sm" className="gap-2 mb-4">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Chat
                    </Button>
                </Link>

                <div className="space-y-4">
                    <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
                    <p className="text-muted-foreground italic">Last Updated: January 10, 2026</p>
                </div>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">1. Acceptance of Terms</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        By accessing and using CryptoMind AI, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you must not use our services.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">2. Description of Service</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        CryptoMind AI provides an AI-driven market analysis tool for informational purposes. Our service includes technical indicator analysis, sentiment evaluation, and AI-generated trading hypotheses.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">3. Use License</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        We grant you a limited, non-exclusive, non-transferable license to access the service for personal, non-commercial use. You may not reverse engineer, decompile, or attempt to extract the source code of the service.
                    </p>
                </section>

                <section className="space-y-4 border-l-4 border-primary/50 pl-6 py-2 bg-primary/5 rounded-r-lg">
                    <h2 className="text-2xl font-semibold">4. User Responsibility</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        You are solely responsible for your trading decisions. CryptoMind AI is an analytical tool, not a financial advisor. Any trades made based on information from our platform are done at your own risk.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">5. Limitation of Liability</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        In no event shall CryptoMind AI, its developers, or its affiliates be liable for any financial losses, data loss, or damages arising out of the use or inability to use the service.
                    </p>
                </section>

                <Separator className="my-8" />

                <p className="text-sm text-muted-foreground text-center">
                    &copy; 2026 CryptoMind AI. All rights reserved.
                </p>
            </div>
        </div>
    );
}

function Separator({ className }: { className?: string }) {
    return <div className={`h-[1px] w-full bg-border ${className}`} />;
}
