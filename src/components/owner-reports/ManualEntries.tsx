import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useManualEntries } from "@/hooks/useOwnerSettlement";

const db = supabase as any;
const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(n);

// Enter manual cost lines (Setup, Refunds, cleaning override, …) and logged
// adjustments (signed delta + reason) for an owner/period — the values fold
// straight into the Statement Breakdown + settlement waterfall.
export function ManualEntries({ ownerId, periodStart, periodEnd }: { ownerId: string; periodStart: string; periodEnd: string }) {
  const { entries, addCost, addAdjustment, removeCost, removeAdjustment } = useManualEntries(ownerId, periodStart, periodEnd);
  const { data: listings = [] } = useQuery({
    queryKey: ["owner_listings_min", ownerId],
    queryFn: async () => (await db.from("listings").select("id, name").eq("owner_id", ownerId).order("name")).data ?? [],
  });
  const { data: lineTypes = [] } = useQuery({
    queryKey: ["cost_line_types_min"],
    queryFn: async () => (await db.from("cost_line_types").select("code, display_name").order("sort_order")).data ?? [],
  });

  const [cListing, setCListing] = useState("");
  const [cCode, setCCode] = useState("");
  const [cAmt, setCAmt] = useState("");
  const [aTarget, setATarget] = useState<"revenue" | "cost_line" | "settlement">("cost_line");
  const [aCode, setACode] = useState("");
  const [aAmt, setAAmt] = useState("");
  const [aReason, setAReason] = useState("");

  const data = entries.data ?? { costs: [], adjustments: [] };
  const nameFor = (code: string) => (lineTypes as any[]).find((l) => l.code === code)?.display_name ?? code;

  return (
    <Card>
      <CardContent className="p-4 space-y-4 text-sm">
        <div className="font-semibold">Manual entries & adjustments</div>

        {/* Manual cost lines */}
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Manual cost lines</div>
          {data.costs.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 rounded border border-border/50 p-2">
              <span>{c.display_name}{c.listing_name ? ` · ${c.listing_name}` : ""}</span>
              <span className="flex items-center gap-2"><span className="font-medium">{gbp(c.amount)}</span>
                <button onClick={() => removeCost.mutate(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </span>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={cListing} onValueChange={setCListing}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Property" /></SelectTrigger>
              <SelectContent>{(listings as any[]).map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={cCode} onValueChange={setCCode}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Cost line" /></SelectTrigger>
              <SelectContent>{(lineTypes as any[]).map((l) => <SelectItem key={l.code} value={l.code}>{l.display_name}</SelectItem>)}</SelectContent>
            </Select>
            <Input className="w-28" type="number" placeholder="£ amount" value={cAmt} onChange={(e) => setCAmt(e.target.value)} />
            <Button size="sm" disabled={!cListing || !cCode || !cAmt} onClick={() =>
              addCost.mutate({ listingId: cListing, costCode: cCode, amount: parseFloat(cAmt) }, {
                onSuccess: () => { toast.success("Cost added"); setCAmt(""); },
                onError: (e: any) => toast.error(e.message ?? "Failed"),
              })}><Plus className="h-3.5 w-3.5" /> Add</Button>
          </div>
        </div>

        {/* Adjustments */}
        <div className="space-y-2 border-t border-border/40 pt-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Logged adjustments (signed)</div>
          {data.adjustments.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 rounded border border-border/50 p-2">
              <span>{a.target === "cost_line" ? nameFor(a.cost_code ?? "") : a.target} · <span className="text-muted-foreground">{a.reason}</span></span>
              <span className="flex items-center gap-2"><span className="font-medium">{gbp(a.amount)}</span>
                <button onClick={() => removeAdjustment.mutate(a.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </span>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={aTarget} onValueChange={(v) => setATarget(v as any)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cost_line">Cost line</SelectItem>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="settlement">Settlement</SelectItem>
              </SelectContent>
            </Select>
            {aTarget === "cost_line" && (
              <Select value={aCode} onValueChange={setACode}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Cost line" /></SelectTrigger>
                <SelectContent>{(lineTypes as any[]).map((l) => <SelectItem key={l.code} value={l.code}>{l.display_name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Input className="w-28" type="number" placeholder="± £" value={aAmt} onChange={(e) => setAAmt(e.target.value)} />
            <Input className="w-44" placeholder="Reason" value={aReason} onChange={(e) => setAReason(e.target.value)} />
            <Button size="sm" disabled={!aAmt || !aReason || (aTarget === "cost_line" && !aCode)} onClick={() =>
              addAdjustment.mutate({ target: aTarget, costCode: aCode || undefined, amount: parseFloat(aAmt), reason: aReason }, {
                onSuccess: () => { toast.success("Adjustment logged"); setAAmt(""); setAReason(""); },
                onError: (e: any) => toast.error(e.message ?? "Failed"),
              })}><Plus className="h-3.5 w-3.5" /> Log</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
