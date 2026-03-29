import { useState } from "react";
import { Sparkles } from "lucide-react";
import { OrinChatPanel } from "./OrinChatPanel";

export function OrinChatFAB() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <OrinChatPanel open={open} onClose={() => setOpen(false)} />
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-primary/30 hover:shadow-xl transition-all duration-300 flex items-center justify-center animate-glow-amber"
        title="Ask Orin"
      >
        <Sparkles className="h-5 w-5" />
      </button>
    </>
  );
}
