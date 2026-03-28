import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, startOfDay, format, startOfWeek, startOfMonth, startOfQuarter } from "date-fns";

export type PeriodType = "Year" | "Quarter" | "Month" | "Week" | "Custom";

interface DateRange {
  from: Date;
  to: Date;
}

interface ChartBucket {
  label: string;
  revenue: number;
}

interface TopProperty {
  name: string;
  location: string;
  revenue: number;
  occupancy: number;
  bedrooms: number;
}

interface DashboardData {
  kpis: {
    totalRevenue: number;
    reservationsCount: number;
    nightsBooked: number;
    avgDailyRate: number;
    avgOccupancy: number;
  };
  chartData: ChartBucket[];
  topProperties: TopProperty[];
}

function getBucketKey(date: Date, periodType: PeriodType): string {
  switch (periodType) {
    case "Week":
      return format(startOfWeek(date, { weekStartsOn: 1 }), "MMM d");
    case "Month":
      return format(date, "MMM");
    case "Quarter":
      return `Q${Math.floor(date.getMonth() / 3) + 1}`;
    case "Year":
      return format(date, "MMM");
    case "Custom":
      return format(startOfMonth(date), "MMM yyyy");
    default:
      return format(date, "MMM");
  }
}

function generateBucketLabels(from: Date, to: Date, periodType: PeriodType): string[] {
  const labels: string[] = [];
  const current = new Date(from);

  while (current <= to) {
    const key = getBucketKey(current, periodType);
    if (!labels.includes(key)) labels.push(key);

    switch (periodType) {
      case "Week":
        current.setDate(current.getDate() + 7);
        break;
      case "Quarter":
        current.setMonth(current.getMonth() + 3);
        break;
      default:
        current.setMonth(current.getMonth() + 1);
        break;
    }
  }
  return labels;
}

export function useDashboardData(dateRange: DateRange, periodType: PeriodType) {
  return useQuery<DashboardData>({
    queryKey: ["dashboard", dateRange.from.toISOString(), dateRange.to.toISOString(), periodType],
    queryFn: async () => {
      const fromStr = format(dateRange.from, "yyyy-MM-dd");
      const toStr = format(dateRange.to, "yyyy-MM-dd");

      // Fetch reservations overlapping the date range
      const { data: reservations, error } = await supabase
        .from("reservations")
        .select("*, listings(name, city, location_group, bedrooms, owner_id)")
        .or(`check_in.lte.${toStr},check_out.gte.${fromStr}`)
        .gte("check_in", fromStr)
        .lte("check_in", toStr);

      if (error) throw error;

      // Fetch total listings count for occupancy calc
      const { count: totalListings } = await supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");

      const daysInRange = Math.max(1, differenceInDays(dateRange.to, dateRange.from) + 1);
      const listingCount = totalListings || 1;

      let totalRevenue = 0;
      let nightsBooked = 0;
      const propertyRevMap = new Map<string, { name: string; location: string; revenue: number; nights: number; bedrooms: number }>();
      const bucketRevMap = new Map<string, number>();

      for (const r of reservations || []) {
        const amount = r.total_amount || 0;
        const nights = Math.max(1, differenceInDays(new Date(r.check_out), new Date(r.check_in)));
        totalRevenue += amount;
        nightsBooked += nights;

        // Chart bucketing
        const bucketKey = getBucketKey(new Date(r.check_in), periodType);
        bucketRevMap.set(bucketKey, (bucketRevMap.get(bucketKey) || 0) + amount);

        // Top properties
        const listing = r.listings as any;
        if (listing) {
          const existing = propertyRevMap.get(r.listing_id) || {
            name: listing.name,
            location: listing.location_group || listing.city || "",
            revenue: 0,
            nights: 0,
            bedrooms: listing.bedrooms || 0,
          };
          existing.revenue += amount;
          existing.nights += nights;
          propertyRevMap.set(r.listing_id, existing);
        }
      }

      // Build chart data with all bucket labels
      const labels = generateBucketLabels(dateRange.from, dateRange.to, periodType);
      const chartData: ChartBucket[] = labels.map((label) => ({
        label,
        revenue: bucketRevMap.get(label) || 0,
      }));

      // Top properties sorted by revenue
      const topProperties: TopProperty[] = Array.from(propertyRevMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 6)
        .map((p) => ({
          name: p.name,
          location: p.location,
          revenue: p.revenue,
          occupancy: Math.round((p.nights / daysInRange) * 100),
          bedrooms: p.bedrooms,
        }));

      return {
        kpis: {
          totalRevenue,
          reservationsCount: (reservations || []).length,
          nightsBooked,
          avgDailyRate: nightsBooked > 0 ? Math.round(totalRevenue / nightsBooked) : 0,
          avgOccupancy: Math.round((nightsBooked / (listingCount * daysInRange)) * 100),
        },
        chartData,
        topProperties,
      };
    },
  });
}
