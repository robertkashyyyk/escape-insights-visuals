import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { displayName } from "@/lib/listingName";
import { format, addDays, startOfDay } from "date-fns";

export interface CoverageGap { group: string; count: number; }
export interface MissingClean { listingId: string; name: string; date: string; guest: string | null; }

/**
 * Two proactive safety-nets that surface problems BEFORE they bite:
 *  - coverageGaps: active properties whose location group no active cleaner covers
 *    (a settings change — renaming/combining areas, deactivating a cleaner — that
 *    would silently strand cleans as unassigned).
 *  - missingCleans: confirmed checkouts in the next few days with no live clean
 *    scheduled — a turnover about to go uncovered, whatever the cause.
 */
export function useScheduleAlerts() {
  const { data: coverageGaps = [] } = useQuery({
    queryKey: ["alerts-coverage-gaps"],
    queryFn: async (): Promise<CoverageGap[]> => {
      const [listingsRes, cleanersRes] = await Promise.all([
        supabase.from("listings").select("location_group, status, is_bundle").eq("status", "active"),
        supabase.from("cleaners").select("location_groups").eq("active", true),
      ]);
      const covered = new Set<string>();
      for (const c of (cleanersRes.data ?? []) as any[]) {
        for (const g of (c.location_groups ?? [])) covered.add(g);
      }
      const counts = new Map<string, number>();
      for (const l of (listingsRes.data ?? []) as any[]) {
        if (l.is_bundle) continue;
        const g = l.location_group;
        if (g && !covered.has(g)) counts.set(g, (counts.get(g) ?? 0) + 1);
      }
      return Array.from(counts, ([group, count]) => ({ group, count }))
        .sort((a, b) => b.count - a.count);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const { data: missingCleans = [] } = useQuery({
    queryKey: ["alerts-missing-cleans"],
    queryFn: async (): Promise<MissingClean[]> => {
      const today = startOfDay(new Date());
      const start = format(today, "yyyy-MM-dd");
      const end = format(addDays(today, 4), "yyyy-MM-dd");

      const checkouts = await fetchAllRows<any>(() =>
        supabase.from("reservations")
          .select("listing_id, check_out, guest_name, listings!reservations_listing_id_fkey(name, internal_name, is_bundle)")
          .eq("status", "confirmed")
          .gte("check_out", start)
          .lte("check_out", end));

      const { data: cleans } = await supabase.from("clean_tasks")
        .select("listing_id, scheduled_date, status")
        .gte("scheduled_date", start)
        .lte("scheduled_date", end)
        .not("status", "in", "(cancelled,canceled)");
      const liveByListingDate = new Set(
        (cleans ?? []).map((c: any) => `${c.listing_id}_${c.scheduled_date}`)
      );

      const out: MissingClean[] = [];
      const seen = new Set<string>();
      for (const r of checkouts) {
        if (r.listings?.is_bundle) continue;                 // bundles clean via components
        const key = `${r.listing_id}_${r.check_out}`;
        if (seen.has(key)) continue;
        seen.add(key);
        // A confirmed checkout with no live clean on the checkout date = missing turnover.
        if (!liveByListingDate.has(key)) {
          out.push({
            listingId: r.listing_id,
            name: displayName(r.listings) || "Unknown",
            date: r.check_out,
            guest: r.guest_name ?? null,
          });
        }
      }
      return out.sort((a, b) => a.date.localeCompare(b.date));
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  return { coverageGaps, missingCleans };
}
