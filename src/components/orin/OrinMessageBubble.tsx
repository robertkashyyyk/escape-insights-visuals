import { Sparkles, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
  created_at?: string;
}

export function OrinMessageBubble({ message }: { message: Message }) {
  const isOrin = message.role === "assistant";

  return (
    <div className={`flex ${isOrin ? "justify-start" : "justify-end"}`}>
      {isOrin && (
        <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center mr-2 mt-0.5 shrink-0">
          <Sparkles className="h-3 w-3 text-primary" />
        </div>
      )}
      <div className="max-w-[85%] flex flex-col">
        <div
          className={`text-xs leading-relaxed whitespace-pre-line px-3.5 py-2.5 ${
            isOrin
              ? "bg-secondary/40 text-foreground/90 rounded-2xl rounded-bl-md border-l-2 border-primary/40 border-r border-t border-b border-r-border/15 border-t-border/15 border-b-border/15"
              : "bg-primary/15 text-foreground rounded-2xl rounded-br-md border border-primary/10"
          }`}
        >
          {message.loading ? (
            <div className="flex items-center gap-2 py-1">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "200ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "400ms" }} />
              </div>
              <span className="text-muted-foreground text-[10px]">Analysing...</span>
            </div>
          ) : (
            message.content
          )}
        </div>
        {message.created_at && !message.loading && (
          <span className="text-[9px] text-muted-foreground/40 mt-1 px-1">
            {format(new Date(message.created_at), "HH:mm")}
          </span>
        )}
      </div>
    </div>
  );
}
