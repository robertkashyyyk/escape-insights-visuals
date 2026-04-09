import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function SyncHealthIndicator() {
  const navigate = useNavigate();

  const { data: issueCount } = useQuery({
    queryKey: ["sync-health-count"],
    queryFn: async () => {
      // Count unowned listings
      const { count: unowned } = await supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .is("owner_id", null);

      // Check latest sync status
      const { data: latestSync } = await supabase
        .from("sync_logs")
        .select("status")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let syncIssues = 0;
      if (latestSync?.status === "error" || latestSync?.status === "completed_with_errors") {
        syncIssues = 1;
      }

      return (unowned || 0) + syncIssues;
    },
    refetchInterval: 30000,
  });

  const count = issueCount || 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => navigate("/sync-health")}
          className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
        >
          {count > 0 ? (
            <AlertTriangle className="h-4.5 w-4.5 text-amber-400" />
          ) : (
            <RefreshCw className="h-4.5 w-4.5" />
          )}
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {count > 0 ? `${count} sync issue${count > 1 ? "s" : ""} need attention` : "Sync health — all clear"}
      </TooltipContent>
    </Tooltip>
  );
}
