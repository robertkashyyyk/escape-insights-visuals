import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, addMonths, startOfMonth, endOfMonth } from "date-fns";

interface MonthlyBucket {
  month: string;
  revenue: number;
}

interface UpcomingReservation {
  guestName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  revenue: number;
}

interface UpcomingByProperty {
  propertyName: string;
  reservations: UpcomingReservation[];
}

export function useOTBData() {
  return useQuery({
    queryKey: ["otb-data"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");

      const { data: reservations, error } = await supabase
        .from("reservations")
        .select("*, listings(name, city)")
        .gte("check_in", today)
        .eq("status", "confirmed");

      if (error) throw error;

      const now = new Date();
      let totalRevenue = 0;
      let totalNights = 0;
      let totalLeadTimeDays = 0;

      // Next 6 months buckets
      const buckets: MonthlyBucket[] = Array.from({ length: 6 }, (_, i) => {
        const m = addMonths(now, i);
        return { month: format(m, "MMM yyyy"), revenue: 0 };
      });
      const bucketStarts = Array.from({ length: 6 }, (_, i) => startOfMonth(addMonths(now, i)));
      const bucketEnds = Array.from({ length: 6 }, (_, i) => endOfMonth(addMonths(now, i)));

      // Upcoming 14 days grouping
      const fourteenDaysOut = new Date();
      fourteenDaysOut.setDate(fourteenDaysOut.getDate() + 14);
      const upcomingMap = new Map<string, UpcomingReservation[]>();

      for (const r of reservations || []) {
        const amount = r.total_amount || 0;
        const checkIn = new Date(r.check_in);
        const checkOut = new Date(r.check_out);
        const nights = differenceInDays(checkOut, checkIn);
        const leadTime = differenceInDays(checkIn, now);

        totalRevenue += amount;
        totalNights += nights;
        totalLeadTimeDays += leadTime;

        // Assign to monthly bucket
        for (let b = 0; b < 6; b++) {
          if (checkIn >= bucketStarts[b] && checkIn <= bucketEnds[b]) {
            buckets[b].revenue += amount;
            break;
          }
        }

        // Upcoming 14 days
        if (checkIn <= fourteenDaysOut) {
          const propName = (r.listings as any)?.name || "Unknown";
          if (!upcomingMap.has(propName)) upcomingMap.set(propName, []);
          upcomingMap.get(propName)!.push({
            guestName: r.guest_name,
            checkIn: r.check_in,
            checkOut: r.check_out,
            nights,
            revenue: amount,
          });
        }
      }

      const count = (reservations || []).length;
      const avgLeadTime = count > 0 ? Math.round(totalLeadTimeDays / count) : 0;

      const upcomingByProperty: UpcomingByProperty[] = Array.from(upcomingMap.entries())
        .map(([propertyName, reservations]) => ({ propertyName, reservations }))
        .sort((a, b) => a.propertyName.localeCompare(b.propertyName));

      return {
        totalRevenue,
        totalNights,
        avgLeadTime,
        monthlyData: buckets,
        upcomingByProperty,
      };
    },
  });
}
