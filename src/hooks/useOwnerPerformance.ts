import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { differenceInDays, parseISO } from "date-fns";
import { getGrossRevenue, REVENUE_FIELDS } from "@/lib/revenue";
import { periodRevenue } from "@/lib/metrics";

export type DateMode = "check_in" | "created";

export interface OwnerPerformanceRow {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  managementRatePct: number | null;
  vatInclusive: boolean;
  notes: string | null;
  propertyCount: number;
  locationGroups: string[];
  totalRevenue: number;
  managementFee: number;
  blendedAdr: number;
  avgOccupancy: number;
  totalNights: number;
  totalBookings: number;
  monthlyRevenue: number[];
  hasData: boolean;
  userId: string | null;
}

export function useOwnerPerformance(year: number, dateMode: DateMode = "check_in") {
  return useQuery({
    queryKey: ["owner_performance", year, dateMode],
    queryFn: async (): Promise<OwnerPerformanceRow[]> => {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      const dateCol = dateMode === "created" ? "reservation_date" : "check_in";

      const [ownersRes, listingsRes, reservations] = await Promise.all([
        supabase.from("property_owners").select("*").order("name"),
        supabase.from("listings").select("id, owner_id, status, location_group"),
        fetchAllRows<any>(() => supabase
          .from("reservations")
          .select(`listing_id, check_in, check_out, status, reservation_date, ${REVENUE_FIELDS}`)
          .gte(dateCol, yearStart)
          .lte(dateCol, yearEnd)
          .eq("status", "confirmed")),
      ]);

      const owners = ownersRes.data ?? [];
      const listings = listingsRes.data ?? [];

      const listingsByOwner: Record<string, typeof listings> = {};
      const listingToOwner: Record<string, string> = {};
      for (const l of listings) {
        if (!listingsByOwner[l.owner_id]) listingsByOwner[l.owner_id] = [];
        listingsByOwner[l.owner_id].push(l);
        listingToOwner[l.id] = l.owner_id;
      }

      const ownerAgg: Record<string, { revenue: number; nights: number; bookings: number; monthly: number[] }> = {};
      for (const r of reservations) {
        const ownerId = listingToOwner[r.listing_id];
        if (!ownerId) continue;
        if (!ownerAgg[ownerId]) ownerAgg[ownerId] = { revenue: 0, nights: 0, bookings: 0, monthly: new Array(12).fill(0) };
        const nights = Math.max(1, differenceInDays(parseISO(r.check_out), parseISO(r.check_in)));
        // Canonical: by check-in = gross clipped to the year; by booking-date = full gross.
        const rev = dateMode === "created" ? getGrossRevenue(r as any) : periodRevenue(r as any, yearStart, yearEnd);
        ownerAgg[ownerId].revenue += rev;
        ownerAgg[ownerId].nights += nights;
        ownerAgg[ownerId].bookings += 1;
        const refDate = dateMode === "created" && r.reservation_date ? r.reservation_date : r.check_in;
        const monthIdx = parseISO(refDate).getMonth();
        ownerAgg[ownerId].monthly[monthIdx] += rev;
      }

      return owners.map((o) => {
        const ownerListings = listingsByOwner[o.id] ?? [];
        const activeCount = ownerListings.filter((l) => l.status === "active").length;
        const locationGroups = [...new Set(ownerListings.map((l) => l.location_group).filter(Boolean))] as string[];
        const agg = ownerAgg[o.id] ?? { revenue: 0, nights: 0, bookings: 0, monthly: new Array(12).fill(0) };

        const ratePct = o.management_rate_pct ?? 0;
        const vatMultiplier = o.vat_inclusive ? 1.2 : 1.0;
        const managementFee = agg.revenue * (ratePct / 100) * vatMultiplier;
        const blendedAdr = agg.nights > 0 ? agg.revenue / agg.nights : 0;
        const avgOccupancy = activeCount > 0 ? (agg.nights / (activeCount * 365)) * 100 : 0;

        return {
          id: o.id,
          name: o.name,
          company: o.company,
          email: o.email,
          phone: o.phone,
          managementRatePct: o.management_rate_pct,
          vatInclusive: o.vat_inclusive,
          notes: o.notes,
          propertyCount: ownerListings.length,
          locationGroups,
          totalRevenue: agg.revenue,
          managementFee,
          blendedAdr,
          avgOccupancy,
          totalNights: agg.nights,
          totalBookings: agg.bookings,
          monthlyRevenue: agg.monthly,
          hasData: agg.revenue > 0,
          userId: o.user_id ?? null,
        };
      });
    },
  });
}
