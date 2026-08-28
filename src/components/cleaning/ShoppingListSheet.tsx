import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Loader2, ChevronLeft, ShoppingCart, BedDouble, SprayCan, Wrench } from "lucide-react";

interface Props {
  open: boolean;
  listingIds: string[];   // one entry per job today (repeats matter — each job needs its own set)
  onClose: () => void;
}

interface Agg {
  jobs: number;
  linens: Record<string, number>;       // bed type name -> total beds
  kitchens: number;
  bathrooms: number;
  kitchenItems: string[];
  bathroomItems: string[];
  equipment: Record<string, number>;    // equipment name -> count of properties today
}

export function ShoppingListSheet({ open, listingIds, onClose }: Props) {
  const [agg, setAgg] = useState<Agg | null>(null);
  const [loading, setLoading] = useState(true);
  const key = useMemo(() => [...listingIds].sort().join(","), [listingIds]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const uniq = Array.from(new Set(listingIds));
      if (uniq.length === 0) { setAgg({ jobs: 0, linens: {}, kitchens: 0, bathrooms: 0, kitchenItems: [], bathroomItems: [], equipment: {} }); setLoading(false); return; }

      const [listingRes, bedsRes, typesRes, consRes, equipRes] = await Promise.all([
        supabase.from("listings").select("id, kitchens, bathrooms").in("id", uniq),
        (supabase.from as any)("property_beds").select("listing_id, bed_type_id, quantity").in("listing_id", uniq),
        (supabase.from as any)("bed_types").select("id, name"),
        (supabase.from as any)("consumables").select("name, room_type, display_order").is("listing_id", null).eq("active", true).order("display_order"),
        (supabase.from as any)("property_equipment").select("listing_id, name").eq("active", true).in("listing_id", uniq),
      ]);
      if (cancelled) return;

      const rooms = new Map<string, { k: number; b: number }>();
      for (const l of (listingRes.data ?? []) as any[]) rooms.set(l.id, { k: Math.max(1, l.kitchens ?? 1), b: Math.max(1, l.bathrooms ?? 1) });

      const typeName = new Map<string, string>(((typesRes.data ?? []) as any[]).map((t) => [t.id, t.name]));
      const bedsByListing = new Map<string, Record<string, number>>();
      for (const b of (bedsRes.data ?? []) as any[]) {
        const m = bedsByListing.get(b.listing_id) ?? {};
        const n = typeName.get(b.bed_type_id) ?? "Bed";
        m[n] = (m[n] ?? 0) + Number(b.quantity ?? 0);
        bedsByListing.set(b.listing_id, m);
      }

      const equipByListing = new Map<string, string[]>();
      for (const e of (equipRes.data ?? []) as any[]) {
        const arr = equipByListing.get(e.listing_id) ?? [];
        arr.push(e.name);
        equipByListing.set(e.listing_id, arr);
      }

      const cons = (consRes.data ?? []) as any[];
      const kitchenItems = cons.filter((c) => c.room_type === "kitchen").map((c) => c.name);
      const bathroomItems = cons.filter((c) => c.room_type === "bathroom").map((c) => c.name);

      const linens: Record<string, number> = {};
      const equipment: Record<string, number> = {};
      let kitchens = 0, bathrooms = 0;
      // Iterate per JOB (listingIds has repeats) so two jobs at one property count twice.
      for (const id of listingIds) {
        const r = rooms.get(id);
        if (r) { kitchens += r.k; bathrooms += r.b; }
        for (const [name, q] of Object.entries(bedsByListing.get(id) ?? {})) linens[name] = (linens[name] ?? 0) + q;
        for (const name of equipByListing.get(id) ?? []) equipment[name] = (equipment[name] ?? 0) + 1;
      }

      setAgg({ jobs: listingIds.length, linens, kitchens, bathrooms, kitchenItems, bathroomItems, equipment });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, key]);

  const hasLinens = agg && Object.keys(agg.linens).length > 0;
  const hasEquip = agg && Object.keys(agg.equipment).length > 0;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0" hideClose onInteractOutside={(e) => e.preventDefault()}>
        <SheetHeader className="px-4 pt-3 pb-3 border-b border-border/30 sticky top-0 bg-background/95 backdrop-blur z-10 space-y-1">
          <button onClick={onClose} className="inline-flex items-center gap-1 -ml-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors self-start">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <SheetTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-primary" /> Today's Shopping List</SheetTitle>
          <SheetDescription>Everything to pack for today{agg ? ` — ${agg.jobs} job${agg.jobs === 1 ? "" : "s"}` : ""}. No need to start a job.</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : !agg || agg.jobs === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground px-6">No jobs today — nothing to pack.</div>
        ) : (
          <div className="p-4 space-y-5">
            <Section icon={BedDouble} title="Linens">
              {hasLinens ? (
                <Rows items={Object.entries(agg.linens).sort((a, b) => b[1] - a[1]).map(([n, q]) => ({ label: `${n} bedding`, qty: q }))} />
              ) : <Empty>No bed inventory set on today's properties.</Empty>}
            </Section>

            <Section icon={SprayCan} title="Consumables">
              <div className="space-y-3">
                <RoomBlock title={`Kitchen · ${agg.kitchens}`} items={agg.kitchenItems} multiplier={agg.kitchens} />
                <RoomBlock title={`Bathroom · ${agg.bathrooms}`} items={agg.bathroomItems} multiplier={agg.bathrooms} />
              </div>
            </Section>

            <Section icon={Wrench} title="Equipment to service">
              {hasEquip ? (
                <Rows items={Object.entries(agg.equipment).sort((a, b) => b[1] - a[1]).map(([n, q]) => ({ label: n, qty: q }))} />
              ) : <Empty>No special equipment on today's properties.</Empty>}
            </Section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Icon className="h-4 w-4 text-primary" /> {title}</div>
      {children}
    </div>
  );
}

function Rows({ items }: { items: { label: string; qty: number }[] }) {
  return (
    <div className="rounded-lg border border-border/40 divide-y divide-border/20 overflow-hidden">
      {items.map((it, i) => (
        <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
          <span>{it.label}</span>
          <span className="font-semibold tabular-nums">×{it.qty}</span>
        </div>
      ))}
    </div>
  );
}

function RoomBlock({ title, items, multiplier }: { title: string; items: string[]; multiplier: number }) {
  if (multiplier <= 0 || items.length === 0) return null;
  return (
    <div className="rounded-lg border border-border/40 overflow-hidden">
      <div className="px-3 py-1.5 bg-secondary/30 text-xs font-semibold">{title}</div>
      <div className="divide-y divide-border/20">
        {items.map((name, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
            <span>{name}</span>
            <span className="font-semibold tabular-nums">×{multiplier}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground/60 px-1">{children}</p>;
}
