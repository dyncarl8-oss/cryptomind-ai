import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import { type Message, type TradingPair, type AnalysisStage, type Timeframe, type ChatSessionWithMessages } from "@shared/schema";
import { ChatHeader } from "@/components/ChatHeader";
import { ChatMessage } from "@/components/ChatMessage";
import { PairSelector } from "@/components/PairSelector";
import { TimeframeSelector } from "@/components/TimeframeSelector";
import { TransparentAnalysis } from "@/components/TransparentAnalysisFuturistic";
import { useWebSocket } from "@/lib/useWebSocket";
import { useWhopAuth } from "@/hooks/useWhopAuth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { purchaseCredits } from "@/lib/whop-payment";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [selectedPair, setSelectedPair] = useState<TradingPair | undefined>();
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe | undefined>();
  const [awaitingTimeframeSelection, setAwaitingTimeframeSelection] = useState(false);
  const [analysisStages, setAnalysisStages] = useState<AnalysisStage[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoadedSession, setIsLoadedSession] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastProcessedIndexRef = useRef(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clearAnalysisTimerRef = useRef<NodeJS.Timeout | null>(null);
  const params = useParams<{ experienceId?: string }>();
  const experienceId = params.experienceId;
  const { isLoading, hasAccess, error } = useWhopAuth(experienceId);
  const { sendMessage, isConnected, messages: serverMessages, clearMessages } = useWebSocket(experienceId);
  const { toast } = useToast();

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      const success = await purchaseCredits({ experienceId });
      if (!success) {
        throw new Error("Purchase failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
      toast({
        title: "Welcome to Unlimited Access!",
        description: "You now have unlimited AI predictions. Analyze as many pairs as you want!",
      });
      setShowPurchaseDialog(false);
    },
    onError: () => {
      toast({
        title: "Purchase failed",
        description: "There was an error processing your purchase. Please try again.",
        variant: "destructive",
      });
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const hasInProgressAnalysis = analysisStages.some(s =>
      s.status === "in_progress" && !(s.stage === "final_verdict" && s.data)
    );
    if (!hasInProgressAnalysis) {
      scrollToBottom();
    }
  }, [messages, isTyping, analysisStages]);

  // Send welcome message on first connection
  useEffect(() => {
    if (isConnected && messages.length === 0) {
      sendMessage({ type: "new_session" });
    }
  }, [isConnected]);

  // Process server messages
  useEffect(() => {
    if (serverMessages.length === 0) {
      lastProcessedIndexRef.current = 0;
      return;
    }

    for (let i = lastProcessedIndexRef.current; i < serverMessages.length; i++) {
      const latestMessage = serverMessages[i];

      // Re-enable auto-save when new messages arrive (resume from loaded session)
      if (isLoadedSession) {
        setIsLoadedSession(false);
      }

      if (latestMessage.type === "typing") {
        setIsTyping(true);
        continue;
      }

      if (latestMessage.type === "ai_thinking_stream") {
        setAnalysisStages((prev) => {
          const existingIndex = prev.findIndex((s) => s.stage === "ai_thinking");
          if (existingIndex >= 0) {
            const updated = [...prev];
            const currentData = updated[existingIndex].data || { thinkingProcess: "", analysisTime: 0, modelUsed: "" };
            updated[existingIndex] = {
              ...updated[existingIndex],
              data: {
                ...currentData,
                thinkingProcess: (latestMessage as any).fullThinking || currentData.thinkingProcess,
              }
            };
            return updated;
          }
          return prev;
        });
        continue;
      }

      if (latestMessage.type === "analysis_stage" && latestMessage.stage) {
        if (clearAnalysisTimerRef.current) {
          clearTimeout(clearAnalysisTimerRef.current);
          clearAnalysisTimerRef.current = null;
        }

        setShowAnalysis(true);
        setIsTyping(true);

        const newStage: AnalysisStage = {
          stage: latestMessage.stage,
          progress: latestMessage.progress || 0,
          status: latestMessage.status || "pending",
          duration: latestMessage.duration,
          data: latestMessage.data,
        };

        setAnalysisStages((prev) => {
          const existingIndex = prev.findIndex((s) => s.stage === newStage.stage);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = newStage;
            return updated;
          }
          return [...prev, newStage];
        });
        continue;
      }

      if (latestMessage.type === "credits_update") {
        queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
        continue;
      }

      if (latestMessage.type === "insufficient_credits") {
        setIsTyping(false);
        setShowAnalysis(false);
        setShowPurchaseDialog(true);
        queryClient.invalidateQueries({ queryKey: ["/api/credits"] });

        const newMessage: Message = {
          id: Date.now().toString() + Math.random(),
          sender: "bot",
          content: latestMessage.content,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, newMessage]);
        continue;
      }

      setIsTyping(false);

      if (latestMessage.type === "prediction") {
        continue;
      }

      const newMessage: Message = {
        id: Date.now().toString() + Math.random(),
        sender: "bot",
        content: latestMessage.content,
        timestamp: new Date(),
        prediction: latestMessage.prediction as Message["prediction"],
      };

      setMessages((prev) => [...prev, newMessage]);
    }

    lastProcessedIndexRef.current = serverMessages.length;
  }, [serverMessages]);

  // Auto-save session when messages change
  useEffect(() => {
    // Don't save if no messages, loaded session, or no trading pair selected yet
    if (messages.length === 0 || isLoadedSession || !selectedPair) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        if (!currentSessionId) {
          const response = await apiRequest("POST", "/api/chat/sessions");
          const { sessionId } = await response.json();
          setCurrentSessionId(sessionId);

          await apiRequest("PUT", `/api/chat/sessions/${sessionId}`, {
            messages: messages.map(msg => ({
              ...msg,
              timestamp: msg.timestamp.toISOString(),
            })),
            tradingPair: selectedPair,
            timeframe: selectedTimeframe,
            analysisStages,
          });
        } else {
          await apiRequest("PUT", `/api/chat/sessions/${currentSessionId}`, {
            messages: messages.map(msg => ({
              ...msg,
              timestamp: msg.timestamp.toISOString(),
            })),
            tradingPair: selectedPair,
            timeframe: selectedTimeframe,
            analysisStages,
          });
        }

        queryClient.invalidateQueries({ queryKey: ["/api/chat/sessions"] });
      } catch (error) {
        console.error("Error saving chat session:", error);
      }
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [messages, analysisStages, selectedPair, selectedTimeframe, currentSessionId, isLoadedSession]);

  const handleLoadSession = async (sessionId: string) => {
    try {
      const response = await apiRequest("GET", `/api/chat/sessions/${sessionId}`);
      const session: ChatSessionWithMessages = await response.json();

      setMessages(
        session.messages
          .filter(msg => !msg.prediction)
          .map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }))
      );
      setSelectedPair(session.tradingPair as TradingPair | undefined);
      setSelectedTimeframe(session.timeframe as Timeframe | undefined);
      setCurrentSessionId(sessionId);
      setIsLoadedSession(true);
      setAwaitingTimeframeSelection(false);
      setAnalysisStages(session.analysisStages || []);
      setShowAnalysis((session.analysisStages || []).length > 0);
      setIsTyping(false);

      toast({
        title: "Session loaded",
        description: `Loaded conversation from ${new Date(session.updatedAt).toLocaleDateString()}`,
      });
    } catch (error) {
      console.error("Error loading session:", error);
      toast({
        title: "Failed to load session",
        description: "Could not load the selected conversation",
        variant: "destructive",
      });
    }
  };

  const handleNewSession = () => {
    setMessages([]);
    setIsTyping(false);
    setSelectedPair(undefined);
    setSelectedTimeframe(undefined);
    setAwaitingTimeframeSelection(false);
    setAnalysisStages([]);
    setShowAnalysis(false);
    setCurrentSessionId(null);
    setIsLoadedSession(false);
    clearMessages();
    sendMessage({ type: "new_session" });
  };

  const handleCryptoPairSelection = (pair: TradingPair) => {
    // Check if we should create a new session
    // Logic: If analysis is complete (prediction exists), or if it was a loaded session
    const hasExistingAnalysis = analysisStages.length > 0 && analysisStages.some(s => s.stage === "final_verdict" && s.data);

    if (hasExistingAnalysis || isLoadedSession) {
      setMessages([]);
      setIsTyping(false);
      setSelectedPair(undefined);
      setSelectedTimeframe(undefined);
      setAwaitingTimeframeSelection(false);
      setAnalysisStages([]);
      setShowAnalysis(false);
      setCurrentSessionId(null);
      setIsLoadedSession(false);
      clearMessages();
      sendMessage({ type: "new_session" });

      toast({
        title: "New Analysis Started",
        description: `Starting separate session for ${pair}. Current analysis saved to history.`,
      });
    }

    setSelectedPair(pair);
    setSelectedTimeframe(undefined);
    setAnalysisStages([]);
    setShowAnalysis(false);
    setAwaitingTimeframeSelection(true);

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      content: pair,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    setTimeout(() => {
      if (!isConnected) return;

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: "bot",
        content: `Great choice! ${pair} selected. Now choose your trading timeframe:`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    }, 500);
  };

  const handleTimeframeSelection = (timeframe: Timeframe) => {
    setSelectedTimeframe(timeframe);
    setAwaitingTimeframeSelection(false);

    // Re-enable auto-save when user interacts (resume from loaded session)
    if (isLoadedSession) {
      setIsLoadedSession(false);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      content: timeframe,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    if (selectedPair) {
      sendMessage({ type: "select_pair", pair: selectedPair, timeframe });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-background" data-testid="loading-page">
        <div className="text-center text-muted-foreground">
          Verifying...
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background" data-testid="access-denied-page">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">
            {error || "You don't have access to this experience."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="chat-page">
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-xl shadow-sm">
        <ChatHeader onNewSession={handleNewSession} onSessionSelect={handleLoadSession} />
      </header>

      <div className="flex-1 overflow-y-auto px-3 md:px-6 lg:px-12 xl:px-24 py-4 md:py-8">
        <div className="space-y-3 md:space-y-6">
          {!isConnected && (
            <div className="text-center text-muted-foreground text-sm">
              Connecting to CryptoMind AI...
            </div>
          )}

          {messages.map((message, index) => {
            const allStagesComplete = analysisStages.length > 0 && analysisStages.every(s => s.status === "complete");
            const hasFinalVerdictData = analysisStages.some(s => s.stage === "final_verdict" && s.data);
            const showPairSelector = message.sender === "bot" &&
              !message.prediction &&
              index === messages.length - 1 &&
              (analysisStages.length === 0 || allStagesComplete || hasFinalVerdictData) &&
              !awaitingTimeframeSelection;
            const showTimeframeSelector = message.sender === "bot" &&
              message.content.includes("trading timeframe") &&
              index === messages.length - 1 &&
              awaitingTimeframeSelection;
            const validTimeframes = ["M1", "M3", "M5", "M15", "M30", "M45", "H1", "H2", "H3", "H4", "D1", "W1"];
            const isUserTimeframeSelection = message.sender === "user" && message.content && validTimeframes.includes(message.content);
            const shouldShowAnalysisAfter = isUserTimeframeSelection && showAnalysis && analysisStages.length > 0;

            return (
              <div key={message.id}>
                <ChatMessage
                  message={message}
                />
                {shouldShowAnalysisAfter && (
                  <div className="ml-0 md:ml-12 mt-3 md:mt-4">
                    <TransparentAnalysis
                      stages={analysisStages}
                      tradingPair={selectedPair}
                      timeframe={selectedTimeframe}
                      onStageComplete={(stage) => {
                        if (stage === "ai_thinking") {
                          sendMessage({ type: "ai_thinking_complete" });
                        }
                      }}
                      isLoadedSession={isLoadedSession}
                    />
                  </div>
                )}
                {showPairSelector && !isTyping && (
                  <div className="mt-2 md:mt-4 ml-0 md:ml-12">
                    <PairSelector
                      onSelectPair={handleCryptoPairSelection}
                      selectedPair={selectedPair}
                    />
                  </div>
                )}
                {showTimeframeSelector && !isTyping && (
                  <div className="mt-2 md:mt-4 ml-0 md:ml-12">
                    <TimeframeSelector
                      onSelectTimeframe={handleTimeframeSelection}
                      selectedTimeframe={selectedTimeframe}
                    />
                  </div>
                )}
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>
        {/* Disclaimers & Info */}
        <div className="flex-shrink-0 px-4 pt-1.5 pb-1 bg-background/50 border-t border-border/10">
          <p className="text-[10px] text-center text-muted-foreground/40 leading-tight max-w-2xl mx-auto">
            AI can make mistakes. Always double-check results. Trading involves significant risk.{" "}
            <Link href="/risk" className="underline hover:text-primary transition-colors">Risk Disclosure</Link>
          </p>
        </div>
      </div>

      <AlertDialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg" data-testid="dialog-purchase-credits">
          <AlertDialogHeader>
            <AlertDialogTitle>Out of Credits</AlertDialogTitle>
            <AlertDialogDescription>
              You've used all your free analysis credits. Get unlimited access for $35/month to analyze as many crypto pairs as you want with no limits!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel data-testid="button-cancel-purchase">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => purchaseMutation.mutate()}
              disabled={purchaseMutation.isPending}
              data-testid="button-confirm-purchase"
            >
              {purchaseMutation.isPending ? "Processing..." : "Get Unlimited Access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
