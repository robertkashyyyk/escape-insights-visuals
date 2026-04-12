import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Search, Bed, Users, MapPin, Plus, ArrowRight, Brush, Pencil } from "lucide-react";
import { PropertyForm } from "@/components/properties/PropertyForm";
import { Link } from "react-router-dom";

export default function Properties() {
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [cleanFilter, setCleanFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: listings, isLoading, refetch } = useQuery({
    queryKey: ["listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*, property_owners(name)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const locationGroups = [...new Set(listings?.map((l) => l.location_group).filter(Boolean) as string[])].sort();
  const owners = [...new Set(listings?.map((l) => (l.property_owners as any)?.name).filter(Boolean) as string[])].sort();

  const filtered = listings?.filter((l) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      l.name.toLowerCase().includes(q) ||
      l.city?.toLowerCase().includes(q) ||
      l.location_group?.toLowerCase().includes(q) ||
      (l.property_owners as any)?.name?.toLowerCase().includes(q);
    const matchesLocation = locationFilter === "all" || l.location_group === locationFilter;
    const matchesOwner = ownerFilter === "all" || (l.property_owners as any)?.name === ownerFilter;
    const isClean = (l as any).is_clean ?? true;
    const matchesClean = cleanFilter === "all" || (cleanFilter === "clean" && isClean) || (cleanFilter === "dirty" && !isClean);
    return matchesSearch && matchesLocation && matchesOwner && matchesClean;
  });

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">Properties</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage all your short-term rental listings</p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search properties..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[180px] h-9 text-xs border-border/50"><SelectValue placeholder="Location Group" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locationGroups.map((lg) => <SelectItem key={lg} value={lg}>{lg}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-[180px] h-9 text-xs border-border/50"><SelectValue placeholder="Owner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              {owners.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <ToggleGroup
            type="single"
            value={cleanFilter}
            onValueChange={(v) => v && setCleanFilter(v)}
            size="sm"
            className="border border-border rounded-lg p-0.5"
          >
            <ToggleGroupItem value="all" className="text-xs px-3">All</ToggleGroupItem>
            <ToggleGroupItem value="clean" className="text-xs px-3">Clean</ToggleGroupItem>
            <ToggleGroupItem value="dirty" className="text-xs px-3">Dirty</ToggleGroupItem>
          </ToggleGroup>
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-sm text-muted-foreground font-medium">
              {isLoading ? "…" : `${filtered?.length ?? 0} Properties`}
            </span>
            <Button onClick={() => setShowAdd(true)} size="sm">
              <Plus className="h-4 w-4 mr-1.5" /> Add Property
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        ) : filtered?.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">No properties found</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered?.map((l) => {
              const ownerName = (l.property_owners as any)?.name;
              const cleaner = (l as any).primary_cleaner;
              const isClean = (l as any).is_clean ?? true;
              return (
                <div
                  key={l.id}
                  className="glass-card rounded-xl border border-border/30 border-l-2 border-l-primary/60 p-5 flex flex-col gap-3 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 hover:border-l-primary relative"
                >
                  {/* Dirty indicator dot */}
                  {!isClean && (
                    <div className="absolute top-3 right-3 h-3 w-3 rounded-full bg-red-500 animate-pulse" title="Needs cleaning" />
                  )}

                  <div>
                    <h3 className="font-display font-bold text-foreground text-base truncate">{l.name}</h3>
                    {ownerName && <p className="text-xs text-muted-foreground mt-0.5 truncate">{ownerName}</p>}
                  </div>

                  {l.location_group && (
                    <div>
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-primary/30 text-primary">
                        {l.location_group}
                      </Badge>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {l.bedrooms != null && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-secondary/40 px-2 py-0.5 rounded-md">
                        <Bed className="h-3 w-3" /> {l.bedrooms} bed{l.bedrooms !== 1 ? "s" : ""}
                      </span>
                    )}
                    {l.max_guests != null && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-secondary/40 px-2 py-0.5 rounded-md">
                        <Users className="h-3 w-3" /> {l.max_guests} guests
                      </span>
                    )}
                    {l.city && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-secondary/40 px-2 py-0.5 rounded-md">
                        <MapPin className="h-3 w-3" /> {l.city}
                      </span>
                    )}
                    {cleaner && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-secondary/40 px-2 py-0.5 rounded-md">
                        <Brush className="h-3 w-3" /> {cleaner}
                      </span>
                    )}
                  </div>

                  <div className="mt-auto flex items-center justify-between pt-2 border-t border-border/20">
                    <span className="text-[10px] text-muted-foreground/50 font-mono truncate max-w-[140px]">{l.id.slice(0, 8)}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingId(l.id)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                        title="Edit property"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <Link to={`/properties/${l.id}`} className="text-xs text-primary font-medium flex items-center gap-1 hover:underline transition-colors">
                        View Details <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <PropertyForm open={showAdd} onOpenChange={setShowAdd} onSuccess={refetch} />
        <PropertyForm
          open={!!editingId}
          onOpenChange={(open) => { if (!open) setEditingId(null); }}
          listing={editingId ? listings?.find(l => l.id === editingId) ?? undefined : undefined}
          onSuccess={refetch}
        />
      </div>
    </AppLayout>
  );
}
