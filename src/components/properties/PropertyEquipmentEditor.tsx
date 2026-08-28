import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Wrench, Plus, X, Camera, Check } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EQUIPMENT_PRESETS, isPreset, presetByName } from "@/lib/equipment";

interface EquipRow { id: string; name: string; active: boolean; requires_photo: boolean; }

/** Per-property equipment. Toggle the preset buttons (consistent with the Matrix);
 *  add anything else as a custom item. Each becomes a check on the cleaner's job —
 *  camera icon = photo required, tick icon = tick only. */
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
  const byName = (name: string) => rows.find((r) => r.name.toLowerCase() === name.toLowerCase());

  const err = (label: string, e: any) => toast({ title: `Could not ${label}`, description: e?.message, variant: "destructive" });

  const togglePreset = async (name: string, requiresPhoto: boolean) => {
    const existing = byName(name);
    if (existing) {
      const { error } = await (supabase.from as any)("property_equipment").delete().eq("id", existing.id);
      if (error) return err("remove", error);
    } else {
      const { error } = await (supabase.from as any)("property_equipment")
        .insert({ listing_id: listingId, name, requires_photo: requiresPhoto });
      if (error) return err("add", error);
    }
    invalidate();
  };

  const addCustom = async () => {
    const name = newName.trim();
    if (!name) return;
    if (byName(name)) { setNewName(""); return; }
    const requires_photo = isPreset(name) ? presetByName(name)!.requiresPhoto : newPhoto;
    const { error } = await (supabase.from as any)("property_equipment").insert({ listing_id: listingId, name, requires_photo });
    if (error) return err("add", error);
    setNewName(""); setNewPhoto(true); invalidate();
  };
  const setPhoto = async (id: string, requires_photo: boolean) => {
    const { error } = await (supabase.from as any)("property_equipment").update({ requires_photo }).eq("id", id);
    if (error) return err("update", error);
    invalidate();
  };
  const remove = async (id: string) => {
    const { error } = await (supabase.from as any)("property_equipment").delete().eq("id", id);
    if (error) return err("remove", error);
    invalidate();
  };

  const customRows = rows.filter((r) => !isPreset(r.name));

  return (
    <div className="border border-border/30 rounded-lg p-4 space-y-3">
      <div>
        <Label className="text-xs font-semibold flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" /> Equipment</Label>
        <p className="text-[10px] text-muted-foreground mt-0.5">Toggle what this property has. Camera icon = photo required on the clean; tick icon = tick only.</p>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <>
          {/* Preset toggle buttons */}
          <div className="flex flex-wrap gap-1.5">
            {EQUIPMENT_PRESETS.map((p) => {
              const on = !!byName(p.name);
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => togglePreset(p.name, p.requiresPhoto)}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                    on ? "bg-primary/10 border-primary/40 text-primary" : "bg-secondary/40 border-border/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.requiresPhoto ? <Camera className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                  {p.name}
                </button>
              );
            })}
          </div>

          {/* Custom (non-preset) items keep the per-item photo/tick + remove controls */}
          {customRows.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {customRows.map((r) => (
                <span key={r.id} className="inline-flex items-center gap-1.5 text-xs font-medium pl-2 pr-1.5 py-1 rounded-full bg-secondary/50 border border-border/40">
                  {r.name}
                  <button onClick={() => setPhoto(r.id, !r.requires_photo)}
                    title={r.requires_photo ? "Photo required — tap for tick-only" : "Tick only — tap to require a photo"}
                    className={r.requires_photo ? "text-primary hover:opacity-70" : "text-emerald-500 hover:opacity-70"}>
                    {r.requires_photo ? <Camera className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                  </button>
                  <button onClick={() => remove(r.id)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add a custom item not in the presets */}
      <div className="flex gap-2 items-center">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addCustom(); }}
          placeholder="Add something else…" className="h-8 bg-secondary/50 border-border/40" />
        <button type="button" onClick={() => setNewPhoto((v) => !v)}
          title={newPhoto ? "New item will require a photo — tap for tick-only" : "New item is tick-only — tap to require a photo"}
          className={`h-8 px-2.5 rounded-md border border-border/40 inline-flex items-center gap-1 text-xs shrink-0 ${newPhoto ? "text-primary" : "text-emerald-500"}`}>
          {newPhoto ? <><Camera className="h-3.5 w-3.5" /> Photo</> : <><Check className="h-3.5 w-3.5" /> Tick</>}
        </button>
        <Button size="sm" onClick={addCustom} className="gap-1.5 shrink-0"><Plus className="h-3.5 w-3.5" /> Add</Button>
      </div>
    </div>
  );
}
