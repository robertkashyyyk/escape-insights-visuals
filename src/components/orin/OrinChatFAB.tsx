import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { OrinChatPanel } from "./OrinChatPanel";
import { supabase } from "@/integrations/supabase/client";

export function OrinChatFAB() {
  const [open, setOpen] = useState(false);
  const [hasNewBrief, setHasNewBrief] = useState(false);

  // Check for unread brief (last 24h)
  useEffect(() => {
    const checkBrief = async () => {
      const since = new Date(Date.now() - 86400000).toISOString();
      const { count } = await supabase
        .from("orin_briefs")
        .select("id", { count: "exact", head: true })
        .eq("status", "complete")
        .gte("created_at", since);
      setHasNewBrief((count ?? 0) > 0);
    };
    checkBrief();
  }, []);

  return (
    <>
      <OrinChatPanel open={open} onClose={() => setOpen(false)} />
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => { setOpen((prev) => !prev); setHasNewBrief(false); }}
              className="fixed bottom-6 right-6 z-50 h-[52px] w-[52px] rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center group"
              style={{ animation: "orin-pulse 3s ease-in-out infinite" }}
            >
              <Sparkles className="h-5 w-5 group-hover:rotate-12 transition-transform duration-300" />
              {hasNewBrief && (
                <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary border-2 border-background animate-pulse" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="bg-card border-border/40 text-xs">
            Ask Orin
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <style>{`
        @keyframes orin-pulse {
          0%, 100% { box-shadow: 0 0 0 0 hsl(38 92% 50% / 0.3), 0 8px 24px -4px hsl(38 92% 50% / 0.2); }
          50% { box-shadow: 0 0 20px 4px hsl(38 92% 50% / 0.15), 0 8px 24px -4px hsl(38 92% 50% / 0.3); }
        }
      `}</style>
    </>
  );
}
