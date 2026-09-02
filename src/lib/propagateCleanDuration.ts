import { supabase } from "@/integrations/supabase/client";

/**
 * When a property's clean duration changes, push it onto that property's
 * FUTURE, not-yet-done cleans so the schedule's time/workload maths stay correct
 * (the cleaner-facing display already reads the live value; this keeps the
 * planning figures in step). Past/completed/cancelled cleans are left as-is.
 * Best-effort: never throws — a failure here shouldn't block the property save.
 */
export async function propagateCleaningDuration(listingId: string, mins: number | null | undefined) {
  if (mins == null || !listingId) return;
  const today = new Date().toISOString().slice(0, 10);
  try {
    await (supabase.from("clean_tasks") as any)
      .update({ cleaning_duration_minutes: mins })
      .eq("listing_id", listingId)
      .gte("scheduled_date", today)
      .not("status", "in", "(completed,done,cancelled,canceled)");
  } catch {
    /* non-fatal */
  }
}
