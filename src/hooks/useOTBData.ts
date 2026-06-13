import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, addMonths, addDays, startOfMonth, endOfMonth, parseISO, startOfISOWeek } from "date-fns";
import { getGrossRevenue } from "@/lib/revenue";

type PeriodWindow = 30 | 60 | 90 | 180;

interface ChartBucket {
  label: string;
  revenue: number;
}

interface UpcomingReservation {
  guestName: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  revenue: number;
  platform: string | null;
}

interface PropertyBookingSummary {
  listingId: string;
  propertyName: string;
  locationGroup: string | null;
  bookingCount: number;
  totalRevenue: number;
  nextCheckIn: string;
}

export interface OTBData {
  totalRevenue: number;
  totalNights: number;
  avgLeadTime: number;
  upcomingCheckins: number;
  propertiesWithBookings: number;
  chartData: ChartBucket[];
  upcomingReservations: UpcomingReservation[];
  propertySummaries: PropertyBookingSummary[];
  hasData: boolean;
}

function buildBuckets(window: PeriodWindow, now: Date): { buckets: ChartBucket[]; assign: (checkIn: Date, amount: number) => void } {
  if (window === 30) {
    // Daily buckets for 30 days
    const buckets: ChartBucket[] = Array.from({ length: 30 }, (_, i) => {
      const d = addDays(now, i);
      return { label: format(d, "dd MMM"), revenue: 0 };
    });
    const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return {
      buckets,
      assign: (checkIn, amount) => {
        const dayIndex = Math.floor((checkIn.getTime() - startDay) / (86400000));
        if (dayIndex >= 0 && dayIndex < 30) buckets[dayIndex].revenue += amount;
      },
    };
  }

  if (window === 60 || window === 90) {
    // Weekly buckets
    const weekCount = window === 60 ? 9 : 13;
    const weekMap = new Map<string, number>();
    const buckets: ChartBucket[] = [];
    for (let i = 0; i < weekCount; i++) {
      const weekStart = startOfISOWeek(addDays(now, i * 7));
      const key = format(weekStart, "yyyy-MM-dd");
      if (!weekMap.has(key)) {
        weekMap.set(key, buckets.length);
        buckets.push({ label: `w/c ${format(weekStart, "d MMM")}`, revenue: 0 });
      }
    }
    return {
      buckets,
      assign: (checkIn, amount) => {
        const ws = startOfISOWeek(checkIn);
        const key = format(ws, "yyyy-MM-dd");
        const idx = weekMap.get(key);
        if (idx !== undefined) buckets[idx].revenue += amount;
      },
    };
  }

  // 180 — monthly buckets
  const bucketCount = 6;
  const buckets: ChartBucket[] = Array.from({ length: bucketCount }, (_, i) => {
    const m = addMonths(now, i);
    return { label: format(m, "MMM yyyy"), revenue: 0 };
  });
  const starts = Array.from({ length: bucketCount }, (_, i) => startOfMonth(addMonths(now, i)));
  const ends = Array.from({ length: bucketCount }, (_, i) => endOfMonth(addMonths(now, i)));
  return {
    buckets,
    assign: (checkIn, amount) => {
      for (let b = 0; b < bucketCount; b++) {
        if (checkIn >= starts[b] && checkIn <= ends[b]) {
          buckets[b].revenue += amount;
          break;
        }
      }
    },
  };
}

export function useOTBData(window: PeriodWindow = 180) {
  return useQuery({
    queryKey: ["otb-data", window],
    queryFn: async (): Promise<OTBData> => {
      const today = format(new Date(), "yyyy-MM-dd");
      const windowEnd = format(addDays(new Date(), window), "yyyy-MM-dd");

      const { data: reservations, error } = await supabase
        .from("reservations")
        .select("*, listings(id, name, location_group)")
        .gte("check_in", today)
        .lte("check_in", windowEnd)
        .eq("status", "confirmed");

      if (error) throw error;

      const rows = reservations ?? [];
      if (rows.length === 0) {
        return {
          totalRevenue: 0,
          totalNights: 0,
          avgLeadTime: 0,
          upcomingCheckins: 0,
          propertiesWithBookings: 0,
          chartData: [],
          upcomingReservations: [],
          propertySummaries: [],
          hasData: false,
        };
      }

      const now = new Date();
      let totalRevenue = 0;
      let totalNights = 0;
      let totalLeadTimeDays = 0;
      const listingIds = new Set<string>();

      const { buckets, assign } = buildBuckets(window, now);

      const propMap = new Map<string, { name: string; locationGroup: string | null; count: number; revenue: number; nextCheckIn: string }>();
      const fourteenOut = format(addDays(now, 14), "yyyy-MM-dd");
      const upcoming: UpcomingReservation[] = [];

      for (const r of rows) {
        const amount = getGrossRevenue(r as any);
        const checkIn = parseISO(r.check_in);
        const checkOut = parseISO(r.check_out);
        const nights = Math.max(1, differenceInDays(checkOut, checkIn));
        const leadTime = Math.max(0, differenceInDays(checkIn, now));
        const listing = r.listings as any;
        const listingId = listing?.id ?? r.listing_id;
        const propName = listing?.name ?? "Unknown";
        const locGroup = listing?.location_group ?? null;

        totalRevenue += amount;
        totalNights += nights;
        totalLeadTimeDays += leadTime;
        listingIds.add(listingId);

        assign(checkIn, amount);

        const existing = propMap.get(listingId);
        if (existing) {
          existing.count++;
          existing.revenue += amount;
          if (r.check_in < existing.nextCheckIn) existing.nextCheckIn = r.check_in;
        } else {
          propMap.set(listingId, { name: propName, locationGroup: locGroup, count: 1, revenue: amount, nextCheckIn: r.check_in });
        }

        if (r.check_in <= fourteenOut) {
          upcoming.push({
            guestName: r.guest_name,
            propertyName: propName,
            checkIn: r.check_in,
            checkOut: r.check_out,
            nights,
            revenue: amount,
            platform: r.platform,
          });
        }
      }

      const count = rows.length;
      const avgLeadTime = count > 0 ? Math.round(totalLeadTimeDays / count) : 0;

      const propertySummaries: PropertyBookingSummary[] = [...propMap.entries()]
        .map(([id, v]) => ({
          listingId: id,
          propertyName: v.name,
          locationGroup: v.locationGroup,
          bookingCount: v.count,
          totalRevenue: v.revenue,
          nextCheckIn: v.nextCheckIn,
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue);

      upcoming.sort((a, b) => a.checkIn.localeCompare(b.checkIn));

      return {
        totalRevenue,
        totalNights,
        avgLeadTime,
        upcomingCheckins: count,
        propertiesWithBookings: listingIds.size,
        chartData: buckets,
        upcomingReservations: upcoming,
        propertySummaries,
        hasData: true,
      };
    },
  });
}
