import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { createElement } from "react";

export function CleanCompletionWatcher() {
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const channel = supabase
      .channel("global-clean-completions")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "clean_tasks" },
        async (payload: any) => {
          const newRow = payload.new;
          const oldRow = payload.old;
          if (!newRow || newRow.status !== "completed") return;
          if (oldRow?.status === "completed") return;
          const dedupeKey = `${newRow.id}:${newRow.completed_at ?? ""}`;
          if (seenRef.current.has(dedupeKey)) return;
          seenRef.current.add(dedupeKey);

          const [{ data: listing }, { data: cleaner }] = await Promise.all([
            newRow.listing_id
              ? supabase.from("listings").select("name").eq("id", newRow.listing_id).maybeSingle()
              : Promise.resolve({ data: null } as any),
            newRow.assigned_cleaner_id
              ? supabase.from("cleaners" as any).select("name").eq("id", newRow.assigned_cleaner_id).maybeSingle()
              : Promise.resolve({ data: null } as any),
          ]);

          const listingName = (listing as any)?.name ?? "Property";
          const cleanerName = (cleaner as any)?.name ?? "Unassigned cleaner";
          const completedAt = newRow.completed_at ? new Date(newRow.completed_at) : new Date();
          const timeStr = format(completedAt, "h:mmaaa").replace("AM", "am").replace("PM", "pm");

          const isP0 = newRow.priority_level === 0;

          toast.success(`${listingName} — Clean Complete`, {
            description: `Completed by ${cleanerName} at ${timeStr}`,
            duration: isP0 ? 10000 : 6000,
            icon: createElement(CheckCircle2, { className: "h-4 w-4 text-green-500" }),
            className: isP0 ? "border-amber-400 border-2" : undefined,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
