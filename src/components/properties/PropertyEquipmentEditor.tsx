import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Wrench, Plus, X, Camera, Check } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EquipRow { id: string; name: string; active: boolean; requires_photo: boolean; }

/** Per-property equipment list. Each item becomes a photo-required check on the
 *  cleaner's job (BBQ, Hot Tub, …). Seeded from amenities; edited here. */
export function PropertyEquipmentEditor({ listingId }: { listingId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newPhoto, setNewPhoto] = useState(true);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["property_equipment", listingId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("property_equipment")
        .select("id, name, active, requires_photo").eq("listing_id", listingId).order("name");
      return (data ?? []) as EquipRow[];
    },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["property_equipment", listingId] });

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    const { error } = await (supabase.from as any)("property_equipment").insert({ listing_id: listingId, name, requires_photo: newPhoto });
    if (error) { toast({ title: "Could not add", description: error.message, variant: "destructive" }); return; }
    setNewName(""); setNewPhoto(true); invalidate();
  };
  const setPhoto = async (id: string, requires_photo: boolean) => {
    const { error } = await (supabase.from as any)("property_equipment").update({ requires_photo }).eq("id", id);
    if (error) { toast({ title: "Could not update", description: error.message, variant: "destructive" }); return; }
    invalidate();
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
        <p className="text-[10px] text-muted-foreground mt-0.5">Each item is a check on the cleaner's job. The camera icon = photo required (Hot Tub, BBQ…); the tick icon = tick only (Coffee Machine…). Tap the icon to switch.</p>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {rows.length === 0 && <span className="text-xs text-muted-foreground">No equipment set.</span>}
          {rows.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-1.5 text-xs font-medium pl-2 pr-1.5 py-1 rounded-full bg-secondary/50 border border-border/40">
              {r.name}
              <button
                onClick={() => setPhoto(r.id, !r.requires_photo)}
                title={r.requires_photo ? "Photo required — tap for tick-only" : "Tick only — tap to require a photo"}
                className={r.requires_photo ? "text-primary hover:opacity-70" : "text-emerald-500 hover:opacity-70"}
              >
                {r.requires_photo ? <Camera className="h-3 w-3" /> : <Check className="h-3 w-3" />}
              </button>
              <button onClick={() => remove(r.id)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2 items-center">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="Add equipment (e.g. BBQ)…" className="h-8 bg-secondary/50 border-border/40" />
        <button type="button" onClick={() => setNewPhoto((v) => !v)}
          title={newPhoto ? "New item will require a photo — tap for tick-only" : "New item is tick-only — tap to require a photo"}
          className={`h-8 px-2.5 rounded-md border border-border/40 inline-flex items-center gap-1 text-xs shrink-0 ${newPhoto ? "text-primary" : "text-emerald-500"}`}>
          {newPhoto ? <><Camera className="h-3.5 w-3.5" /> Photo</> : <><Check className="h-3.5 w-3.5" /> Tick</>}
        </button>
        <Button size="sm" onClick={add} className="gap-1.5 shrink-0"><Plus className="h-3.5 w-3.5" /> Add</Button>
      </div>
    </div>
  );
}
