import { useState, Fragment } from "react";
import { ChevronDown, PoundSterling, CreditCard, Sparkles, Wrench, Briefcase, type LucideIcon } from "lucide-react";
import type { OwnerCostCategories, CostCategory } from "@/hooks/useOwnerCostCategories";

// Foldable, grouped cost cards for the owner report. Five top-level groups; each
// collapses to a headline total (+ % of revenue) and expands to its constituent
// lines. Keeps the real estate tight while letting everything be seen on demand.
const gbp = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(n);

interface Line { label: string; value: number | null; missing?: boolean }
// pctMode controls the small per-line %: "cost" = this line as % of revenue
// (right of the value, for cost groups), "revenue" = this channel's share of
// revenue (right of the label, the revenue mix), "none" = no per-line %.
interface Group { key: string; title: string; icon: LucideIcon; tone: "revenue" | "cost"; color: string; pctMode: "cost" | "revenue" | "none"; lines: Line[] }

const cat = (c: CostCategory | undefined): Line["value"] => (c?.value ?? null);
const sum = (lines: Line[]) => lines.reduce((s, l) => s + Number(l.value ?? 0), 0);

export function CostGroups({
  grossRevenue, managementFee, bookingFees, cardProcessing, costs, manualByCode = {},
  revenueByChannel = {}, distributionByChannel = {},
}: {
  grossRevenue: number; managementFee: number; bookingFees: number; cardProcessing: number;
  costs: OwnerCostCategories | undefined; manualByCode?: Record<string, number>;
  revenueByChannel?: Record<string, number>; distributionByChannel?: Record<string, number>;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setOpen((p) => ({ ...p, [k]: !p[k] }));
  const pctOf = (v: number) => (grossRevenue > 0 ? `${((v / grossRevenue) * 100).toFixed(1)}%` : "—");

  const CH_LABEL: Record<string, string> = { bookingcom: "Booking.com", airbnb: "Airbnb", direct: "Direct", vrbo: "Vrbo", deposit_fees: "Deposit fees" };
  const channelLines = (obj: Record<string, number>): Line[] =>
    Object.entries(obj).filter(([, v]) => Math.abs(v) >= 0.005).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ label: CH_LABEL[k] ?? k, value: v }));
  const man = (code: string) => manualByCode[code] ?? 0;
  // engine value + any manual entry/adjustment for that line; missing only if neither exists
  const merge = (c: CostCategory | undefined, code: string): Line => {
    const ev = c?.value ?? null;
    const m = man(code);
    if (ev == null && m === 0) return { label: "", value: null, missing: true };
    return { label: "", value: (ev ?? 0) + m };
  };
  const withLabel = (label: string, l: Line): Line => ({ ...l, label });
  const derived = (label: string, base: number, code: string): Line => ({ label, value: base + man(code) });
  const refunds = man("refunds");

  const groups: Group[] = [
    {
      key: "revenue", title: "Revenue", icon: PoundSterling, tone: "revenue", color: "primary", pctMode: "revenue",
      lines: [
        ...(Object.keys(revenueByChannel).length
          ? channelLines(revenueByChannel)
          : [{ label: "Revenue (gross)", value: grossRevenue + (manualByCode["revenue"] ?? 0) }]),
        { label: "Refunds", value: refunds > 0 ? -refunds : null, missing: refunds === 0 },
      ],
    },
    {
      key: "distribution", title: "Distribution Fees", icon: CreditCard, tone: "cost", color: "chart-3", pctMode: "none",
      lines: Object.keys(distributionByChannel).length
        ? [
            ...channelLines(distributionByChannel),
            ...(man("booking_fees") + man("card_processing") !== 0
              ? [{ label: "Manual adjustment", value: man("booking_fees") + man("card_processing") }]
              : []),
          ]
        : [derived("Booking Fees", bookingFees, "booking_fees"), derived("Card Processing Fees", cardProcessing, "card_processing")],
    },
    {
      key: "servicing", title: "Servicing", icon: Sparkles, tone: "cost", color: "chart-2", pctMode: "cost",
      lines: [
        withLabel("Cleaning", merge(costs?.cleaning, "cleaning")),
        withLabel("Laundry", merge(costs?.laundry, "laundry")),
        withLabel("Consumables", merge(costs?.consumables, "consumables")),
        withLabel("Welcome Baskets", merge(costs?.welcomeBaskets, "welcome_baskets")),
      ],
    },
    {
      key: "operations", title: "Operations", icon: Wrench, tone: "cost", color: "chart-4", pctMode: "cost",
      lines: [
        withLabel("Utilities", merge(costs?.utilities, "utilities")),
        withLabel("Maintenance", merge(costs?.maintenance, "maintenance")),
        withLabel("Setup Fees", merge(costs?.setup, "setup")),
      ],
    },
    {
      key: "management", title: "Management", icon: Briefcase, tone: "cost", color: "chart-5", pctMode: "cost",
      lines: [
        derived("Management Fees", managementFee, "management"),
      ],
    },
  ];

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-display font-semibold text-foreground">Statement Breakdown</h3>
        <p className="text-[10px] text-muted-foreground">tap a card to expand · £0 = nothing this period · <span className="text-amber-400">—</span> = not set up yet</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-stretch">
        {groups.map((g) => {
          const Icon = g.icon;
          const total = sum(g.lines);
          const isOpen = !!open[g.key];
          const accent = `hsl(var(--${g.color}))`;
          return (
            <button
              key={g.key}
              onClick={() => toggle(g.key)}
              style={isOpen ? { borderColor: `hsl(var(--${g.color}) / 0.55)`, backgroundColor: `hsl(var(--${g.color}) / 0.05)` } : undefined}
              className={`text-left rounded-xl border p-4 transition-colors ${isOpen ? "" : "border-border/60 hover:border-border bg-card/40"}`}
            >
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `hsl(var(--${g.color}) / 0.15)` }}>
                  <Icon className="h-4 w-4" style={{ color: accent }} />
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </div>
              <div className="mt-3 h-4 text-xs uppercase tracking-wide text-muted-foreground truncate leading-4">{g.title}</div>
              <div className="h-7 text-xl font-bold tabular-nums truncate leading-7">{gbp(total)}</div>
              {/* always reserve the subline so the divider + lines start at the same y on every card (Revenue has no %) */}
              <div className="h-4 text-[11px] text-muted-foreground leading-4">{g.tone === "cost" ? `${pctOf(total)} of revenue` : ""}</div>

              <div className={`grid transition-all duration-200 ${isOpen ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="overflow-hidden">
                  {/* shared 3-col grid so % and £ line up vertically across every row */}
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-1.5 items-baseline border-t border-border/50 pt-2 text-xs">
                    {g.lines.map((l) => {
                      const v = Number(l.value ?? 0);
                      // Revenue card → this channel's share of revenue; cost cards (not
                      // Distribution) → this line as % of revenue. Same column either way.
                      const showPct =
                        (g.pctMode === "revenue" && l.value != null && v > 0 && grossRevenue > 0) ||
                        (g.pctMode === "cost" && !l.missing && l.value != null && grossRevenue > 0);
                      return (
                        <Fragment key={l.label}>
                          <span className="text-muted-foreground truncate min-w-0" title={l.label}>{l.label}</span>
                          <span className="text-[10px] text-muted-foreground/60 tabular-nums text-right">{showPct ? pctOf(v) : ""}</span>
                          <span className={`tabular-nums text-right whitespace-nowrap ${l.missing ? "text-amber-400" : "text-foreground"}`}>
                            {l.missing || l.value == null ? "—" : gbp(v)}
                          </span>
                        </Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
