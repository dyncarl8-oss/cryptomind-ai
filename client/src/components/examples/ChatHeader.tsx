import { ChatHeader } from "../ChatHeader";

export default function ChatHeaderExample() {
  const handleNewSession = () => {
    console.log("New session started");
  };

  return (
    <div className="bg-background">
      <ChatHeader onNewSession={handleNewSession} />
    </div>
  );
}
