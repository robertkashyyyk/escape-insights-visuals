import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SprayCan, Plus, Archive, ArchiveRestore, Pencil, Check, X, Bath, CookingPot } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Row { id: string; name: string; room_type: "kitchen" | "bathroom"; active: boolean; display_order: number; }

const ROOMS: { key: "kitchen" | "bathroom"; label: string; icon: any }[] = [
  { key: "kitchen", label: "Kitchen", icon: CookingPot },
  { key: "bathroom", label: "Bathroom (each)", icon: Bath },
];

export function ConsumablesSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newName, setNewName] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["consumables_admin"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("consumables")
        .select("id, name, room_type, active, display_order")
        .is("listing_id", null)
        .order("active", { ascending: false })
        .order("display_order", { ascending: true })
        .order("name", { ascending: true });
      return (data ?? []) as Row[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["consumables_admin"] });
    qc.invalidateQueries({ queryKey: ["consumables_catalogue"] });
  };

  const handleAdd = async (room: "kitchen" | "bathroom") => {
    const name = (newName[room] ?? "").trim();
    if (!name) return;
    const existing = rows.filter((r) => r.room_type === room);
    const nextOrder = existing.length ? Math.max(...existing.map((r) => r.display_order)) + 1 : 0;
    const { error } = await (supabase.from as any)("consumables").insert({ name, room_type: room, display_order: nextOrder });
    if (error) { toast({ title: "Could not add", description: error.message, variant: "destructive" }); return; }
    setNewName((p) => ({ ...p, [room]: "" }));
    invalidate();
  };

  const handleSaveEdit = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    const { error } = await (supabase.from as any)("consumables").update({ name }).eq("id", id);
    if (error) { toast({ title: "Could not save", description: error.message, variant: "destructive" }); return; }
    setEditingId(null); invalidate();
  };

  const toggleActive = async (r: Row) => {
    const { error } = await (supabase.from as any)("consumables").update({ active: !r.active }).eq("id", r.id);
    if (error) { toast({ title: "Could not update", description: error.message, variant: "destructive" }); return; }
    invalidate();
  };

  return (
    <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          <SprayCan className="h-4 w-4 text-primary" /> Consumables
        </CardTitle>
        <CardDescription>The restock checklist a cleaner ticks per room. Applies to every property (per-property tweaks come later).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : ROOMS.map(({ key, label, icon: Icon }) => {
          const items = rows.filter((r) => r.room_type === key);
          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Icon className="h-4 w-4 text-muted-foreground" /> {label}
              </div>
              <div className="rounded-md border border-border/30 divide-y divide-border/20">
                {items.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No items yet.</div>}
                {items.map((r) => (
                  <div key={r.id} className={`flex items-center gap-2 px-3 py-1.5 ${r.active ? "" : "opacity-50"}`}>
                    {editingId === r.id ? (
                      <>
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 flex-1" autoFocus />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveEdit(r.id)}><Check className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm">{r.name}{r.active ? "" : " (archived)"}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => { setEditingId(r.id); setEditName(r.name); }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => toggleActive(r)} title={r.active ? "Archive" : "Restore"}>
                          {r.active ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newName[key] ?? ""} onChange={(e) => setNewName((p) => ({ ...p, [key]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdd(key); }}
                  placeholder={`Add a ${label.toLowerCase().replace(" (each)", "")} item…`} className="h-8 bg-secondary/50 border-border/40"
                />
                <Button size="sm" onClick={() => handleAdd(key)} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add</Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
