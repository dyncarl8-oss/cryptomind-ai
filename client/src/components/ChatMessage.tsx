import { format } from "date-fns";
import { type Message } from "@shared/schema";
import { PredictionCard } from "./PredictionCard";
import logo from "@/logo.png";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isBot = message.sender === "bot";

  return (
    <div
      className={`flex gap-2 md:gap-3 lg:gap-4 ${isBot ? "justify-start" : "justify-end"}`}
      data-testid={`message-${message.sender}-${message.id}`}
    >
      {isBot && (
        <div className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 lg:w-9 lg:h-9 rounded-full flex items-center justify-center overflow-hidden">
          <img src={logo} alt="CryptoMind AI" className="w-full h-full object-contain" />
        </div>
      )}
      
      <div className={`flex flex-col gap-1 ${isBot ? "max-w-[85%] sm:max-w-[75%] lg:max-w-[70%]" : "max-w-[90%] sm:max-w-[85%] lg:max-w-[75%]"}`}>
        {isBot && (
          <div className="text-xs font-semibold uppercase text-primary">
            CryptoMind AI
          </div>
        )}
        
        <div
          className={`rounded-xl p-3 md:p-4 lg:p-5 transition-all ${
            isBot
              ? "bg-card/80 border border-card-border/60 backdrop-blur-sm shadow-sm"
              : "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-md shadow-primary/20"
          }`}
        >
          {(!message.prediction) && (
            <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </p>
          )}
          
          {message.prediction && (
            <div className="mt-2.5 md:mt-3">
              <PredictionCard prediction={message.prediction} />
            </div>
          )}
        </div>
        
        <div className="text-xs font-mono text-muted-foreground px-1">
          {format(message.timestamp, "HH:mm")}
        </div>
      </div>
    </div>
  );
}
