import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { OrinChatPanel } from "./OrinChatPanel";

export function OrinChatFAB() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <OrinChatPanel open={open} onClose={() => setOpen(false)} />
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setOpen((prev) => !prev)}
              className="fixed bottom-6 right-6 z-50 h-13 w-13 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center group"
              style={{
                animation: "orin-pulse 3s ease-in-out infinite",
              }}
            >
              <Sparkles className="h-5 w-5 group-hover:rotate-12 transition-transform duration-300" />
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
