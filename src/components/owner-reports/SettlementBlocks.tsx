import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, Lock } from "lucide-react";
import { toast } from "sonner";
import type { OwnerCostCategories } from "@/hooks/useOwnerCostCategories";
import { OwnerSettlement, useFinalizePeriod } from "@/hooks/useOwnerSettlement";

const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

export function ReconBanner({ recon }: { recon: OwnerSettlement["recon"] }) {
  if (!recon || recon.total === 0) return null;
  const ok = recon.fullyReconciled;
  return (
    <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${ok ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-amber-500/30 bg-amber-500/10 text-amber-400"}`}>
      {ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      <span>
        {recon.matched} of {recon.total} reservations reconciled to OTA settlements · {gbp(recon.matchedAmount)} of {gbp(recon.totalAmount)} matched · {recon.inQueue} in queue
      </span>
    </div>
  );
}

export function SettlementSection({
  ownerId, periodStart, periodEnd, grossRevenue, managementFee, costs, settlement,
}: {
  ownerId: string; periodStart: string; periodEnd: string;
  grossRevenue: number; managementFee: number;
  costs: OwnerCostCategories | undefined; settlement: OwnerSettlement;
}) {
  const finalize = useFinalizePeriod();
  const v = (c?: { value: number | null }) => Number(c?.value ?? 0);

  const platformCosts =
    v(costs?.cleaning) + v(costs?.consumables) + v(costs?.laundry) + v(costs?.maintenance) +
    v(costs?.setup) + v(costs?.welcomeBaskets) + v(costs?.utilities);
  // manual cost lines / cost-line adjustments (refunds handled on the revenue side)
  const manual = settlement.manualByCode ?? {};
  const refunds = Number(manual["refunds"] ?? 0);
  const manualCosts = Object.entries(manual).filter(([k]) => k !== "refunds").reduce((s, [, val]) => s + Number(val), 0);
  const portfolioFee = settlement.managementFeeMethod === "flat_per_portfolio" ? settlement.flatPortfolioFee : 0;

  const revenueTotal = round2(grossRevenue - refunds + (settlement.revenueAdj ?? 0));
  const costTotal = round2(managementFee + settlement.bookingFees + settlement.cardProcessing + platformCosts + manualCosts + portfolioFee);
  const netTotal = round2(revenueTotal - costTotal);
  const settlementDue = round2(netTotal + settlement.openingBalance + (settlement.settlementAdj ?? 0));
  const netSettlementBalance = round2(settlementDue - settlement.weeklyRrTotal);

  const rows: [string, number][] = [
    ["Revenue (net of refunds)", revenueTotal],
    ["− Costs (incl. management, booking fees)", -costTotal],
    ["= Net", netTotal],
    ["+ Opening balance", settlement.openingBalance],
  ];
  if (settlement.settlementAdj) rows.push(["+ Settlement adjustment", settlement.settlementAdj]);
  rows.push(["= Settlement due", settlementDue]);
  if (settlement.settlementMethod === "weekly_draw")
    rows.push([`− Weekly RR draw (×${settlement.weeksDrawn})`, -settlement.weeklyRrTotal]);
  rows.push(["= Net settlement balance", netSettlementBalance]);

  return (
    <Card>
      <CardContent className="p-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Settlement</div>
          <Button size="sm" onClick={() => finalize.mutate(
            { ownerId, periodStart, periodEnd, openingBalance: settlement.openingBalance, weeklyRrTotal: settlement.weeklyRrTotal,
              revenueTotal, costTotal, netTotal, settlementDue, netSettlementBalance },
            { onSuccess: () => toast.success("Period finalised — balance carried forward"),
              onError: (e: any) => toast.error(e.message ?? "Finalise failed") })}
            disabled={finalize.isPending}>
            <Lock className="h-3.5 w-3.5" /> {finalize.isPending ? "Finalising…" : "Finalise"}
          </Button>
        </div>
        {rows.map(([k, val]) => (
          <div key={k} className={`flex justify-between ${k.startsWith("=") ? "font-semibold" : "text-muted-foreground"}`}>
            <span>{k}</span><span>{gbp(val)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const round2 = (n: number) => Math.round(n * 100) / 100;
