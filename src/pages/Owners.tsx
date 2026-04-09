import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { OwnerPerformanceCard } from "@/components/owners/OwnerPerformanceCard";
import { OwnerForm } from "@/components/owners/OwnerForm";
import { useOwnerPerformance } from "@/hooks/useOwnerPerformance";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type SortKey = "revenue" | "fee" | "occupancy" | "properties";

export default function Owners() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("revenue");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const queryClient = useQueryClient();

  const { data: owners, isLoading } = useOwnerPerformance(year);

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
        default: return 0;
      }
    });
    return list;
  }, [owners, search, sortBy]);

  const editingOwner = editingId
    ? owners?.find((o) => o.id === editingId)
    : null;

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
            <p className="text-sm text-muted-foreground mt-1">Portfolio performance · {year}</p>
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

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search owners..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger className="w-[160px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">Sort: Revenue</SelectItem>
                <SelectItem value="fee">Sort: Mgmt Fee</SelectItem>
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
