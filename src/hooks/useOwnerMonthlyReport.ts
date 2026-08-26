import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerPreview } from "@/contexts/OwnerPreviewContext";
import { displayName } from "@/lib/listingName";

const pad = (n: number) => String(n).padStart(2, "0");
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

function monthWindow(y: number, m: number) {
  return { ws: `${y}-${pad(m + 1)}-01`, weExcl: m === 11 ? `${y + 1}-01-01` : `${y}-${pad(m + 2)}-01` };
}
const clip = (ci: string, co: string, ws: string, weExcl: string) => {
  const s = ci > ws ? ci : ws, e = co < weExcl ? co : weExcl;
  return Math.max(0, daysBetween(s, e));
};

function monthStats(rp: any[], y: number, m: number) {
  const { ws, weExcl } = monthWindow(y, m);
  let nights = 0, revenue = 0;
  for (const r of rp) {
    if (r.check_in >= weExcl || r.check_out <= ws) continue;
    const n = clip(r.check_in, r.check_out, ws, weExcl);
    if (n <= 0) continue;
    const totalN = Math.max(1, daysBetween(r.check_in, r.check_out));
    nights += n;
    revenue += (Number(r.total_amount) || 0) * (r._f ?? 1) * (n / totalN);
  }
  const cap = daysInMonth(y, m);
  return { nights, revenue, occ: cap > 0 ? (nights / cap) * 100 : 0, adr: nights > 0 ? revenue / nights : 0 };
}

export interface ReportMonth {
  m: number; nights: number; revenue: number; occ: number; adr: number;
  prevNights: number; prevRevenue: number; prevOcc: number; prevAdr: number;
}
export interface ReportProperty { id: string; name: string; months: ReportMonth[]; }

/** Per-property, per-month performance (this year + prior year) for an owner —
 *  the in-app version of the Hostaway monthly income sheet. Bundles expanded. */
export function useOwnerMonthlyReport(year: number) {
  const { user } = useAuth();
  const { isPreviewMode, selectedOwnerId } = useOwnerPreview();

  return useQuery({
    queryKey: ["owner_monthly_report", isPreviewMode ? selectedOwnerId : user?.id, year],
    enabled: !!(isPreviewMode ? selectedOwnerId : user),
    staleTime: 60_000,
    queryFn: async (): Promise<{ year: number; properties: ReportProperty[] }> => {
      let lq = supabase.from("listings").select("id, name, internal_name, is_bundle, bundle_components, owner_id");
      if (isPreviewMode && selectedOwnerId) lq = lq.eq("owner_id", selectedOwnerId);
      const { data: listings } = await lq;
      const mine = (listings || []).filter((l: any) => (isPreviewMode ? l.owner_id === selectedOwnerId : true));
      const ids = mine.map((l: any) => l.id);
      if (ids.length === 0) return { year, properties: [] };

      const { data: resv } = await supabase
        .from("reservations")
        .select("id, listing_id, check_in, check_out, total_amount, status")
        .in("listing_id", ids)
        .eq("status", "confirmed")
        .lt("check_in", `${year + 1}-01-01`)
        .gt("check_out", `${year - 1}-01-01`);

      const bundles = new Map<string, any[]>();
      mine.filter((l: any) => l.is_bundle && Array.isArray(l.bundle_components))
        .forEach((l: any) => bundles.set(l.id, l.bundle_components));

      const expanded: any[] = [];
      (resv || []).forEach((r: any) => {
        const comps = bundles.get(r.listing_id);
        if (comps && comps.length) {
          comps.forEach((c: any) => expanded.push({ ...r, _lid: c.listing_id, _f: (c.split_pct ?? 100 / comps.length) / 100 }));
        } else {
          expanded.push({ ...r, _lid: r.listing_id, _f: 1 });
        }
      });

      const components = mine.filter((l: any) => !l.is_bundle);
      const properties: ReportProperty[] = components
        .map((l: any) => {
          const rp = expanded.filter((e) => e._lid === l.id);
          const months: ReportMonth[] = [];
          for (let m = 0; m < 12; m++) {
            const cur = monthStats(rp, year, m);
            const prev = monthStats(rp, year - 1, m);
            months.push({
              m, nights: cur.nights, revenue: cur.revenue, occ: cur.occ, adr: cur.adr,
              prevNights: prev.nights, prevRevenue: prev.revenue, prevOcc: prev.occ, prevAdr: prev.adr,
            });
          }
          return { id: l.id, name: displayName(l), months };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      return { year, properties };
    },
  });
}
