import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Pencil } from "lucide-react";
import { OwnerForm } from "./OwnerForm";

export function OwnersTable() {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const { data: owners, isLoading, refetch } = useQuery({
    queryKey: ["property_owners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_owners")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: listingCounts } = useQuery({
    queryKey: ["listing_counts"],
    queryFn: async () => {
      const { data } = await supabase.from("listings").select("owner_id");
      const counts: Record<string, number> = {};
      data?.forEach((l) => { counts[l.owner_id] = (counts[l.owner_id] || 0) + 1; });
      return counts;
    },
  });

  const filtered = owners?.filter((o) => {
    const q = search.toLowerCase();
    return o.name.toLowerCase().includes(q) || o.company?.toLowerCase().includes(q) || o.email?.toLowerCase().includes(q);
  });

  const editingOwner = editingId ? owners?.find((o) => o.id === editingId) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search owners..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> Add Owner
        </Button>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Mgmt Rate %</TableHead>
                <TableHead className="text-center">Listings</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No owners found</TableCell>
                </TableRow>
              )}
              {filtered?.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.name}</TableCell>
                  <TableCell>{o.company || "—"}</TableCell>
                  <TableCell>{o.email || "—"}</TableCell>
                  <TableCell>{o.phone || "—"}</TableCell>
                  <TableCell className="text-right">{o.management_rate_pct != null ? `${o.management_rate_pct}%` : "—"}</TableCell>
                  <TableCell className="text-center">{listingCounts?.[o.id] ?? 0}</TableCell>
                  <TableCell>
                    <button onClick={() => setEditingId(o.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <OwnerForm open={showAdd} onOpenChange={setShowAdd} onSuccess={refetch} />
      <OwnerForm open={!!editingId} onOpenChange={(open) => { if (!open) setEditingId(null); }} owner={editingOwner ?? undefined} onSuccess={refetch} />
    </div>
  );
}
