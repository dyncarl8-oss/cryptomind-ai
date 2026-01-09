import { ChatMessage } from "../ChatMessage";

const botMessage = {
  id: "1",
  sender: "bot" as const,
  content: "Hey there! I'm CryptoMind AI — I analyse crypto markets in real time. Pick a pair and I'll show you my prediction.",
  timestamp: new Date(),
};

const userMessage = {
  id: "2",
  sender: "user" as const,
  content: "BTC/USDT",
  timestamp: new Date(),
};

const predictionMessage = {
  id: "3",
  sender: "bot" as const,
  content: "Analysing BTC/USDT...",
  timestamp: new Date(),
  prediction: {
    pair: "BTC/USDT" as const,
    direction: "UP" as const,
    confidence: 82,
    duration: "45 seconds",
  },
};

export default function ChatMessageExample() {
  return (
    <div className="space-y-4 p-4 bg-background">
      <ChatMessage message={botMessage} />
      <ChatMessage message={userMessage} />
      <ChatMessage message={predictionMessage} />
    </div>
  );
}
