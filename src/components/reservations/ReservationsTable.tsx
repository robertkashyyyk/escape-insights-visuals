import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { differenceInDays, format, parseISO } from "date-fns";
import { useLocationGroups } from "@/hooks/useLocationGroups";

type SortKey = "guest_name" | "property" | "check_in" | "check_out" | "nights" | "lead_time" | "amount" | "platform" | "status";
type SortDir = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 250];



function statusBadgeClass(s: string) {
  switch (s.toLowerCase()) {
    case "confirmed": return "bg-primary/15 text-primary border-primary/30";
    case "cancelled": return "bg-destructive/15 text-destructive border-destructive/30";
    case "inquiry": return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    default: return "bg-secondary text-muted-foreground border-border/30";
  }
}

export function ReservationsTable() {
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState<"all" | "future" | "past">("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("check_in");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const { data: reservations, isLoading } = useQuery({
    queryKey: ["reservations_enhanced"],
    queryFn: async () => {
      // Fetch all reservations using pagination to bypass 1000-row limit
      const allData: any[] = [];
      const batchSize = 1000;
      let offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from("reservations")
          .select("*, listings(id, name, location_group)")
          .order("check_in", { ascending: false })
          .range(offset, offset + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < batchSize) break;
        offset += batchSize;
      }
      return allData;
    },
  });

  // Derive filter options from data
  const { propertyOptions, platformOptions, yearOptions } = useMemo(() => {
    if (!reservations) return { propertyOptions: [], platformOptions: [], yearOptions: [] };
    const props = new Map<string, string>();
    const plats = new Set<string>();
    const years = new Set<number>();
    for (const r of reservations) {
      const listing = r.listings as any;
      if (listing?.id && listing?.name) props.set(listing.id, listing.name);
      if (r.platform) plats.add(r.platform);
      const yr = parseISO(r.check_in).getFullYear();
      if (!isNaN(yr)) years.add(yr);
    }
    return {
      propertyOptions: [...props.entries()].sort((a, b) => a[1].localeCompare(b[1])),
      platformOptions: [...plats].sort(),
      yearOptions: [...years].sort((a, b) => a - b),
    };
  }, [reservations]);

  const processedRows = useMemo(() => {
    if (!reservations) return [];
    return reservations.map((r) => {
      const nights = Math.max(1, differenceInDays(parseISO(r.check_out), parseISO(r.check_in)));
      const leadDays = r.reservation_date
        ? Math.max(0, differenceInDays(parseISO(r.check_in), parseISO(r.reservation_date)))
        : null;
      const listing = r.listings as any;
      return {
        ...r,
        nights,
        leadDays,
        propertyName: listing?.name || "—",
        propertyId: listing?.id || null,
        locationGroup: listing?.location_group || null,
        year: parseISO(r.check_in).getFullYear(),
      };
    });
  }, [reservations]);

  const filtered = useMemo(() => {
    let rows = processedRows;

    // Time filter
    if (timeFilter === "future") rows = rows.filter((r) => r.check_in >= todayStr);
    if (timeFilter === "past") rows = rows.filter((r) => r.check_in < todayStr);

    // Search
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.guest_name.toLowerCase().includes(q) ||
          r.propertyName.toLowerCase().includes(q) ||
          r.platform?.toLowerCase().includes(q)
      );
    }

    // Filters
    if (yearFilter !== "all") rows = rows.filter((r) => r.year === parseInt(yearFilter));
    if (propertyFilter !== "all") rows = rows.filter((r) => r.propertyId === propertyFilter);
    if (locationFilter !== "all") rows = rows.filter((r) => (r.locationGroup || "Other") === locationFilter);
    if (statusFilter !== "all") rows = rows.filter((r) => r.status.toLowerCase() === statusFilter.toLowerCase());
    if (platformFilter !== "all") rows = rows.filter((r) => r.platform === platformFilter);

    // Sort — default direction depends on time filter
    const effectiveDir = sortDir;
    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "guest_name": cmp = a.guest_name.localeCompare(b.guest_name); break;
        case "property": cmp = a.propertyName.localeCompare(b.propertyName); break;
        case "check_in": cmp = a.check_in.localeCompare(b.check_in); break;
        case "check_out": cmp = a.check_out.localeCompare(b.check_out); break;
        case "nights": cmp = a.nights - b.nights; break;
        case "lead_time": cmp = (a.leadDays ?? -1) - (b.leadDays ?? -1); break;
        case "amount": cmp = (a.total_amount ?? 0) - (b.total_amount ?? 0); break;
        case "platform": cmp = (a.platform ?? "").localeCompare(b.platform ?? ""); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
      }
      return effectiveDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [processedRows, search, timeFilter, todayStr, yearFilter, propertyFilter, locationFilter, statusFilter, platformFilter, sortKey, sortDir]);

  // Stats
  const totalBookings = filtered.length;
  const totalRevenue = filtered.reduce((s, r) => s + (r.total_amount ?? 0), 0);
  const avgNights = totalBookings > 0 ? filtered.reduce((s, r) => s + r.nights, 0) / totalBookings : 0;
  const leadsWithData = filtered.filter((r) => r.leadDays != null);
  const avgLeadTime = leadsWithData.length > 0 ? leadsWithData.reduce((s, r) => s + r.leadDays!, 0) / leadsWithData.length : 0;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pagedRows = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const showFrom = filtered.length === 0 ? 0 : safePage * pageSize + 1;
  const showTo = Math.min((safePage + 1) * pageSize, filtered.length);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  };

  const hasFilters = timeFilter !== "all" || yearFilter !== "all" || propertyFilter !== "all" || locationFilter !== "all" || statusFilter !== "all" || platformFilter !== "all";

  const clearFilters = () => {
    setTimeFilter("all");
    setYearFilter("all");
    setPropertyFilter("all");
    setLocationFilter("all");
    setStatusFilter("all");
    setPlatformFilter("all");
    setSortDir("desc");
    setPage(0);
  };

  const handleTimeFilter = (mode: "all" | "future" | "past") => {
    setTimeFilter(mode);
    setSortKey("check_in");
    setSortDir(mode === "future" ? "asc" : "desc");
    setPage(0);
  };

  const SortHeader = ({ label, sortKeyVal, className }: { label: string; sortKeyVal: SortKey; className?: string }) => (
    <TableHead className={className}>
      <button onClick={() => handleSort(sortKeyVal)} className="flex items-center gap-1 hover:text-foreground transition-colors">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortKey === sortKeyVal ? "text-primary" : "text-muted-foreground/50"}`} />
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="flex flex-wrap gap-3">
        <StatPill label="Total Bookings" value={totalBookings.toLocaleString()} />
        <StatPill label="Total Revenue" value={`£${totalRevenue.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`} />
        <StatPill label="Avg Nights" value={avgNights.toFixed(1)} />
        <StatPill label="Avg Lead Time" value={`${Math.round(avgLeadTime)} days`} />
      </div>

      {/* Search + Time Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search reservations..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
        </div>

        <div className="flex items-center bg-secondary/50 rounded-lg border border-border/30 p-1">
          {(["all", "future", "past"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleTimeFilter(mode)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                timeFilter === mode
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode === "all" ? "All" : mode === "future" ? "Future Only" : "Past Only"}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect value={yearFilter} onChange={(v) => { setYearFilter(v); setPage(0); }} placeholder="Year" options={[{ value: "all", label: "All Years" }, ...yearOptions.map((y) => ({ value: String(y), label: String(y) }))]} />
        <FilterSelect
          value={propertyFilter}
          onChange={(v) => { setPropertyFilter(v); setPage(0); }}
          placeholder="Property"
          options={[{ value: "all", label: "All Properties" }, ...propertyOptions.map(([id, name]) => ({ value: id, label: name }))]}
        />
        <FilterSelect
          value={locationFilter}
          onChange={(v) => { setLocationFilter(v); setPage(0); }}
          placeholder="Location"
          options={[{ value: "all", label: "All Locations" }, ...LOCATION_GROUPS.map((g) => ({ value: g, label: g }))]}
        />
        <FilterSelect value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(0); }} placeholder="Status" options={[{ value: "all", label: "All Statuses" }, { value: "confirmed", label: "Confirmed" }, { value: "cancelled", label: "Cancelled" }, { value: "inquiry", label: "Inquiry" }]} />
        <FilterSelect
          value={platformFilter}
          onChange={(v) => { setPlatformFilter(v); setPage(0); }}
          placeholder="Platform"
          options={[{ value: "all", label: "All Platforms" }, ...platformOptions.map((p) => ({ value: p, label: p }))]}
        />
        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-primary hover:text-primary/80 transition-colors underline underline-offset-2">
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader label="Guest" sortKeyVal="guest_name" />
                <SortHeader label="Property" sortKeyVal="property" />
                <SortHeader label="Check-in" sortKeyVal="check_in" />
                <SortHeader label="Check-out" sortKeyVal="check_out" />
                <SortHeader label="Nights" sortKeyVal="nights" className="text-center" />
                <SortHeader label="Lead Time" sortKeyVal="lead_time" className="text-center" />
                <SortHeader label="Amount" sortKeyVal="amount" className="text-right" />
                <SortHeader label="Platform" sortKeyVal="platform" />
                <SortHeader label="Status" sortKeyVal="status" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">No reservations found</TableCell>
                </TableRow>
              )}
              {pagedRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.guest_name}</TableCell>
                  <TableCell>
                    {r.propertyId ? (
                      <Link to={`/properties/${r.propertyId}`} className="text-primary hover:underline underline-offset-2 transition-colors">
                        {r.propertyName}
                      </Link>
                    ) : (
                      r.propertyName
                    )}
                  </TableCell>
                  <TableCell>{format(parseISO(r.check_in), "dd MMM yyyy")}</TableCell>
                  <TableCell>{format(parseISO(r.check_out), "dd MMM yyyy")}</TableCell>
                  <TableCell className="text-center">{r.nights}</TableCell>
                  <TableCell className="text-center">
                    {r.leadDays == null ? (
                      <span className="text-muted-foreground/50">—</span>
                    ) : r.leadDays <= 1 ? (
                      <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">Same day</Badge>
                    ) : (
                      <span>{r.leadDays} days</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.total_amount != null ? `£${Number(r.total_amount).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                  </TableCell>
                  <TableCell>{r.platform || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`capitalize text-[10px] ${statusBadgeClass(r.status)}`}>
                      {r.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">
              Showing {showFrom}–{showTo} of {filtered.length} reservations
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Rows:</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
                <SelectTrigger className="w-[70px] h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)} className="text-xs">{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={safePage === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i;
              } else if (safePage < 4) {
                pageNum = i;
              } else if (safePage > totalPages - 5) {
                pageNum = totalPages - 7 + i;
              } else {
                pageNum = safePage - 3 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === safePage ? "default" : "ghost"}
                  size="icon"
                  className="h-8 w-8 text-xs"
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum + 1}
                </Button>
              );
            })}
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={safePage >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/30 bg-secondary/30">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
      <span className="text-xs font-display font-bold text-foreground">{value}</span>
    </div>
  );
}

function FilterSelect({ value, onChange, placeholder, options }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[150px] h-8 text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
