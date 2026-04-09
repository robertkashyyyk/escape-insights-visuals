import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Message {
  id: string;
  role: "user" | "orin";
  text: string;
  loading?: boolean;
}

const ROUTE_LABELS: Record<string, string> = {
  "/today": "Today",
  "/dashboard": "Dashboard",
  "/properties": "Properties",
  "/reservations": "Reservations",
  "/owners": "Owner Portfolios",
  "/management": "Management Revenue",
  "/heatmap": "Occupancy Heatmap",
  "/yoy": "YoY Performance",
  "/pacing": "Revenue Pacing",
  "/forecaster": "Revenue Forecaster",
  "/pricing": "Pricing Strategy",
  "/pipeline": "Future Pipeline",
  "/orin": "The Orin Brief",
  "/settings": "Settings",
};

const SUGGESTED_PROMPTS = [
  "Why is revenue down this month?",
  "Forecast my July occupancy",
  "Which properties need pricing adjustments?",
  "Summarise my Q1 performance",
];

const PLACEHOLDER_RESPONSE = `I'm analysing your portfolio data... This feature will be fully active once the AI layer is connected. For now, here's what I can see: your portfolio has 46 properties across 8 location groups, with 2,470 reservations on record.`;

interface OrinChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export function OrinChatPanel({ open, onClose }: OrinChatPanelProps) {
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentPage = ROUTE_LABELS[location.pathname] || location.pathname;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text: text.trim() };
    const loadingMsg: Message = { id: crypto.randomUUID(), role: "orin", text: "", loading: true };
    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput("");

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id ? { ...m, text: PLACEHOLDER_RESPONSE, loading: false } : m
        )
      );
    }, 1500);
  };

  return (
    <>
      {/* Backdrop on mobile */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full flex flex-col border-l transition-transform duration-300 ease-out
          w-full md:w-[380px]
          bg-card/90 backdrop-blur-xl border-primary/10
          ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Orin</span>
              <Badge className="bg-primary/15 text-primary border-primary/20 text-[9px] px-1.5 py-0 font-semibold tracking-wider">AI</Badge>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Context line */}
        <div className="px-5 py-2 border-b border-border/10">
          <p className="text-[10px] text-muted-foreground/60">
            You're viewing: <span className="text-muted-foreground">{currentPage}</span>
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Ask Orin anything</p>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-[240px]">I can analyse your portfolio data, forecast trends, and flag opportunities.</p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "orin" && (
                <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center mr-2 mt-0.5 shrink-0">
                  <Sparkles className="h-3 w-3 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] text-xs leading-relaxed whitespace-pre-line px-3.5 py-2.5 ${
                  msg.role === "user"
                    ? "bg-primary/20 text-foreground rounded-2xl rounded-br-md border border-primary/15"
                    : "bg-secondary/40 text-foreground/90 rounded-2xl rounded-bl-md border border-border/15"
                }`}
              >
                {msg.loading ? (
                  <div className="flex items-center gap-2 py-1">
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    <span className="text-muted-foreground">Analysing...</span>
                  </div>
                ) : (
                  msg.text
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Prompt chips */}
        {messages.length === 0 && (
          <div className="px-5 pb-3 flex flex-wrap gap-1.5">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                className="text-[10px] px-3 py-1.5 rounded-full bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-border/20"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-border/20 bg-card/50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your data..."
              className="flex-1 text-xs bg-secondary/30 border border-border/20 rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-2.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-20 hover:bg-primary/90 transition-all"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
