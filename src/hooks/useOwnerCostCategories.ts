import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

/**
 * Per-owner cost categories for the owner report (`/owner-reports`).
 *
 * The deliberate £0-vs-null contract: a category returns a NUMBER (possibly 0) when
 * its data source exists — £0 means "genuinely nothing this period". It returns
 * `null` (with `missing: true`) when the underlying source doesn't exist yet — that
 * is a "not built / problem" signal, not a real zero. Today only Utilities is null
 * (its tables land with spec item 10).
 */
export interface CostCategory {
  value: number | null;
  missing?: boolean;          // true => source not available (render as "—" / not set up)
  note?: string;              // optional caveat, e.g. cleans with no fee set
}

export interface OwnerCostCategories {
  cleaning: CostCategory;
  consumables: CostCategory;
  laundry: CostCategory;
  maintenance: CostCategory;
  setup: CostCategory;
  welcomeBaskets: CostCategory;
  utilities: CostCategory;
}

export function useOwnerCostCategories(ownerId: string | null, periodStart: Date, periodEnd: Date) {
  const startDate = format(periodStart, "yyyy-MM-dd");
  const endDate = format(periodEnd, "yyyy-MM-dd");
  const startIso = periodStart.toISOString();
  const endIso = periodEnd.toISOString();

  return useQuery({
    queryKey: ["owner_cost_categories", ownerId, startDate, endDate],
    enabled: !!ownerId,
    queryFn: async (): Promise<OwnerCostCategories> => {
      // Owner's listings (+ cleaning fee for the Cleaning category).
      const { data: listings } = await supabase
        .from("listings")
        .select("id, cleaning_fee")
        .eq("owner_id", ownerId!);
      const ids = (listings ?? []).map((l: any) => l.id);
      const feeMap = new Map<string, number | null>((listings ?? []).map((l: any) => [l.id, l.cleaning_fee]));

      const empty: OwnerCostCategories = {
        cleaning: { value: 0 }, consumables: { value: 0 }, laundry: { value: 0 },
        maintenance: { value: 0 }, setup: { value: 0 }, welcomeBaskets: { value: 0 },
        utilities: { value: null, missing: true, note: "Utilities not set up yet" },
      };
      if (ids.length === 0) return empty;

      const [cleans, laundry, consum, tasks] = await Promise.all([
        supabase.from("clean_tasks").select("listing_id, status, scheduled_date")
          .in("listing_id", ids).eq("status", "completed")
          .gte("scheduled_date", startDate).lte("scheduled_date", endDate),
        (supabase.from as any)("laundry_charges").select("amount")
          .in("listing_id", ids).gte("charge_date", startDate).lte("charge_date", endDate),
        (supabase.from as any)("consumable_charges").select("amount")
          .in("listing_id", ids).gte("charge_date", startDate).lte("charge_date", endDate),
        (supabase.from as any)("maintenance_tasks").select("cost, type, source, billable, completed_at")
          .in("listing_id", ids).eq("billable", true)
          .gte("completed_at", startIso).lte("completed_at", endIso),
      ]);

      // Cleaning: completed turnovers x the listing's cleaning fee. Cleans on a
      // listing with no fee set are flagged (can't price them) rather than silently 0.
      let cleaning = 0, missingFee = 0;
      for (const c of (cleans.data ?? []) as any[]) {
        const fee = feeMap.get(c.listing_id);
        if (fee == null) missingFee += 1;
        else cleaning += Number(fee);
      }

      const sum = (rows: any[] | null | undefined) => (rows ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);

      let maintenance = 0, setup = 0, welcome = 0;
      for (const t of (tasks.data ?? []) as any[]) {
        const cost = Number(t.cost || 0);
        if (t.source === "welcome_basket") welcome += cost;
        else if (t.type === "setup") setup += cost;
        else maintenance += cost;
      }

      return {
        cleaning: { value: cleaning, note: missingFee > 0 ? `${missingFee} clean${missingFee === 1 ? "" : "s"} with no fee set` : undefined },
        consumables: { value: sum(consum.data) },
        laundry: { value: sum(laundry.data) },
        maintenance: { value: maintenance },
        setup: { value: setup },
        welcomeBaskets: { value: welcome },
        utilities: { value: null, missing: true, note: "Utilities not set up yet" },
      };
    },
  });
}
