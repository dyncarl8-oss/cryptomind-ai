import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function Privacy() {
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
                    <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
                    <p className="text-muted-foreground italic">Last Updated: January 10, 2026</p>
                </div>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">1. Information We Collect</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        We collect basic account information provided through Whop, including your username, email (if shared), and resource IDs. We also store your chat history and analysis sessions to provide a consistent experience.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">2. How We Use Data</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        Your data is used solely to provide the services of CryptoMind AI. This includes managing your analysis history, calculating credits, and improving the accuracy of our AI models.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">3. Data Security</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        We implement industry-standard security measures to protect your information. Your chat sessions are private to your account and are not shared with other users or third parties for marketing purposes.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">4. Third-Party Services</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        We use third-party providers like Whop for authentication and billing. These services have their own privacy policies which govern how they handle your data.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold">5. Cookies</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        We use essential cookies and local storage to maintain your session state and preferences. These are necessary for the application to function correctly.
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
