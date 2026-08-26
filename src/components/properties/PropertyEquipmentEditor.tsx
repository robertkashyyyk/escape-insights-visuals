import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Wrench, Plus, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EquipRow { id: string; name: string; active: boolean; }

/** Per-property equipment list. Each item becomes a photo-required check on the
 *  cleaner's job (BBQ, Hot Tub, …). Seeded from amenities; edited here. */
export function PropertyEquipmentEditor({ listingId }: { listingId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["property_equipment", listingId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("property_equipment")
        .select("id, name, active").eq("listing_id", listingId).order("name");
      return (data ?? []) as EquipRow[];
    },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["property_equipment", listingId] });

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    const { error } = await (supabase.from as any)("property_equipment").insert({ listing_id: listingId, name });
    if (error) { toast({ title: "Could not add", description: error.message, variant: "destructive" }); return; }
    setNewName(""); invalidate();
  };
  const remove = async (id: string) => {
    const { error } = await (supabase.from as any)("property_equipment").delete().eq("id", id);
    if (error) { toast({ title: "Could not remove", description: error.message, variant: "destructive" }); return; }
    invalidate();
  };

  return (
    <div className="border border-border/30 rounded-lg p-4 space-y-3">
      <div>
        <Label className="text-xs font-semibold flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" /> Equipment</Label>
        <p className="text-[10px] text-muted-foreground mt-0.5">Each item must be photographed in approved condition on the cleaner's job (BBQ, Hot Tub, …).</p>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {rows.length === 0 && <span className="text-xs text-muted-foreground">No equipment set.</span>}
          {rows.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-secondary/50 border border-border/40">
              {r.name}
              <button onClick={() => remove(r.id)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="Add equipment (e.g. BBQ)…" className="h-8 bg-secondary/50 border-border/40" />
        <Button size="sm" onClick={add} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add</Button>
      </div>
    </div>
  );
}
