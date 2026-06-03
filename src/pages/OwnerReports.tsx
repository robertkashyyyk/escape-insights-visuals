import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, FileText, CheckCircle2, AlertTriangle, Lock } from "lucide-react";
import { startOfMonth, endOfMonth, subMonths, addMonths, format } from "date-fns";
import { toast } from "sonner";
import { useClientStatement } from "@/hooks/useClientStatement";

const db = supabase as any;
const gbp = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
const pct = (n: number | null | undefined) => (n == null ? "—" : `${(n * 100).toFixed(1)}%`);

function useOwners() {
  return useQuery({
    queryKey: ["statement_owners"],
    queryFn: async () => {
      const { data } = await db.from("property_owners").select("id, name, company").order("name");
      return (data ?? []) as { id: string; name: string; company: string | null }[];
    },
  });
}

export default function OwnerReports() {
  const { data: owners = [] } = useOwners();
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [month, setMonth] = useState<Date>(() => startOfMonth(subMonths(new Date(), 1)));
  const qc = useQueryClient();

  const effectiveOwner = ownerId ?? owners[0]?.id ?? null;
  const periodStart = startOfMonth(month);
  const periodEnd = endOfMonth(month);
  const { data: stmt, isLoading } = useClientStatement(effectiveOwner, periodStart, periodEnd);

  const finalize = useMutation({
    mutationFn: async () => {
      if (!stmt) return;
      const now = new Date().toISOString();
      await db.from("report_periods").upsert({
        owner_id: stmt.owner.id, period_start: stmt.periodStart, period_end: stmt.periodEnd,
        status: "finalised", opening_balance: stmt.openingBalance, weekly_rr_total: stmt.weeklyRrTotal,
        revenue_total: stmt.revenueTotal, cost_total: stmt.costTotal, net_total: stmt.netTotal,
        settlement_due: stmt.settlementDue, net_settlement_balance: stmt.netSettlementBalance,
        generated_at: now, finalised_at: now,
      }, { onConflict: "owner_id,period_start" });
      // R7 carry-forward: next period opens at this period's closing balance
      await db.from("property_owners").update({ opening_balance: stmt.netSettlementBalance }).eq("id", stmt.owner.id);
    },
    onSuccess: () => { toast.success("Period finalised — balance carried forward"); qc.invalidateQueries({ queryKey: ["client_statement"] }); },
    onError: (e: any) => toast.error(e.message ?? "Finalise failed"),
  });

  const banner = useMemo(() => {
    if (!stmt) return null;
    const r = stmt.recon;
    return {
      ok: r.fullyReconciled,
      text: `${r.matched} of ${r.totalReservations} reservations reconciled · ${gbp(r.matchedAmount)} of ${gbp(r.totalAmount)} matched · ${r.inQueue} in queue`,
    };
  }, [stmt]);

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <FileText className="h-7 w-7 text-primary" /> Owner Reports
            </h1>
            <p className="text-muted-foreground mt-1">Management Report (gross revenue) with OTA reconciliation.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={effectiveOwner ?? ""} onValueChange={setOwnerId}>
              <SelectTrigger className="w-60"><SelectValue placeholder="Select owner…" /></SelectTrigger>
              <SelectContent>
                {owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.company ?? o.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1 border border-border rounded-md px-1">
              <Button size="icon" variant="ghost" onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm font-medium w-28 text-center">{format(month, "MMMM yyyy")}</span>
              <Button size="icon" variant="ghost" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>

        {isLoading && <div className="text-sm text-muted-foreground">Computing…</div>}
        {!isLoading && !stmt && <Card><CardContent className="p-8 text-center text-muted-foreground">No data for this owner/period.</CardContent></Card>}

        {stmt && (
          <>
            {/* Reconciliation banner */}
            {banner && (
              <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${banner.ok ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-amber-500/30 bg-amber-500/10 text-amber-400"}`}>
                {banner.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                <span>{banner.text}</span>
              </div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                ["Revenue (gross)", stmt.revenueTotal], ["Costs", stmt.costTotal], ["Net", stmt.netTotal],
                ["Settlement Due", stmt.settlementDue], ["Net Settlement Balance", stmt.netSettlementBalance],
              ].map(([k, v]) => (
                <Card key={k as string}><CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">{k}</div>
                  <div className="text-lg font-bold">{gbp(v as number)}</div>
                </CardContent></Card>
              ))}
            </div>

            {/* Properties */}
            <Card><CardContent className="p-0">
              <div className="p-3 text-sm font-semibold border-b border-border">Properties</div>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr><th className="text-left p-3">Property</th><th className="text-right p-3">Revenue</th>
                  <th className="text-right p-3">Nights</th><th className="text-right p-3">Occupancy</th>
                  <th className="text-right p-3">ADR</th><th className="text-right p-3">Bookings</th><th className="text-right p-3">Avg LoS</th></tr>
                </thead>
                <tbody>
                  {stmt.properties.map((p) => (
                    <tr key={p.listingId} className="border-b border-border/40">
                      <td className="p-3">{p.name}</td>
                      <td className="p-3 text-right">{gbp(p.revenue)}</td>
                      <td className="p-3 text-right">{p.nights}</td>
                      <td className="p-3 text-right">{pct(p.occupancy)}</td>
                      <td className="p-3 text-right">{gbp(p.adr)}</td>
                      <td className="p-3 text-right">{p.numBookings}</td>
                      <td className="p-3 text-right">{p.avgLengthOfStay}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent></Card>

            {/* Cost lines */}
            <Card><CardContent className="p-0">
              <div className="p-3 text-sm font-semibold border-b border-border">Cost Lines</div>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr><th className="text-left p-3">Line</th><th className="text-right p-3">Actual</th>
                  <th className="text-right p-3">% of revenue</th><th className="text-right p-3">Benchmark</th><th className="text-left p-3 pl-4">Source</th></tr>
                </thead>
                <tbody>
                  {stmt.costLines.map((c) => (
                    <tr key={c.code} className="border-b border-border/40">
                      <td className="p-3">{c.display_name}</td>
                      <td className="p-3 text-right">{gbp(c.actual)}</td>
                      <td className="p-3 text-right">{pct(c.pct)}</td>
                      <td className="p-3 text-right text-muted-foreground">{pct(c.benchmark_pct)}</td>
                      <td className="p-3 pl-4"><Badge variant="outline" className="text-[10px]">{c.source}</Badge></td>
                    </tr>
                  ))}
                  <tr className="font-semibold"><td className="p-3">Total costs</td><td className="p-3 text-right">{gbp(stmt.costTotal)}</td><td colSpan={3} /></tr>
                </tbody>
              </table>
            </CardContent></Card>

            {/* Settlement waterfall + sources */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card><CardContent className="p-4 space-y-2 text-sm">
                <div className="font-semibold mb-1">Settlement</div>
                {[
                  ["Revenue (gross)", stmt.revenueTotal], ["− Costs", -stmt.costTotal], ["= Net", stmt.netTotal],
                  ["+ Opening balance", stmt.openingBalance], ["= Settlement due", stmt.settlementDue],
                  ["− Weekly RR draw", -stmt.weeklyRrTotal], ["= Net settlement balance", stmt.netSettlementBalance],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span>{gbp(v as number)}</span></div>
                ))}
                <div className="text-xs text-muted-foreground pt-1">
                  {stmt.owner.managementFeeMethod} · {stmt.owner.settlementMethod} · {stmt.owner.revenueRecognition}
                </div>
              </CardContent></Card>
              <Card><CardContent className="p-4 space-y-2 text-sm">
                <div className="font-semibold mb-1">Booking sources</div>
                {stmt.channels.map((c) => (
                  <div key={c.channel} className="flex justify-between"><span className="text-muted-foreground capitalize">{c.channel}</span><span>{gbp(c.amount)} · {pct(c.pct)}</span></div>
                ))}
              </CardContent></Card>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => finalize.mutate()} disabled={finalize.isPending}>
                <Lock className="h-4 w-4" /> {finalize.isPending ? "Finalising…" : "Finalise period"}
              </Button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
