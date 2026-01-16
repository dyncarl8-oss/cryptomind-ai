import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white p-4">
                    <div className="max-w-2xl w-full bg-neutral-900 border border-red-500/30 rounded-lg p-6 shadow-xl">
                        <div className="flex items-center gap-3 mb-4 text-red-400">
                            <AlertTriangle className="w-8 h-8" />
                            <h1 className="text-xl font-bold">Application Crashed</h1>
                        </div>

                        <p className="text-neutral-400 mb-4">
                            Something went wrong while rendering the application.
                        </p>

                        {this.state.error && (
                            <div className="mb-4">
                                <h2 className="text-sm font-semibold text-neutral-300 mb-1">Error:</h2>
                                <pre className="bg-black/50 p-3 rounded text-red-300 text-xs overflow-auto max-h-40 border border-red-500/20">
                                    {this.state.error.toString()}
                                </pre>
                            </div>
                        )}

                        {this.state.errorInfo && (
                            <div>
                                <h2 className="text-sm font-semibold text-neutral-300 mb-1">Stack Trace:</h2>
                                <pre className="bg-black/50 p-3 rounded text-neutral-500 text-xs overflow-auto max-h-60 border border-white/10">
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            </div>
                        )}

                        <button
                            onClick={() => window.location.reload()}
                            className="mt-6 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded transition-colors text-sm font-medium"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
