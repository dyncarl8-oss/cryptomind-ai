import { useState } from "react";
import { PaperAirplaneIcon } from "@heroicons/react/24/solid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput("");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-2 items-center"
      data-testid="chat-input-form"
    >
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type a message or crypto pair..."
        className="flex-1"
        disabled={disabled}
        data-testid="input-message"
      />
      <Button
        type="submit"
        size="icon"
        disabled={!input.trim() || disabled}
        data-testid="button-send"
      >
        <PaperAirplaneIcon className="w-5 h-5" />
      </Button>
    </form>
  );
}
