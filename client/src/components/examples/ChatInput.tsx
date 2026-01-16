import { ChatInput } from "../ChatInput";

export default function ChatInputExample() {
  const handleSend = (message: string) => {
    console.log("Sent message:", message);
  };

  return (
    <div className="p-4 bg-background">
      <ChatInput onSend={handleSend} />
    </div>
  );
}
