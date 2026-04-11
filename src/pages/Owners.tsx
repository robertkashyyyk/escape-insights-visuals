import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { OwnerPerformanceCard } from "@/components/owners/OwnerPerformanceCard";
import { OwnerForm } from "@/components/owners/OwnerForm";
import { useOwnerPerformance, DateMode } from "@/hooks/useOwnerPerformance";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, ChevronLeft, ChevronRight, PoundSterling, Receipt, CalendarCheck, Moon, BookOpen } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type SortKey = "revenue" | "fee" | "occupancy" | "properties" | "bookings" | "nights";

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
const fmtNum = (n: number) => n.toLocaleString("en-GB");

export default function Owners() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("revenue");
  const [dateMode, setDateMode] = useState<DateMode>("check_in");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const queryClient = useQueryClient();

  const { data: owners, isLoading } = useOwnerPerformance(year, dateMode);

  const filtered = useMemo(() => {
    if (!owners) return [];
    const q = search.toLowerCase();
    let list = owners.filter(
      (o) => o.name.toLowerCase().includes(q) || o.company?.toLowerCase().includes(q) || o.email?.toLowerCase().includes(q)
    );
    list.sort((a, b) => {
      switch (sortBy) {
        case "revenue": return b.totalRevenue - a.totalRevenue;
        case "fee": return b.managementFee - a.managementFee;
        case "occupancy": return b.avgOccupancy - a.avgOccupancy;
        case "properties": return b.propertyCount - a.propertyCount;
        case "bookings": return b.totalBookings - a.totalBookings;
        case "nights": return b.totalNights - a.totalNights;
        default: return 0;
      }
    });
    return list;
  }, [owners, search, sortBy]);

  // Portfolio-wide totals
  const totals = useMemo(() => {
    if (!filtered.length) return { revenue: 0, fee: 0, bookings: 0, nights: 0, owners: 0 };
    return filtered.reduce(
      (acc, o) => ({
        revenue: acc.revenue + o.totalRevenue,
        fee: acc.fee + o.managementFee,
        bookings: acc.bookings + o.totalBookings,
        nights: acc.nights + o.totalNights,
        owners: acc.owners + 1,
      }),
      { revenue: 0, fee: 0, bookings: 0, nights: 0, owners: 0 }
    );
  }, [filtered]);

  const editingOwner = editingId ? owners?.find((o) => o.id === editingId) : null;
  const editingOwnerRecord = editingOwner
    ? {
        id: editingOwner.id,
        name: editingOwner.name,
        company: editingOwner.company,
        email: editingOwner.email,
        phone: editingOwner.phone,
        management_rate_pct: editingOwner.managementRatePct,
        vat_inclusive: editingOwner.vatInclusive,
        notes: editingOwner.notes,
        created_at: "",
        updated_at: "",
        user_id: null,
      }
    : undefined;

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["owner_performance"] });
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">Owner Portfolios</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Portfolio performance · {year} · by {dateMode === "check_in" ? "check-in" : "booking"} date
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setYear((y) => y - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-foreground w-12 text-center">{year}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setYear((y) => y + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="glass-card p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <PoundSterling className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wider">Total Revenue</span>
            </div>
            <p className="text-xl font-display font-bold text-foreground">{isLoading ? "—" : fmt(totals.revenue)}</p>
          </div>
          <div className="glass-card p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Receipt className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wider">Total Mgmt Fees</span>
            </div>
            <p className="text-xl font-display font-bold text-foreground">{isLoading ? "—" : fmt(totals.fee)}</p>
          </div>
          <div className="glass-card p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wider">Total Bookings</span>
            </div>
            <p className="text-xl font-display font-bold text-foreground">{isLoading ? "—" : fmtNum(totals.bookings)}</p>
          </div>
          <div className="glass-card p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Moon className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wider">Total Nights</span>
            </div>
            <p className="text-xl font-display font-bold text-foreground">{isLoading ? "—" : fmtNum(totals.nights)}</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search owners..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date mode toggle */}
            <div className="flex items-center bg-secondary/50 rounded-lg p-0.5">
              <button
                onClick={() => setDateMode("check_in")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  dateMode === "check_in"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CalendarCheck className="h-3 w-3 inline mr-1.5" />
                Check-in
              </button>
              <button
                onClick={() => setDateMode("created")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  dateMode === "created"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BookOpen className="h-3 w-3 inline mr-1.5" />
                Booking Date
              </button>
            </div>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger className="w-[160px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">Sort: Revenue</SelectItem>
                <SelectItem value="fee">Sort: Mgmt Fee</SelectItem>
                <SelectItem value="bookings">Sort: Bookings</SelectItem>
                <SelectItem value="nights">Sort: Nights</SelectItem>
                <SelectItem value="occupancy">Sort: Occupancy</SelectItem>
                <SelectItem value="properties">Sort: Properties</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setShowAdd(true)} size="sm">
              <Plus className="h-4 w-4 mr-1.5" /> Add Owner
            </Button>
          </div>
        </div>

        {/* Cards */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-card p-6 space-y-3">
                <div className="flex gap-4">
                  <Skeleton className="h-12 w-48" />
                  <Skeleton className="h-12 flex-1" />
                  <Skeleton className="h-12 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <p className="text-muted-foreground text-sm">No owners found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((owner) => (
              <OwnerPerformanceCard
                key={owner.id}
                owner={owner}
                year={year}
                onEdit={setEditingId}
                onRefresh={refetch}
              />
            ))}
          </div>
        )}
      </div>

      <OwnerForm open={showAdd} onOpenChange={setShowAdd} onSuccess={refetch} />
      <OwnerForm
        open={!!editingId}
        onOpenChange={(open) => { if (!open) setEditingId(null); }}
        owner={editingOwnerRecord}
        onSuccess={refetch}
      />
    </AppLayout>
  );
}
