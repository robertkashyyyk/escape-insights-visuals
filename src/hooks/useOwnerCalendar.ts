import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerPreview } from "@/contexts/OwnerPreviewContext";
import { computeOrphanGapDates } from "@/lib/orphanGaps";
import {
  eachDayOfInterval, startOfMonth, endOfMonth, subMonths, addMonths, addDays,
  differenceInDays, parseISO, format,
} from "date-fns";

export interface CalBlock {
  reservationId: string;
  start: string;   // check-in  (YYYY-MM-DD)
  end: string;     // check-out (YYYY-MM-DD, exclusive)
  nights: number;
  revenue: number; // full booking value
  guest: string | null;
  platform: string | null;
  startIdx: number; // column index of first night
  span: number;     // number of night-columns
}

export interface CalProperty {
  id: string;
  name: string;
  blocks: CalBlock[];
  orphanGaps: Set<string>;   // YYYY-MM-DD orphan (unfillable) nights within window
  bookedDays: Set<string>;   // YYYY-MM-DD nights covered by a booking (for gap detection)
  occPct: number;            // occupancy across the visible window
  revenue: number;           // clipped revenue within window
  adr: number;
}

export interface OwnerCalendar {
  days: string[];            // YYYY-MM-DD, one per column
  todayStr: string;
  todayIdx: number;          // column index of today (-1 if outside window)
  properties: CalProperty[];
  summary: { sellableNights: number; potential: number; occPct: number };
}

const clampNights = (ci: string, co: string, wStart: string, wEndExcl: string) => {
  const s = ci > wStart ? ci : wStart;
  const e = co < wEndExcl ? co : wEndExcl;
  const n = differenceInDays(parseISO(e), parseISO(s));
  return Math.max(0, n);
};

/** Owner multi-calendar / tape-chart data: bookings as blocks per property across a
 *  window of today − 1 month → today + 2 months, plus orphan gaps and per-row stats. */
