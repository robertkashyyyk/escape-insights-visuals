import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Pencil } from "lucide-react";
import { PropertyForm } from "./PropertyForm";

export function PropertiesTable() {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

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

  const filtered = listings?.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      l.city?.toLowerCase().includes(q) ||
      l.location_group?.toLowerCase().includes(q) ||
      l.postcode?.toLowerCase().includes(q) ||
      (l.property_owners as any)?.name?.toLowerCase().includes(q)
    );
  });

  const editingListing = editingId ? listings?.find((l) => l.id === editingId) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search properties..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> Add Property
        </Button>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location Group</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Postcode</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="text-center">Beds</TableHead>
                <TableHead className="text-center">Baths</TableHead>
                <TableHead className="text-center">Guests</TableHead>
                <TableHead className="text-right">Nightly Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    No properties found
                  </TableCell>
                </TableRow>
              )}
              {filtered?.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell>{l.location_group || "—"}</TableCell>
                  <TableCell>{l.city || "—"}</TableCell>
                  <TableCell>{l.postcode || "—"}</TableCell>
                  <TableCell>{(l.property_owners as any)?.name || "—"}</TableCell>
                  <TableCell className="text-center">{l.bedrooms ?? "—"}</TableCell>
                  <TableCell className="text-center">{l.bathrooms ?? "—"}</TableCell>
                  <TableCell className="text-center">{l.max_guests ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {l.nightly_rate != null ? `£${Number(l.nightly_rate).toFixed(0)}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={l.status === "active" ? "default" : "secondary"} className="capitalize text-xs">
                      {l.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => setEditingId(l.id)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <PropertyForm
        open={showAdd}
        onOpenChange={setShowAdd}
        onSuccess={refetch}
      />
      <PropertyForm
        open={!!editingId}
        onOpenChange={(open) => { if (!open) setEditingId(null); }}
        listing={editingListing ?? undefined}
        onSuccess={refetch}
      />
    </div>
  );
}
