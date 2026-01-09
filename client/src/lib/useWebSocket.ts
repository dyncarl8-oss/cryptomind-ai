import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface ServerMessage {
  type: "bot_message" | "typing" | "prediction" | "insufficient_credits" | "credits_update" | "analysis_stage" | "ai_thinking_stream";
  content: string;
  prediction?: {
    pair: string;
    direction: "UP" | "DOWN";
    confidence: number;
    duration: string;
  };
  credits?: number;
  stage?: "data_collection" | "technical_calculation" | "signal_aggregation" | "ai_thinking" | "final_verdict";
  progress?: number;
  status?: "pending" | "in_progress" | "complete";
  duration?: number;
  data?: any;
  thought?: string;
  fullThinking?: string;
}

interface UseWebSocketReturn {
  sendMessage: (message: any) => void;
  isConnected: boolean;
  messages: ServerMessage[];
  clearMessages: () => void;
}

interface WhopUser {
  id: string;
  username: string;
  name: string;
  profile_pic_url?: string | null;
}

export function useWebSocket(experienceId?: string): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<ServerMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const experienceIdRef = useRef(experienceId);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const isUnmountingRef = useRef(false);

  const { data: user } = useQuery<WhopUser | null>({
    queryKey: ["/api/auth/me"],
  });

  useEffect(() => {
    isUnmountingRef.current = false;
    
    const connectWebSocket = () => {
      if (isUnmountingRef.current) return;
      
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log("[WebSocket] Attempting to connect to:", wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WebSocket] Connection established");
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          console.log("[WebSocket] Received message:", event.data);
          const message: ServerMessage = JSON.parse(event.data);
          setMessages((prev) => [...prev, message]);
        } catch (error) {
          console.error("[WebSocket] Error parsing message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("[WebSocket] Error occurred:", error);
      };

      ws.onclose = (event) => {
        console.log("[WebSocket] Connection closed:", {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        setIsConnected(false);
        
        if (!isUnmountingRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connectWebSocket();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.error("[WebSocket] Max reconnection attempts reached");
        }
      };
    };

    connectWebSocket();

    return () => {
      console.log("[WebSocket] Cleaning up connection");
      isUnmountingRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const sendMessage = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const userId = user?.id || "dev_user";
      const messageWithUserId = { ...message, userId };
      wsRef.current.send(JSON.stringify(messageWithUserId));
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return { sendMessage, isConnected, messages, clearMessages };
}