export function useOwnerCalendar(): { data?: OwnerCalendar; isLoading: boolean } {
  const { user } = useAuth();
  const { isPreviewMode, selectedOwnerId } = useOwnerPreview();
  const now = new Date();
  const windowStart = startOfMonth(subMonths(now, 1));
  const windowEnd = endOfMonth(addMonths(now, 2));
  const days = eachDayOfInterval({ start: windowStart, end: windowEnd }).map((d) => format(d, "yyyy-MM-dd"));
  const wStartStr = days[0];
  const wEndExcl = format(addDays(windowEnd, 1), "yyyy-MM-dd");
  const todayStr = format(now, "yyyy-MM-dd");
  const dayIndex = new Map(days.map((d, i) => [d, i]));

  const query = useQuery({
    queryKey: ["owner_calendar", isPreviewMode ? selectedOwnerId : user?.id, wStartStr],
    enabled: !!(isPreviewMode ? selectedOwnerId : user),
    staleTime: 30_000,
    refetchOnMount: true,
    queryFn: async (): Promise<OwnerCalendar> => {
      let listingsQuery = supabase
        .from("listings")
        .select("id, name, min_stay_nights, is_bundle, owner_id")
        .eq("is_bundle", false);
      if (isPreviewMode && selectedOwnerId) listingsQuery = listingsQuery.eq("owner_id", selectedOwnerId);

      const { data: listings } = await listingsQuery;
      const mine = (listings || []).filter((l: any) =>
        isPreviewMode ? l.owner_id === selectedOwnerId : true,
      );
      const ids = mine.map((l: any) => l.id);
      if (ids.length === 0) {
        return { days, todayStr, todayIdx: dayIndex.get(todayStr) ?? -1, properties: [], summary: { sellableNights: 0, potential: 0, occPct: 0 } };
      }

      const { data: resv } = await supabase
        .from("reservations")
        .select("id, listing_id, check_in, check_out, status, guest_name, platform, total_amount")
        .in("listing_id", ids)
        .eq("status", "confirmed")
        .lt("check_in", wEndExcl)
        .gt("check_out", wStartStr);

      const byListing = new Map<string, any[]>();
      (resv || []).forEach((r: any) => {
        const arr = byListing.get(r.listing_id) ?? [];
        arr.push(r);
        byListing.set(r.listing_id, arr);
      });

      const windowNights = days.length;
      const forwardDays = days.filter((d) => d >= todayStr).length; // today → window end
      let totalSellable = 0, totalPotential = 0, totalBookedFwd = 0;

      const properties: CalProperty[] = mine
        .map((l: any) => {
          const rs = byListing.get(l.id) ?? [];
          const blocks: CalBlock[] = rs
            .map((r: any) => {
              const nights = Math.max(1, differenceInDays(parseISO(r.check_out), parseISO(r.check_in)));
              const clipStart = r.check_in > wStartStr ? r.check_in : wStartStr;
              const clipEnd = r.check_out < wEndExcl ? r.check_out : wEndExcl;
              const startIdx = dayIndex.get(clipStart) ?? 0;
              const span = Math.max(1, differenceInDays(parseISO(clipEnd), parseISO(clipStart)));
              return {
                reservationId: r.id, start: r.check_in, end: r.check_out, nights,
                revenue: Number(r.total_amount) || 0, guest: r.guest_name ?? null,
                platform: r.platform ?? null, startIdx, span,
              };
            })
            .sort((a, b) => a.startIdx - b.startIdx);

          const orphanGaps = computeOrphanGapDates(
            rs.map((r: any) => ({ check_in: r.check_in, check_out: r.check_out, status: r.status })),
            l.min_stay_nights ?? 1,
          );
          // Trim orphan set to the visible window.
          const orphanInWindow = new Set<string>();
          orphanGaps.forEach((d) => { if (d >= wStartStr && d < wEndExcl) orphanInWindow.add(d); });

          // Whole-window row stats (the per-property line under the name).
          const bookedNightsWin = rs.reduce((s: number, r: any) => s + clampNights(r.check_in, r.check_out, wStartStr, wEndExcl), 0);
          const revenue = rs.reduce((s: number, r: any) => {
            const total = Number(r.total_amount) || 0;
            const totalN = Math.max(1, differenceInDays(parseISO(r.check_out), parseISO(r.check_in)));
            return s + total * (clampNights(r.check_in, r.check_out, wStartStr, wEndExcl) / totalN);
          }, 0);
          const adr = bookedNightsWin > 0 ? revenue / bookedNightsWin : 0;
          const occPct = Math.round((bookedNightsWin / windowNights) * 100);

          // Booked-day set + FORWARD-only opportunity (today → window end). You can't
          // sell the past, so sellable nights / potential only count from today on.
          const bookedDays = new Set<string>();
          let fBooked = 0, fSellable = 0;
          for (const d of days) {
            const booked = rs.some((r: any) => r.check_in <= d && d < r.check_out);
            if (booked) bookedDays.add(d);
            if (d < todayStr) continue;
            if (booked) { fBooked++; continue; }
            if (orphanInWindow.has(d)) continue; // unfillable — not an opportunity
            fSellable++;
          }
          totalSellable += fSellable;
          totalPotential += fSellable * adr; // per-property ADR
          totalBookedFwd += fBooked;

          return { id: l.id, name: l.name, blocks, orphanGaps: orphanInWindow, bookedDays, occPct, revenue, adr };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      const fwdCapacity = forwardDays * Math.max(1, properties.length);
      return {
        days, todayStr, todayIdx: dayIndex.get(todayStr) ?? -1, properties,
        summary: {
          sellableNights: totalSellable,
          potential: Math.round(totalPotential),
          occPct: fwdCapacity > 0 ? Math.round((totalBookedFwd / fwdCapacity) * 100) : 0,
        },
      };
    },
  });

  return { data: query.data, isLoading: query.isLoading };
}
