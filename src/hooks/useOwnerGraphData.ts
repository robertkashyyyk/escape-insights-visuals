import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerPreview } from "@/contexts/OwnerPreviewContext";
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter, startOfYear, endOfYear,
  eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
  eachQuarterOfInterval, addYears, isBefore, isAfter
} from "date-fns";

export type ZoomLevel = "Day" | "Week" | "Month" | "Quarter" | "Year";

export type GraphMetric =
  | "revenue_checkin" | "bookings_checkin" | "nights_checkin" | "occupancy_checkin" | "adr_checkin"
  | "revenue_created" | "bookings_created" | "nights_created" | "occupancy_created" | "adr_created";

export const METRIC_OPTIONS: { value: GraphMetric; label: string }[] = [
  { value: "revenue_checkin", label: "Total Revenue (Check-in)" },
  { value: "bookings_checkin", label: "Bookings (Check-in)" },
  { value: "nights_checkin", label: "Nights Sold (Check-in)" },
  { value: "occupancy_checkin", label: "% Occupancy (Check-in)" },
  { value: "adr_checkin", label: "ADR (Check-in)" },
  { value: "revenue_created", label: "Total Revenue (Booking Date)" },
  { value: "bookings_created", label: "Bookings (Booking Date)" },
  { value: "nights_created", label: "Nights Sold (Booking Date)" },
  { value: "occupancy_created", label: "% Occupancy (Booking Date)" },
  { value: "adr_created", label: "ADR (Booking Date)" },
];

export const METRIC_COLORS: Record<GraphMetric, string> = {
  revenue_checkin: "hsl(36, 90%, 50%)",
  bookings_checkin: "hsl(200, 80%, 55%)",
  nights_checkin: "hsl(270, 70%, 60%)",
  occupancy_checkin: "hsl(140, 70%, 45%)",
  adr_checkin: "hsl(340, 75%, 55%)",
  revenue_created: "hsl(36, 90%, 70%)",
  bookings_created: "hsl(200, 80%, 75%)",
  nights_created: "hsl(270, 70%, 80%)",
  occupancy_created: "hsl(140, 70%, 65%)",
  adr_created: "hsl(340, 75%, 75%)",
};

function getBuckets(from: Date, to: Date, zoom: ZoomLevel): { label: string; start: Date; end: Date }[] {
  const buckets: { label: string; start: Date; end: Date }[] = [];

  switch (zoom) {
    case "Day": {
      const days = eachDayOfInterval({ start: from, end: to });
      days.forEach(d => buckets.push({ label: format(d, "d MMM"), start: d, end: d }));
      break;
    }
    case "Week": {
      const weeks = eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 });
      weeks.forEach((w, i) => {
        const wEnd = endOfWeek(w, { weekStartsOn: 1 });
        buckets.push({ label: `W${i + 1}`, start: w, end: wEnd > to ? to : wEnd });
      });
      break;
    }
    case "Month": {
      const months = eachMonthOfInterval({ start: from, end: to });
      months.forEach(m => buckets.push({ label: format(m, "MMM"), start: m, end: endOfMonth(m) }));
      break;
    }
    case "Quarter": {
      const quarters = eachQuarterOfInterval({ start: from, end: to });
      quarters.forEach(q => {
        const qNum = Math.ceil((q.getMonth() + 1) / 3);
        buckets.push({ label: `Q${qNum}`, start: q, end: endOfQuarter(q) });
      });
      break;
    }
    case "Year": {
      let y = startOfYear(from);
      while (!isAfter(y, to)) {
        buckets.push({ label: format(y, "yyyy"), start: y, end: endOfYear(y) });
        y = addYears(y, 1);
      }
      break;
    }
  }
  return buckets;
}

function nightsInRange(ci: Date, co: Date, rangeStart: Date, rangeEnd: Date): number {
  const s = ci < rangeStart ? rangeStart : ci;
  const e = co > rangeEnd ? rangeEnd : co;
  return Math.max(0, Math.floor((e.getTime() - s.getTime()) / 86400000));
}

function totalNights(ci: Date, co: Date): number {
  return Math.max(0, Math.floor((co.getTime() - ci.getTime()) / 86400000));
}

