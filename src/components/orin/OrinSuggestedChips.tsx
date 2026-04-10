import { Sparkles } from "lucide-react";

const ADMIN_CHIPS = [
  "How is revenue pacing vs last year?",
  "Which properties have the lowest occupancy this month?",
  "What is the busiest week coming up for cleaning?",
  "Which owner portfolio is performing best this quarter?",
];

const OWNER_CHIPS = [
  "How are my properties performing this month?",
  "What is my occupancy rate this year?",
  "Which of my properties has the highest ADR?",
  "What bookings do I have coming up?",
];

interface OrinSuggestedChipsProps {
  isOwner: boolean;
  ownerName: string;
  onSend: (text: string) => void;
}

export function OrinSuggestedChips({ isOwner, ownerName, onSend }: OrinSuggestedChipsProps) {
  const chips = isOwner ? OWNER_CHIPS : ADMIN_CHIPS;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const message = isOwner
    ? `${greeting}, ${ownerName}. I can see your properties. What would you like to know?`
    : `${greeting}. I have full visibility of your portfolio. What would you like to know?`;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 text-center">
      <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Sparkles className="h-7 w-7 text-primary" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground font-display">Ask Orin anything</p>
        <p className="text-xs text-muted-foreground mt-2 max-w-[280px] leading-relaxed">{message}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5 mt-2 max-w-[320px]">
        {chips.map((chip) => (
          <button
            key={chip}
            onClick={() => onSend(chip)}
            className="text-[10px] px-3 py-1.5 rounded-full bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-border/20"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
