import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Plus, Archive, ArchiveRestore, ArrowUp, ArrowDown, Pencil, Check, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Row {
  id: string;
  name: string;
  display_order: number;
  archived: boolean;
  usage_count?: number;
}

export function LocationGroupsSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["location_groups_admin"],
    queryFn: async () => {
      const [{ data: groups }, { data: listings }] = await Promise.all([
        (supabase.from as any)("location_groups")
          .select("id, name, display_order, archived")
          .order("archived", { ascending: true })
          .order("display_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase.from("listings").select("location_group"),
      ]);
      const counts = new Map<string, number>();
      for (const l of listings ?? []) {
        const g = (l as any).location_group;
        if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
      }
      return ((groups ?? []) as Row[]).map(r => ({ ...r, usage_count: counts.get(r.name) ?? 0 }));
    },
  });

  // Find legacy free-text groups on listings that aren't in the managed table yet.
  const managedNames = new Set(rows.map(r => r.name));
  const { data: legacyGroups = [] } = useQuery({
    queryKey: ["location_groups_legacy", Array.from(managedNames).sort().join("|")],
    queryFn: async () => {
      const { data } = await supabase.from("listings").select("location_group");
      const counts = new Map<string, number>();
      for (const l of data ?? []) {
        const g = (l as any).location_group;
        if (g && !managedNames.has(g)) counts.set(g, (counts.get(g) ?? 0) + 1);
      }
      return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["location_groups_admin"] });
    qc.invalidateQueries({ queryKey: ["location_groups"] });
    qc.invalidateQueries({ queryKey: ["location_groups_legacy"] });
  };

  const handleAdd = async (name?: string) => {
    const value = (name ?? newName).trim();
    if (!value) return;
    const nextOrder = rows.length > 0 ? Math.max(...rows.map(r => r.display_order)) + 1 : 0;
    const { error } = await (supabase.from as any)("location_groups")
      .insert({ name: value, display_order: nextOrder });
    if (error) {
      toast({ title: "Could not add", description: error.message, variant: "destructive" });
      return;
    }
    setNewName("");
    invalidate();
  };

  const handleRename = async (id: string) => {
    const value = editingName.trim();
    if (!value) return;
    const original = rows.find(r => r.id === id);
    const { error } = await (supabase.from as any)("location_groups")
      .update({ name: value }).eq("id", id);
    if (error) {
      toast({ title: "Could not rename", description: error.message, variant: "destructive" });
      return;
    }
    // Cascade to listings using the old name
    if (original && original.name !== value) {
      await supabase.from("listings").update({ location_group: value }).eq("location_group", original.name);
    }
    setEditingId(null);
    setEditingName("");
    qc.invalidateQueries({ queryKey: ["properties"] });
    invalidate();
  };

  const handleToggleArchive = async (row: Row) => {
    if (!row.archived && (row.usage_count ?? 0) > 0) {
      toast({
        title: "Cannot archive — group is in use",
        description: `${row.usage_count} ${row.usage_count === 1 ? "property is" : "properties are"} still using "${row.name}". Reassign them first.`,
        variant: "destructive",
      });
      return;
    }
    const { error } = await (supabase.from as any)("location_groups")
      .update({ archived: !row.archived }).eq("id", row.id);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    invalidate();
  };

  const handleMove = async (row: Row, dir: -1 | 1) => {
    const active = rows.filter(r => !r.archived);
    const idx = active.findIndex(r => r.id === row.id);
    const swap = active[idx + dir];
    if (!swap) return;
    await (supabase.from as any)("location_groups")
      .update({ display_order: swap.display_order }).eq("id", row.id);
    await (supabase.from as any)("location_groups")
      .update({ display_order: row.display_order }).eq("id", swap.id);
    invalidate();
  };

  const active = rows.filter(r => !r.archived);
  const archived = rows.filter(r => r.archived);

  return (
    <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          <MapPin className="h-4 w-4 text-primary" />
          Location Groups
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Used for cleaner workload share, regional allocation, scheduling filters and reporting.
          Keep this list tight to avoid duplicates.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new */}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Add Location Group</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder="e.g. Portrush"
              className="bg-secondary/50 border-border/40"
            />
          </div>
          <Button size="sm" onClick={() => handleAdd()} disabled={!newName.trim()}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>

        {/* Active list */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Active ({active.length})</Label>
          {isLoading ? (
            <p className="text-xs text-muted-foreground py-2">Loading…</p>
          ) : active.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No active location groups yet.</p>
          ) : (
            <div className="divide-y divide-border/20 rounded-md border border-border/30 overflow-hidden">
              {active.map((row, i) => (
                <div key={row.id} className="flex items-center gap-2 px-3 py-2 bg-secondary/20">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleMove(row, -1)}
                      disabled={i === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleMove(row, 1)}
                      disabled={i === active.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex-1">
                    {editingId === row.id ? (
                      <Input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleRename(row.id); if (e.key === "Escape") setEditingId(null); }}
                        className="h-7 text-sm bg-secondary/50 border-border/40"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground">{row.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {row.usage_count ?? 0} {row.usage_count === 1 ? "property" : "properties"}
                        </span>
                      </div>
                    )}
                  </div>
                  {editingId === row.id ? (
                    <>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRename(row.id)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => { setEditingId(row.id); setEditingName(row.name); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => handleToggleArchive(row)}
                        title="Archive"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legacy / unmanaged values */}
        {legacyGroups.length > 0 && (
          <div className="space-y-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
            <Label className="text-xs text-amber-300">
              Legacy values found on listings ({legacyGroups.length})
            </Label>
            <p className="text-[11px] text-muted-foreground">
              These free-text values aren't in the managed list. Add them to keep them, or open
              the affected properties and remap to a managed group.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {legacyGroups.map(g => (
                <button
                  key={g.name}
                  onClick={() => handleAdd(g.name)}
                  className="px-2 py-1 rounded-md text-[11px] bg-secondary/60 border border-border/40 hover:bg-secondary text-foreground flex items-center gap-1.5"
                  title="Add to managed list"
                >
                  <Plus className="h-3 w-3" />
                  {g.name}
                  <span className="text-muted-foreground">({g.count})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Archived */}
        {archived.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Archived ({archived.length})</Label>
            <div className="divide-y divide-border/20 rounded-md border border-border/30 overflow-hidden opacity-70">
              {archived.map(row => (
                <div key={row.id} className="flex items-center gap-2 px-3 py-2 bg-secondary/10">
                  <span className="flex-1 text-sm text-muted-foreground line-through">{row.name}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleToggleArchive(row)} title="Restore">
                    <ArchiveRestore className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
