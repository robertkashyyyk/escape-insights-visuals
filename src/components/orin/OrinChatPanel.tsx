import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "orin";
  text: string;
}

const SUGGESTED_PROMPTS = [
  "Why is revenue down this month?",
  "Forecast my July occupancy",
  "Which properties need pricing adjustments?",
  "Summarize my Q1 performance",
];

const PLACEHOLDER_RESPONSES: Record<string, string> = {
  default: `Based on my analysis of your portfolio data, here's what I'm seeing:\n\nRevenue is trending 8% above last year's pace, primarily driven by improved ADR in the coastal cluster. However, I've identified 3 properties where occupancy has dropped below 60% — these are likely being suppressed by the Airbnb algorithm due to stale content.\n\nWould you like me to drill into a specific property or metric?`,
  "Why is revenue down this month?": `Your revenue this month is actually tracking 3.2% above last month, but I understand the concern — it *feels* lower because April 2025 was an outlier month (Easter timing shifted demand forward).\n\nOn a seasonally-adjusted basis, you're performing within expected range. The real area of concern is June forward bookings, which are 22% behind last year's pace at this point in time.`,
  "Forecast my July occupancy": `Based on historical booking curves and current on-the-books data, I project July occupancy at 82-86% for the portfolio.\n\nCoastal properties: 89-93% (strong demand signals)\nInland properties: 71-76% (lagging, but within seasonal norms)\n\nYou currently have 64% of July already booked. Historically, 78% of final July bookings are made by this date, suggesting you're slightly behind pace. Consider activating early-bird promotions for the remaining inventory.`,
  "Which properties need pricing adjustments?": `I've identified 4 properties that would benefit from immediate pricing adjustments:\n\n1. **Villa Serena** — Minimum rate is 12% above market for comparable units. Recommend reducing to capture last-minute demand.\n2. **Casa del Sol** — Weekend rates could increase by £15-20/night based on demand patterns.\n3. **Apartamento Brisa** — Midweek rates are competitive but minimum stay requirement of 3 nights is blocking 1-2 night bookings that represent 31% of search demand.\n4. **Penthouse Azul** — Underpriced by approximately 8% relative to quality score. Safe to increase gradually.`,
  "Summarize my Q1 performance": `Q1 2026 closed at £398,200 in gross revenue — up 12.4% year-over-year.\n\n**Key highlights:**\n• ADR increased 5.2% to £186/night\n• Direct bookings grew from 24% to 31% of revenue\n• 3 new properties onboarded, contributing £28,100\n\n**Areas of concern:**\n• January storm disruptions caused 47 cancellations (£31K impact)\n• 3 properties consistently underperform their location group by >15%\n• Midweek occupancy remains soft at 64%\n\nOverall, a solid quarter with room to optimize underperformers.`,
};

interface OrinChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export function OrinChatPanel({ open, onClose }: OrinChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text: text.trim() };
    const response = PLACEHOLDER_RESPONSES[text.trim()] || PLACEHOLDER_RESPONSES.default;
    const orinMsg: Message = { id: crypto.randomUUID(), role: "orin", text: response };
    setMessages((prev) => [...prev, userMsg, orinMsg]);
    setInput("");
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-20 right-6 z-50 w-[380px] h-[520px] flex flex-col rounded-2xl border border-border/30 bg-card/80 backdrop-blur-xl shadow-2xl animate-fade-in overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-display font-semibold text-foreground">Ask Orin</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">How can I help?</p>
              <p className="text-xs text-muted-foreground mt-1">Ask me anything about your portfolio</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] text-xs leading-relaxed whitespace-pre-line px-3 py-2.5 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-t-lg rounded-bl-lg"
                  : "bg-secondary/60 border-l-2 border-primary/30 text-foreground rounded-t-lg rounded-br-lg"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Prompt chips */}
      {messages.length === 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSend(prompt)}
              className="text-[10px] px-2.5 py-1.5 rounded-md bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-border/20"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-3 border-t border-border/30">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your data..."
            className="flex-1 text-xs bg-secondary/40 border border-border/20 rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-30 hover:bg-primary/90 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
