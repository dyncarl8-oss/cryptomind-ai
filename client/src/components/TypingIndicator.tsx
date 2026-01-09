import logo from "@/logo.png";

export function TypingIndicator() {
  return (
    <div className="flex gap-3 justify-start" data-testid="typing-indicator">
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden">
        <img src={logo} alt="CryptoMind AI" className="w-full h-full object-contain" />
      </div>
      
      <div className="flex flex-col gap-1">
        <div className="text-xs font-semibold uppercase text-primary">
          CryptoMind AI
        </div>
        
        <div className="bg-card border border-card-border rounded-lg p-3">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: "0.2s" }} />
            <div className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: "0.4s" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
