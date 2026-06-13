import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, addDays, startOfMonth, endOfMonth } from "date-fns";
import { getGrossRevenue, REVENUE_FIELDS } from "@/lib/revenue";

interface Movement {
  propertyName: string;
  guestName: string;
  type: "checkout" | "checkin";
  listingId: string;
}

interface DayCount {
  date: Date;
  label: string;
  checkouts: number;
  checkins: number;
}

interface TodayData {
  checkoutsToday: number;
  checkinsToday: number;
  movements: Movement[];
  sameDayTurnarounds: Set<string>;
  weekStrip: DayCount[];
  revenueMTD: number;
  occupancyThisWeek: number;
  bookingsNext30: number;
  dirtyProperties: number;
}

export function useTodayData() {
  const today = startOfDay(new Date());

  return useQuery<TodayData>({
    queryKey: ["today-command", format(today, "yyyy-MM-dd")],
    queryFn: async () => {
      const todayStr = format(today, "yyyy-MM-dd");
      const weekEnd = format(addDays(today, 6), "yyyy-MM-dd");
      const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");
      const next30 = format(addDays(today, 30), "yyyy-MM-dd");

      const { data: weekRes } = await supabase
        .from("reservations")
        .select("check_in, check_out, guest_name, listing_id, listings(name)")
        .or(`check_in.gte.${todayStr},check_out.gte.${todayStr}`)
        .lte("check_in", weekEnd)
        .eq("status", "confirmed");

      const { data: mtdRes } = await supabase
        .from("reservations")
        .select(REVENUE_FIELDS)
        .gte("check_in", monthStart)
        .lte("check_in", monthEnd)
        .eq("status", "confirmed");

      const { data: next30Res } = await supabase
        .from("reservations")
        .select("id")
        .gte("check_in", todayStr)
        .lte("check_in", next30)
        .eq("status", "confirmed");

      const { count: totalListings } = await supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");

      // Count dirty properties
      const { count: dirtyCount } = await (supabase
        .from("listings") as any)
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .eq("is_clean", false);

      const allRes = weekRes || [];

      const movements: Movement[] = [];
      const checkoutListings = new Set<string>();
      const checkinListings = new Set<string>();

      for (const r of allRes) {
        const listing = r.listings as any;
        const propName = listing?.name || "Unknown Property";

        if (r.check_out === todayStr) {
          movements.push({ propertyName: propName, guestName: r.guest_name, type: "checkout", listingId: r.listing_id });
          checkoutListings.add(r.listing_id);
        }
        if (r.check_in === todayStr) {
          movements.push({ propertyName: propName, guestName: r.guest_name, type: "checkin", listingId: r.listing_id });
          checkinListings.add(r.listing_id);
        }
      }

      const sameDayTurnarounds = new Set<string>();
      for (const id of checkoutListings) {
        if (checkinListings.has(id)) sameDayTurnarounds.add(id);
      }

      movements.sort((a, b) => {
        if (a.type !== b.type) return a.type === "checkout" ? -1 : 1;
        return a.propertyName.localeCompare(b.propertyName);
      });

      const weekStrip: DayCount[] = [];
      for (let i = 0; i < 7; i++) {
        const d = addDays(today, i);
        const dStr = format(d, "yyyy-MM-dd");
        let checkouts = 0;
        let checkins = 0;
        for (const r of allRes) {
          if (r.check_out === dStr) checkouts++;
          if (r.check_in === dStr) checkins++;
        }
        weekStrip.push({ date: d, label: format(d, "EEE"), checkouts, checkins });
      }

      const revenueMTD = (mtdRes || []).reduce((sum, r) => sum + getGrossRevenue(r as any), 0);

      const listingCount = totalListings || 1;
      let bookedDays = 0;
      for (const r of allRes) {
        const ci = new Date(r.check_in);
        const co = new Date(r.check_out);
        for (let i = 0; i < 7; i++) {
          const d = addDays(today, i);
          if (d >= ci && d < co) bookedDays++;
        }
      }
      const occupancyThisWeek = Math.round((bookedDays / (listingCount * 7)) * 100);

      return {
        checkoutsToday: movements.filter(m => m.type === "checkout").length,
        checkinsToday: movements.filter(m => m.type === "checkin").length,
        movements,
        sameDayTurnarounds,
        weekStrip,
        revenueMTD,
        occupancyThisWeek: Math.min(occupancyThisWeek, 100),
        bookingsNext30: (next30Res || []).length,
        dirtyProperties: dirtyCount ?? 0,
      };
    },
  });
}
