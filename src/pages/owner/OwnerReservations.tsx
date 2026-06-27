import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOwnerPreview } from "@/contexts/OwnerPreviewContext";
import { OwnerLayout } from "@/components/layout/OwnerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Home, User, PoundSterling } from "lucide-react";
import {
  format, differenceInDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter, startOfYear, endOfYear,
} from "date-fns";

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

const platformColors: Record<string, string> = {
  "airbnb": "bg-[#FF5A5F]/15 text-[#FF5A5F] border-[#FF5A5F]/30",
  "booking.com": "bg-[#003580]/15 text-[#4B8BF5] border-[#003580]/30",
  "direct": "bg-primary/15 text-primary border-primary/30",
  "vrbo": "bg-[#3C6EEF]/15 text-[#3C6EEF] border-[#3C6EEF]/30",
};

// Preset period → [startStr, endStr] for the date filter (by check-in date).
function periodRange(key: string): [string, string] | null {
  const now = new Date();
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");
  switch (key) {
    case "this_week":    return [fmt(startOfWeek(now, { weekStartsOn: 1 })), fmt(endOfWeek(now, { weekStartsOn: 1 }))];
    case "this_month":   return [fmt(startOfMonth(now)), fmt(endOfMonth(now))];
    case "this_quarter": return [fmt(startOfQuarter(now)), fmt(endOfQuarter(now))];
    case "this_year":    return [fmt(startOfYear(now)), fmt(endOfYear(now))];
    default: return null;
  }
}

export default function OwnerReservations() {
  const { user } = useAuth();
  const { isPreviewMode, selectedOwnerId, selectedOwnerName } = useOwnerPreview();
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("upcoming");
  const [sortBy, setSortBy] = useState<string>("check_in_asc");

  const { data, isLoading } = useQuery({
    queryKey: ["owner_reservations", isPreviewMode ? selectedOwnerId : user?.id],
    enabled: !!(isPreviewMode ? selectedOwnerId : user),
    queryFn: async () => {
      let listingsQuery = supabase.from("listings").select("id, name, owner_id");
      let ownerQuery = supabase.from("property_owners").select("name");

      if (isPreviewMode && selectedOwnerId) {
        listingsQuery = listingsQuery.eq("owner_id", selectedOwnerId);
        ownerQuery = ownerQuery.eq("id", selectedOwnerId);
      }

      const [listingsRes, ownerRes] = await Promise.all([listingsQuery, ownerQuery]);
      const listings = listingsRes.data || [];
      const listingIds = listings.map((l) => l.id);

      let reservations: any[] = [];
      if (listingIds.length > 0) {
        const { data } = await supabase
          .from("reservations")
          .select("*")
          .in("listing_id", listingIds)
          .order("check_in", { ascending: false });
        reservations = data || [];
      }

      return {
        listings,
        reservations,
        ownerName: ownerRes.data?.[0]?.name || "",
      };
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    if (!data) return [];
    // Owners only see confirmed bookings (not inquiries / pending / cancelled).
    let list = data.reservations.filter((r: any) => r.status === "confirmed");

    if (propertyFilter !== "all") {
      list = list.filter((r: any) => r.listing_id === propertyFilter);
    }

    if (dateFilter === "upcoming") {
      list = list.filter((r: any) => r.check_in >= today);
    } else if (dateFilter === "past") {
      list = list.filter((r: any) => r.check_out < today);
    } else if (dateFilter !== "all") {
      const range = periodRange(dateFilter); // this_week / this_month / this_quarter / this_year
      if (range) list = list.filter((r: any) => r.check_in >= range[0] && r.check_in <= range[1]);
    }

    const [field, dir] = sortBy.split("_").length === 3
      ? [sortBy.slice(0, sortBy.lastIndexOf("_")), sortBy.slice(sortBy.lastIndexOf("_") + 1)]
      : ["check_in", "desc"];
    list = [...list].sort((a: any, b: any) => {
      const cmp = String(a[field] ?? "").localeCompare(String(b[field] ?? ""));
      return dir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [data, propertyFilter, dateFilter, today, sortBy]);

  const getPropertyName = (listingId: string) =>
    data?.listings.find((l) => l.id === listingId)?.name || "Property";

  if (isLoading) {
    return (
      <OwnerLayout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </OwnerLayout>
    );
  }

  return (
    <OwnerLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">
            My Reservations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data?.ownerName ? `${data.ownerName}'s` : "Your"} properties only
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger className="w-[200px] h-9 text-xs">
              <SelectValue placeholder="All properties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All properties</SelectItem>
              {data?.listings.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="past">Past</SelectItem>
              <SelectItem value="all">All dates</SelectItem>
              <SelectItem value="this_week">This week</SelectItem>
              <SelectItem value="this_month">This month</SelectItem>
              <SelectItem value="this_quarter">This quarter</SelectItem>
              <SelectItem value="this_year">This year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[190px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="check_in_asc">Check-in (earliest first)</SelectItem>
              <SelectItem value="check_in_desc">Check-in (latest first)</SelectItem>
              <SelectItem value="check_out_asc">Check-out (earliest first)</SelectItem>
              <SelectItem value="check_out_desc">Check-out (latest first)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <Card className="border-border/30 bg-card/50 p-8 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No reservations found for these filters.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((r: any) => {
              const nights = differenceInDays(new Date(r.check_out), new Date(r.check_in));
              const guestFirstName = r.guest_name?.split(" ")[0] || "Guest";
              const platformKey = (r.platform || "").toLowerCase();
              const platformClass = platformColors[platformKey] || "bg-secondary text-secondary-foreground border-border/30";

              return (
                <Card key={r.id} className="border-border/30 bg-card/50 backdrop-blur-sm">
                  <CardContent className="p-4 md:p-5">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-display font-semibold text-foreground">{guestFirstName}</span>
                          {r.platform && (
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${platformClass}`}>
                              {r.platform}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Home className="h-3 w-3" />
                          {getPropertyName(r.listing_id)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-foreground font-medium">
                          {format(new Date(r.check_in), "d MMM")} → {format(new Date(r.check_out), "d MMM yyyy")}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {nights} {nights === 1 ? "night" : "nights"}
                        </Badge>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Revenue</p>
                        <p className="text-sm font-display font-bold text-foreground">{fmt(r.total_amount || 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </OwnerLayout>
  );
}
