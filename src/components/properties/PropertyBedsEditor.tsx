import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, BedDouble } from "lucide-react";
import { toast } from "sonner";

const fmtGbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n || 0);

interface BedType { id: string; name: string; laundry_cost: number; }
interface BedRow { id: string; bedroom_label: string; bed_type_id: string; quantity: number; sort_order: number; }

/** Per-property bed inventory. Drives the property's laundry cost (sum of bed-type
 *  costs per turnover). Saves immediately, so it only renders for a saved listing. */
export function PropertyBedsEditor({ listingId }: { listingId: string }) {
  const qc = useQueryClient();

  const { data: bedTypes = [] } = useQuery({
    queryKey: ["bed_types_active"],
    queryFn: async () => ((await (supabase.from as any)("bed_types").select("id, name, laundry_cost").eq("active", true).order("display_order")).data ?? []) as BedType[],
  });
  const { data: beds = [], refetch } = useQuery({
    queryKey: ["property_beds", listingId],
    queryFn: async () => ((await (supabase.from as any)("property_beds")
      .select("id, bedroom_label, bed_type_id, quantity, sort_order")
      .eq("listing_id", listingId).order("sort_order")).data ?? []) as BedRow[],
  });

  const costOf = (id: string) => Number(bedTypes.find((b) => b.id === id)?.laundry_cost ?? 0);
  const laundryTotal = beds.reduce((s, b) => s + costOf(b.bed_type_id) * b.quantity, 0);

  const addBed = async () => {
    if (bedTypes.length === 0) { toast.error("Add bed types first (Settings / Set Rates)"); return; }
    const nextOrder = beds.length ? Math.max(...beds.map((b) => b.sort_order)) + 1 : 0;
    // Default the bedroom label to the next bedroom number.
    const usedRooms = new Set(beds.map((b) => b.bedroom_label));
    let n = 1; while (usedRooms.has(`Bedroom ${n}`)) n++;
    const { error } = await (supabase.from as any)("property_beds").insert({
      listing_id: listingId, bedroom_label: `Bedroom ${n}`, bed_type_id: bedTypes[0].id, quantity: 1, sort_order: nextOrder,
    });
    if (error) { toast.error("Could not add bed", { description: error.message }); return; }
    refetch();
  };

  const update = async (id: string, patch: Partial<BedRow>) => {
    const { error } = await (supabase.from as any)("property_beds").update(patch).eq("id", id);
    if (error) { toast.error("Could not save", { description: error.message }); return; }
    refetch();
    qc.invalidateQueries({ queryKey: ["property_beds", listingId] });
  };
  const remove = async (id: string) => {
    await (supabase.from as any)("property_beds").delete().eq("id", id);
    refetch();
  };

  return (
    <div className="border border-border/30 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs font-semibold flex items-center gap-1.5"><BedDouble className="h-3.5 w-3.5" /> Bedrooms & Beds</Label>
          <p className="text-[10px] text-muted-foreground mt-0.5">Drives laundry cost per turnover. Set bed-type costs in Expenses → Set Rates.</p>
        </div>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addBed}><Plus className="h-3 w-3" /> Add bed</Button>
      </div>

      {beds.length === 0 ? (
        <p className="text-[11px] text-muted-foreground py-1">No beds added yet.</p>
      ) : (
        <div className="space-y-2">
          {beds.map((b) => (
            <div key={b.id} className="flex items-center gap-2">
              <Input
                defaultValue={b.bedroom_label}
                onBlur={(e) => e.target.value.trim() && e.target.value !== b.bedroom_label && update(b.id, { bedroom_label: e.target.value.trim() })}
                className="h-8 text-xs flex-1" placeholder="Bedroom 1"
              />
              <Select value={b.bed_type_id} onValueChange={(v) => update(b.id, { bed_type_id: v })}>
                <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {bedTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                type="number" min={1} value={b.quantity}
                onChange={(e) => update(b.id, { quantity: parseInt(e.target.value) || 1 })}
                className="h-8 text-xs w-16 text-center"
              />
              <span className="text-[10px] text-muted-foreground w-14 text-right">{fmtGbp(costOf(b.bed_type_id) * b.quantity)}</span>
              <button type="button" onClick={() => remove(b.id)} className="h-8 w-8 shrink-0 rounded-md border border-border/30 flex items-center justify-center text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="text-xs font-medium text-right text-foreground pt-1">
            Laundry / turnover: {fmtGbp(laundryTotal)}
          </div>
        </div>
      )}
    </div>
  );
}
