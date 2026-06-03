import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PackagePlus, Plus, Archive, ArchiveRestore, Pencil, Check, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RequestIcon } from "@/lib/requestIcon";

interface Row {
  id: string;
  name: string;
  icon: string | null;
  active: boolean;
  display_order: number;
}

export function RequestsSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["requests_admin"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("requests")
        .select("id, name, icon, active, display_order")
        .order("active", { ascending: false })
        .order("display_order", { ascending: true })
        .order("name", { ascending: true });
      return (data ?? []) as Row[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["requests_admin"] });
    qc.invalidateQueries({ queryKey: ["requests_catalogue"] });
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    const nextOrder = rows.length ? Math.max(...rows.map((r) => r.display_order)) + 1 : 0;
    const { error } = await (supabase.from as any)("requests")
      .insert({ name, icon: newIcon.trim() || null, display_order: nextOrder });
    if (error) { toast({ title: "Could not add", description: error.message, variant: "destructive" }); return; }
    setNewName(""); setNewIcon(""); invalidate();
  };

  const handleSaveEdit = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    const { error } = await (supabase.from as any)("requests")
      .update({ name, icon: editIcon.trim() || null }).eq("id", id);
    if (error) { toast({ title: "Could not save", description: error.message, variant: "destructive" }); return; }
    setEditingId(null); invalidate();
  };

  const toggleActive = async (row: Row) => {
    const { error } = await (supabase.from as any)("requests").update({ active: !row.active }).eq("id", row.id);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    invalidate();
  };

  const active = rows.filter((r) => r.active);
  const archived = rows.filter((r) => !r.active);

  return (
    <Card className="border-border/30 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          <PackagePlus className="h-4 w-4 text-primary" />
          Requests
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Items guests can request on a booking (e.g. High Chair, Cot). Cleaners are reminded of them
          at clean-completion. Icon can be a lucide name (baby, crib, bath) or an emoji (🍼).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-2">
          <div className="w-20 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Icon</Label>
            <Input value={newIcon} onChange={(e) => setNewIcon(e.target.value)} placeholder="🍼" className="bg-secondary/50 border-border/40" />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Add Request</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder="e.g. High Chair"
              className="bg-secondary/50 border-border/40"
            />
          </div>
          <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Active ({active.length})</Label>
          {isLoading ? (
            <p className="text-xs text-muted-foreground py-2">Loading…</p>
          ) : active.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No active requests yet.</p>
          ) : (
            <div className="divide-y divide-border/20 rounded-md border border-border/30 overflow-hidden">
              {active.map((row) => (
                <div key={row.id} className="flex items-center gap-2 px-3 py-2 bg-secondary/20">
                  {editingId === row.id ? (
                    <>
                      <Input value={editIcon} onChange={(e) => setEditIcon(e.target.value)} className="h-7 w-14 text-sm bg-secondary/50 border-border/40" />
                      <Input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(row.id); if (e.key === "Escape") setEditingId(null); }}
                        className="h-7 text-sm bg-secondary/50 border-border/40 flex-1" />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveEdit(row.id)}><Check className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                    </>
                  ) : (
                    <>
                      <RequestIcon icon={row.icon} className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-sm text-foreground">{row.name}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingId(row.id); setEditName(row.name); setEditIcon(row.icon ?? ""); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleActive(row)} title="Archive">
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {archived.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Archived ({archived.length})</Label>
            <div className="divide-y divide-border/20 rounded-md border border-border/30 overflow-hidden opacity-70">
              {archived.map((row) => (
                <div key={row.id} className="flex items-center gap-2 px-3 py-2 bg-secondary/10">
                  <RequestIcon icon={row.icon} className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-sm text-muted-foreground line-through">{row.name}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleActive(row)} title="Restore">
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
