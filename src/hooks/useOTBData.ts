import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, addMonths, addDays, startOfMonth, endOfMonth, parseISO } from "date-fns";

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
  monthlyData: MonthlyBucket[];
  upcomingReservations: UpcomingReservation[];
  propertySummaries: PropertyBookingSummary[];
  hasData: boolean;
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
          upcomingCheckins: rows.length,
          propertiesWithBookings: 0,
          monthlyData: [],
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

      // Monthly buckets (up to 6 months)
      const bucketCount = Math.min(Math.ceil(window / 30), 6);
      const buckets: MonthlyBucket[] = Array.from({ length: bucketCount }, (_, i) => {
        const m = addMonths(now, i);
        return { month: format(m, "MMM yyyy"), revenue: 0 };
      });
      const bucketStarts = Array.from({ length: bucketCount }, (_, i) => startOfMonth(addMonths(now, i)));
      const bucketEnds = Array.from({ length: bucketCount }, (_, i) => endOfMonth(addMonths(now, i)));

      // Property aggregation
      const propMap = new Map<string, { name: string; locationGroup: string | null; count: number; revenue: number; nextCheckIn: string }>();

      // Upcoming 14 days
      const fourteenOut = format(addDays(now, 14), "yyyy-MM-dd");
      const upcoming: UpcomingReservation[] = [];

      for (const r of rows) {
        const amount = r.total_amount ?? 0;
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

        // Monthly bucket
        for (let b = 0; b < bucketCount; b++) {
          if (checkIn >= bucketStarts[b] && checkIn <= bucketEnds[b]) {
            buckets[b].revenue += amount;
            break;
          }
        }

        // Property summary
        const existing = propMap.get(listingId);
        if (existing) {
          existing.count++;
          existing.revenue += amount;
          if (r.check_in < existing.nextCheckIn) existing.nextCheckIn = r.check_in;
        } else {
          propMap.set(listingId, { name: propName, locationGroup: locGroup, count: 1, revenue: amount, nextCheckIn: r.check_in });
        }

        // Upcoming 14 days
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
        monthlyData: buckets,
        upcomingReservations: upcoming,
        propertySummaries,
        hasData: true,
      };
    },
  });
}
