import { useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { Receipt, UploadCloud, Check, X, Building2, Layers, MapPin } from "lucide-react";
import {
  parseWiseStatement, normalisePayee, classifyTxn, STRIP_CLASSES,
  type RawTxn, type PayeeRuleLite,
} from "@/lib/billClassify";

const db = supabase as any;
const fmtGbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n || 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

// Optional: attach the actual bill document. Reuses the existing receipts bucket.
async function uploadBillDoc(file: File | null, userId: string | null): Promise<string | null> {
  if (!file || !userId) return null;
  const ext = file.name.split(".").pop() ?? "pdf";
  const path = `bills/${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("expense-receipts").upload(path, file);
  if (error) { toast.error("Attachment upload failed", { description: error.message }); return null; }
  return path;
}

type TargetType = "property" | "communal" | "region";

interface Listing { id: string; name: string; owner_id: string | null; location_group: string | null; communal_group_id: string | null; is_communal: boolean | null; communal_ratio_pct: number | null; bedrooms: number | null }
type RegionMethod = "equal" | "bedrooms";
interface Owner { id: string; name: string; company: string | null }
interface CostType { id: string; code: string; display_name: string; source_category: string }
interface Group { id: string; name: string }
interface QueueTxn { id: string; txn_date: string | null; amount: number; payee_name: string; reference: string; description: string; details_type: string }

export default function BillsOnBehalf() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);

  /* ── reference data ── */
  const { data: owners = [] } = useQuery({ queryKey: ["bills_owners"], queryFn: async () => {
    const { data } = await db.from("property_owners").select("id, name, company"); return (data ?? []) as Owner[];
  }});
  const { data: listings = [] } = useQuery({ queryKey: ["bills_listings"], queryFn: async () => {
    const { data } = await db.from("listings")
      .select("id, name, owner_id, location_group, communal_group_id, is_communal, communal_ratio_pct, bedrooms")
      .eq("is_bundle", false); return (data ?? []) as Listing[];
  }});
  const { data: costTypes = [] } = useQuery({ queryKey: ["bills_cost_types"], queryFn: async () => {
    const { data } = await db.from("cost_line_types").select("id, code, display_name, source_category").order("sort_order");
    return ((data ?? []) as CostType[]).filter((c) => c.source_category !== "integration");
  }});
  const { data: groups = [] } = useQuery({ queryKey: ["bills_groups"], queryFn: async () => {
    const { data } = await db.from("communal_groups").select("id, name").order("name"); return (data ?? []) as Group[];
  }});
  const { data: regions = [] } = useQuery({ queryKey: ["bills_regions"], queryFn: async () => {
    const { data } = await db.from("location_groups").select("name").eq("archived", false).order("display_order");
    return ((data ?? []) as { name: string }[]).map((r) => r.name);
  }});

  const ownerKeys = useMemo(() => {
    const m = new Map<string, string>(); // normalised key -> owner_id
    owners.forEach((o) => {
      [o.name, o.company].filter(Boolean).forEach((n) => { const k = normalisePayee(n as string); if (k) m.set(k, o.id); });
    });
    return m;
  }, [owners]);

  /* ── review queue + recent bills ── */
  const { data: queue = [] } = useQuery({
    queryKey: ["bills_queue", importId],
    queryFn: async (): Promise<QueueTxn[]> => {
      let q = db.from("bank_statement_txns")
        .select("id, txn_date, amount, payee_name, reference, description, details_type")
        .eq("classification", "candidate").eq("status", "pending").order("txn_date", { ascending: false });
      if (importId) q = q.eq("import_id", importId);
      const { data } = await q; return (data ?? []) as QueueTxn[];
    },
  });
  const { data: recentBills = [] } = useQuery({ queryKey: ["bills_recent"], queryFn: async () => {
    const { data } = await db.from("bills_on_behalf")
      .select("id, bill_date, payee_name, amount, description, target_type, cost_line_types(display_name)")
      .order("bill_date", { ascending: false }).limit(25);
    return data ?? [];
  }});
  // Learned payee rules — pre-fill the review form for suppliers seen before.
  const { data: billRules = [] } = useQuery({ queryKey: ["bills_rules"], queryFn: async () => {
    const { data } = await db.from("bill_payee_rules").select("*").eq("action", "bill"); return data ?? [];
  }});
  const ruleByPayeeKey = useMemo(() => {
    const m = new Map<string, any>(); (billRules as any[]).forEach((r) => m.set(r.payee_key, r)); return m;
  }, [billRules]);

  /* ── upload + classify ── */
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const rows = parseWiseStatement(text);
      if (!rows.length) throw new Error("No transactions found — is this a Wise CSV export?");

      // Learned rules (lite for classify + full for auto-apply).
      const { data: ruleRows } = await db.from("bill_payee_rules").select("*");
      const ruleByKey = new Map<string, PayeeRuleLite>((ruleRows ?? []).map((r: any) => [r.payee_key, { payee_key: r.payee_key, action: r.action }]));
      const fullRuleByKey = new Map<string, any>((ruleRows ?? []).map((r: any) => [r.payee_key, r]));
      const ownerKeySet = new Set(ownerKeys.keys());

      const dates = rows.map((r) => r.txn_date).filter(Boolean).sort() as string[];
      const { data: imp, error: impErr } = await db.from("bank_statement_imports").insert({
        bank: "wise", file_name: file.name, period_start: dates[0] ?? null,
        period_end: dates[dates.length - 1] ?? null, row_count: rows.length, status: "review",
        uploaded_by: user?.id ?? null,
      }).select("id").single();
      if (impErr) throw impErr;

      const counts: Record<string, number> = { income: 0, owner_settlement: 0, internal: 0, candidate: 0, ignored: 0, bill: 0, autoBilled: 0 };
      const txnRows = rows.map((t: RawTxn) => {
        const { classification, matchedOwnerKey } = classifyTxn(t, ownerKeySet, ruleByKey);
        counts[classification] = (counts[classification] ?? 0) + 1;
        const stripped = STRIP_CLASSES.includes(classification) || classification === "ignored";
        return {
          import_id: imp.id, external_id: t.external_id, txn_date: t.txn_date, amount: t.amount,
          direction: t.direction, details_type: t.details_type, payer_name: t.payer_name,
          payee_name: t.payee_name, reference: t.reference, description: t.description,
          classification, matched_owner_id: matchedOwnerKey ? ownerKeys.get(matchedOwnerKey) ?? null : null,
          status: stripped ? "ignored" : "pending",
        };
      });
      // Idempotent on the bank's unique id — re-uploading never double-counts.
      const { error: txErr } = await db.from("bank_statement_txns").upsert(txnRows, { onConflict: "external_id" });
      if (txErr) throw txErr;

      setImportId(imp.id);
      setSummary(counts);
      return counts;
    },
    onSuccess: (counts) => {
      qc.invalidateQueries({ queryKey: ["bills_queue"] });
      toast.success(`Imported — ${counts.candidate} to review, ${counts.income + counts.owner_settlement + counts.internal} stripped automatically.`);
    },
    onError: (e: any) => toast.error("Import failed", { description: e.message }),
  });

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) upload.mutate(f); if (fileRef.current) fileRef.current.value = "";
  };

  const stripped = summary ? summary.income + summary.owner_settlement + summary.internal : 0;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-display font-bold">Bills on Behalf</h1>
        </div>
        <p className="text-sm text-muted-foreground -mt-3">
          Upload the client account bank statement — Escape Grids strips out income, owner settlements and
          internal transfers, and asks you to categorise &amp; apportion only the real supplier bills. It learns
          each payee so next time is faster.
        </p>

        {/* Upload */}
        <Card>
          <CardContent className="p-5 flex flex-wrap items-center gap-4">
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
            <Button onClick={() => fileRef.current?.click()} disabled={upload.isPending} className="gap-2">
              <UploadCloud className="h-4 w-4" /> {upload.isPending ? "Processing…" : "Upload bank statement (CSV)"}
            </Button>
            {summary && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary">{stripped} stripped</Badge>
                <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30">{summary.candidate} to review</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Review queue */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">To review ({queue.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            {queue.length === 0 ? (
              <p className="text-sm text-muted-foreground p-5">Nothing to review. Upload a statement to begin.</p>
            ) : (
              <div className="divide-y divide-border/40">
                {queue.map((t) => (
                  <ReviewRow key={t.id} txn={t} rule={ruleByPayeeKey.get(normalisePayee(t.payee_name))}
                    listings={listings} owners={owners} costTypes={costTypes}
                    groups={groups} regions={regions} userId={user?.id ?? null} onDone={() => {
                      qc.invalidateQueries({ queryKey: ["bills_queue"] });
                      qc.invalidateQueries({ queryKey: ["bills_recent"] });
                      qc.invalidateQueries({ queryKey: ["bills_rules"] });
                    }} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent bills */}
        {recentBills.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Recent bills</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Payee</TableHead><TableHead>Category</TableHead>
                  <TableHead>Apportioned to</TableHead><TableHead className="text-right">Amount</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {recentBills.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell className="text-xs">{b.bill_date}</TableCell>
                      <TableCell className="text-sm">{b.payee_name}<div className="text-[11px] text-muted-foreground">{b.description}</div></TableCell>
                      <TableCell><Badge variant="secondary">{b.cost_line_types?.display_name}</Badge></TableCell>
                      <TableCell className="text-xs capitalize">{b.target_type}</TableCell>
                      <TableCell className="text-right font-medium">{fmtGbp(Number(b.amount))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

/* ── one reviewable transaction → a bill ── */
function ReviewRow({ txn, rule, listings, owners, costTypes, groups, regions, userId, onDone }: {
  txn: QueueTxn; rule?: any; listings: Listing[]; owners: Owner[]; costTypes: CostType[]; groups: Group[]; regions: string[]; userId: string | null; onDone: () => void;
}) {
  // Pre-fill from a learned rule for this payee (the "bank of knowledge"); auto-open so it's one click to confirm.
  const [open, setOpen] = useState(!!rule);
  const [costTypeId, setCostTypeId] = useState<string>(rule?.cost_line_type_id ?? "");
  const [targetType, setTargetType] = useState<TargetType>((rule?.target_type as TargetType) ?? "property");
  const [listingId, setListingId] = useState<string>(rule?.target_listing_id ?? "");
  const [groupId, setGroupId] = useState<string>(rule?.target_communal_group_id ?? "");
  const [region, setRegion] = useState<string>(rule?.target_region ?? "");
  const [regionMethod, setRegionMethod] = useState<RegionMethod>("equal");
  const [desc, setDesc] = useState<string>(rule?.default_description || txn.reference || txn.description || "");
  const [doc, setDoc] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const amount = Math.abs(Number(txn.amount));

  // Preview the per-listing split so the user sees exactly what each owner gets charged.
  const allocations = useMemo(() => buildAllocations(targetType, amount, { listingId, groupId, region, regionMethod, listings }), [targetType, amount, listingId, groupId, region, regionMethod, listings]);

  const ignore = async () => {
    setSaving(true);
    await db.from("bank_statement_txns").update({ status: "ignored", classification: "ignored" }).eq("id", txn.id);
    // Learn: this payee isn't a bill.
    await upsertRule(txn.payee_name, { action: "ignore" }, userId);
    setSaving(false); onDone();
  };

  const save = async () => {
    if (!costTypeId) { toast.error("Pick a category"); return; }
    if (!allocations.length) { toast.error("Pick what this bill applies to"); return; }
    setSaving(true);
    try {
      const receiptPath = await uploadBillDoc(doc, userId); // optional
      const { data: bill, error } = await db.from("bills_on_behalf").insert({
        txn_id: txn.id, payee_name: txn.payee_name, bill_date: txn.txn_date ?? format(new Date(), "yyyy-MM-dd"),
        amount, cost_line_type_id: costTypeId, description: desc, target_type: targetType,
        target_communal_group_id: targetType === "communal" ? groupId : null,
        target_region: targetType === "region" ? region : null, receipt_url: receiptPath, created_by: userId,
      }).select("id").single();
      if (error) throw error;
      await db.from("bill_allocations").insert(allocations.map((a) => ({ bill_id: bill.id, listing_id: a.listing_id, ratio_pct: a.ratio_pct, amount: a.amount })));
      await db.from("bank_statement_txns").update({ status: "confirmed", classification: "bill", bill_id: bill.id }).eq("id", txn.id);
      // Learn the payee → category + target for next time.
      await upsertRule(txn.payee_name, {
        action: "bill", cost_line_type_id: costTypeId, target_type: targetType,
        target_listing_id: targetType === "property" ? listingId : null,
        target_communal_group_id: targetType === "communal" ? groupId : null,
        target_region: targetType === "region" ? region : null, default_description: desc,
      }, userId);
      toast.success("Bill recorded & apportioned");
      onDone();
    } catch (e: any) { toast.error("Could not save", { description: e.message }); }
    finally { setSaving(false); }
  };

  const ownerName = (id: string | null) => owners.find((o) => o.id === id)?.name ?? "—";

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[150px]">
          <div className="text-sm font-medium flex items-center gap-1.5">
            {txn.payee_name || "(no payee)"}
            {rule && <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/40 text-emerald-600">learned</Badge>}
          </div>
          <div className="text-[11px] text-muted-foreground">{txn.txn_date} · {txn.details_type}{txn.reference ? ` · ${txn.reference}` : ""}</div>
        </div>
        <div className="font-semibold tabular-nums">{fmtGbp(amount)}</div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={ignore} disabled={saving} className="gap-1 text-muted-foreground">
            <X className="h-3.5 w-3.5" /> Not a bill
          </Button>
          <Button size="sm" variant={open ? "secondary" : "default"} onClick={() => setOpen((o) => !o)} className="gap-1">
            <Check className="h-3.5 w-3.5" /> It's a bill
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-4 grid gap-3 rounded-lg border border-border/40 bg-secondary/20 p-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Category</Label>
            <Select value={costTypeId} onValueChange={setCostTypeId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="What category…" /></SelectTrigger>
              <SelectContent>{costTypes.map((c) => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">What exactly</Label>
            <Input className="h-9" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. May electricity" />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Apportion to</Label>
            <div className="flex gap-1 p-1 rounded-lg bg-background border border-border/40 w-fit">
              {([["property", Building2, "Property"], ["communal", Layers, "Communal"], ["region", MapPin, "Region"]] as const).map(([v, Icon, lbl]) => (
                <button key={v} onClick={() => setTargetType(v)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 ${targetType === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  <Icon className="h-3.5 w-3.5" /> {lbl}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            {targetType === "property" && (
              <Select value={listingId} onValueChange={setListingId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Which property…" /></SelectTrigger>
                <SelectContent>{listings.map((l) => <SelectItem key={l.id} value={l.id}>{l.name} · {ownerName(l.owner_id)}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {targetType === "communal" && (
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Which communal group…" /></SelectTrigger>
                <SelectContent>{groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {targetType === "region" && (
              <div className="flex flex-wrap items-center gap-2">
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger className="h-9 w-56"><SelectValue placeholder="Which region…" /></SelectTrigger>
                  <SelectContent>{regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
                <div className="flex gap-1 p-1 rounded-lg bg-background border border-border/40">
                  {(["equal", "bedrooms"] as const).map((m) => (
                    <button key={m} onClick={() => setRegionMethod(m)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md ${regionMethod === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                      {m === "equal" ? "Equal split" : "By bedrooms"}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Split preview */}
          {allocations.length > 0 && (
            <div className="md:col-span-2 text-xs text-muted-foreground">
              <div className="font-medium text-foreground mb-1">Split ({allocations.length} {allocations.length === 1 ? "property" : "properties"})</div>
              <div className="grid gap-0.5">
                {allocations.map((a) => {
                  const l = listings.find((x) => x.id === a.listing_id);
                  return <div key={a.listing_id} className="flex justify-between"><span>{l?.name ?? a.listing_id}{a.ratio_pct != null && a.ratio_pct !== 100 ? ` (${a.ratio_pct}%)` : ""}</span><span className="tabular-nums">{fmtGbp(a.amount)}</span></div>;
                })}
              </div>
            </div>
          )}

          <div className="md:col-span-2 flex items-center justify-between gap-3 pt-1">
            <label className="text-xs text-muted-foreground flex items-center gap-2 cursor-pointer">
              <span className="px-2.5 py-1.5 rounded-md border border-border/40 bg-background hover:bg-secondary/50">
                {doc ? "Change document" : "Attach bill (optional)"}
              </span>
              {doc && <span className="truncate max-w-[180px]">{doc.name}</span>}
              <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => setDoc(e.target.files?.[0] ?? null)} />
            </label>
            <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save bill"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── apportionment ── */
function buildAllocations(
  targetType: TargetType, amount: number,
  ctx: { listingId: string; groupId: string; region: string; regionMethod: RegionMethod; listings: Listing[] },
): { listing_id: string; ratio_pct: number | null; amount: number }[] {
  let members: { listing_id: string; ratio_pct: number | null }[] = [];
  if (targetType === "property") {
    if (!ctx.listingId) return [];
    members = [{ listing_id: ctx.listingId, ratio_pct: 100 }];
  } else if (targetType === "communal") {
    if (!ctx.groupId) return [];
    const ms = ctx.listings.filter((l) => l.communal_group_id === ctx.groupId && l.is_communal);
    const sum = ms.reduce((s, l) => s + Number(l.communal_ratio_pct ?? 0), 0) || 1;
    members = ms.map((l) => ({ listing_id: l.id, ratio_pct: round2((Number(l.communal_ratio_pct ?? 0) / sum) * 100) }));
  } else {
    if (!ctx.region) return [];
    const ms = ctx.listings.filter((l) => l.location_group === ctx.region);
    if (ctx.regionMethod === "bedrooms" && ms.some((l) => Number(l.bedrooms ?? 0) > 0)) {
      const totalBeds = ms.reduce((s, l) => s + Math.max(0, Number(l.bedrooms ?? 0)), 0) || 1;
      members = ms.map((l) => ({ listing_id: l.id, ratio_pct: round2((Math.max(0, Number(l.bedrooms ?? 0)) / totalBeds) * 100) }));
    } else {
      const each = ms.length ? round2(100 / ms.length) : 0; // equal split across the region's properties
      members = ms.map((l) => ({ listing_id: l.id, ratio_pct: each }));
    }
  }
  // Apply amounts; last member absorbs any rounding remainder so the split ties to the total.
  let allocated = 0;
  return members.map((m, i) => {
    const amt = i === members.length - 1 ? round2(amount - allocated) : round2((amount * (m.ratio_pct ?? 0)) / 100);
    allocated += amt;
    return { listing_id: m.listing_id, ratio_pct: m.ratio_pct, amount: amt };
  });
}

/* ── learning: upsert a payee rule ── */
async function upsertRule(payee: string, fields: Record<string, any>, userId: string | null) {
  const key = normalisePayee(payee);
  if (!key) return;
  const { data: existing } = await db.from("bill_payee_rules").select("id, hit_count").eq("payee_key", key).maybeSingle();
  if (existing?.id) {
    await db.from("bill_payee_rules").update({ ...fields, sample_payee: payee, hit_count: (existing.hit_count ?? 0) + 1 }).eq("id", existing.id);
  } else {
    await db.from("bill_payee_rules").insert({ payee_key: key, sample_payee: payee, created_by: userId, hit_count: 1, ...fields });
  }
}