export function useOwnerGraphData(
  metrics: GraphMetric[],
  from: Date,
  to: Date,
  zoom: ZoomLevel,
  filterListingId?: string | null
) {
  const { user } = useAuth();
  const { isPreviewMode, selectedOwnerId } = useOwnerPreview();

  return useQuery({
    queryKey: ["owner_graphs", isPreviewMode ? selectedOwnerId : user?.id, from.toISOString(), to.toISOString(), zoom, metrics, filterListingId],
    enabled: !!(isPreviewMode ? selectedOwnerId : user) && metrics.length > 0,
    queryFn: async () => {
      let listingsQuery = supabase.from("listings").select("id, is_bundle");
      if (isPreviewMode && selectedOwnerId) {
        listingsQuery = listingsQuery.eq("owner_id", selectedOwnerId);
      }
      const { data: listings } = await listingsQuery;
      const allListings = listings || [];

      // If filtering to a specific listing, scope down
      const scopedListings = filterListingId
        ? allListings.filter(l => l.id === filterListingId)
        : allListings;
      const listingIds = scopedListings.map(l => l.id);
      const nonBundleCount = scopedListings.filter(l => !(l as any).is_bundle).length || 1;

      let reservations: any[] = [];
      if (listingIds.length > 0) {
        const { data } = await supabase
          .from("reservations")
          .select("listing_id, check_in, check_out, total_amount, status, reservation_date")
          .in("listing_id", listingIds);
        reservations = (data || []).filter(r => r.status !== "cancelled");
      }

      const buckets = getBuckets(from, to, zoom);
      const now = new Date();
      const todayStr = format(now, "yyyy-MM-dd");

      const chartData = buckets.map(bucket => {
        const bStart = bucket.start;
        const bEnd = bucket.end;
        const bStartStr = format(bStart, "yyyy-MM-dd");
        const bEndStr = format(bEnd, "yyyy-MM-dd");
        const bucketDays = Math.max(1, Math.floor((bEnd.getTime() - bStart.getTime()) / 86400000) + 1);

        const row: Record<string, any> = { label: bucket.label };

        // Check-in: past (already checked in) and future (confirmed but not yet checked in)
        const checkinPast = reservations.filter(r => r.check_in <= bEndStr && r.check_out > bStartStr && r.check_in <= todayStr);
        const checkinFuture = reservations.filter(r => r.check_in <= bEndStr && r.check_out > bStartStr && r.check_in > todayStr);
        // Booking date: reservations created in this bucket
        const createdRes = reservations.filter(r => r.reservation_date && r.reservation_date >= bStartStr && r.reservation_date <= bEndStr);

        for (const m of metrics) {
          const isCreated = m.endsWith("_created");
          const isCheckin = m.endsWith("_checkin");
          const base = m.replace("_checkin", "").replace("_created", "");

          const calcValue = (set: any[]) => {
            switch (base) {
              case "revenue":
                return Math.round(set.reduce((s: number, r: any) => s + (r.total_amount || 0), 0) * 100) / 100;
              case "bookings":
                return set.length;
              case "nights": {
                if (isCreated) {
                  return set.reduce((s: number, r: any) => s + totalNights(new Date(r.check_in), new Date(r.check_out)), 0);
                }
                return set.reduce((s: number, r: any) => s + nightsInRange(new Date(r.check_in), new Date(r.check_out), bStart, bEnd), 0);
              }
              case "occupancy": {
                let nights: number;
                if (isCreated) {
                  nights = set.reduce((s: number, r: any) => s + totalNights(new Date(r.check_in), new Date(r.check_out)), 0);
                } else {
                  nights = set.reduce((s: number, r: any) => s + nightsInRange(new Date(r.check_in), new Date(r.check_out), bStart, bEnd), 0);
                }
                return Math.round((nights / (bucketDays * nonBundleCount)) * 100);
              }
              case "adr": {
                let nights: number;
                if (isCreated) {
                  nights = set.reduce((s: number, r: any) => s + totalNights(new Date(r.check_in), new Date(r.check_out)), 0);
                } else {
                  nights = set.reduce((s: number, r: any) => s + nightsInRange(new Date(r.check_in), new Date(r.check_out), bStart, bEnd), 0);
                }
                const rev = Math.round(set.reduce((s: number, r: any) => s + (r.total_amount || 0), 0) * 100) / 100;
                return nights > 0 ? Math.round((rev / nights) * 100) / 100 : 0;
              }
              default: return 0;
            }
          };

          if (isCheckin) {
            row[m] = calcValue(checkinPast);
            // Pipeline: future confirmed check-ins (stacks on top)
            row[`${m}_pipeline`] = calcValue(checkinFuture);
          } else {
            row[m] = calcValue(isCreated ? createdRes : checkinPast);
          }
        }
        return row;
      });

      return chartData;
    },
  });
}
