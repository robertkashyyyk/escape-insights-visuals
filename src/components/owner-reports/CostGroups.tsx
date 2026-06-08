import { useState } from "react";
import { ChevronDown, PoundSterling, CreditCard, Sparkles, Wrench, Briefcase, type LucideIcon } from "lucide-react";
import type { OwnerCostCategories, CostCategory } from "@/hooks/useOwnerCostCategories";

// Foldable, grouped cost cards for the owner report. Five top-level groups; each
// collapses to a headline total (+ % of revenue) and expands to its constituent
// lines. Keeps the real estate tight while letting everything be seen on demand.
const gbp = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(n);

interface Line { label: string; value: number | null; missing?: boolean }
interface Group { key: string; title: string; icon: LucideIcon; tone: "revenue" | "cost"; color: string; lines: Line[] }

const cat = (c: CostCategory | undefined): Line["value"] => (c?.value ?? null);
const sum = (lines: Line[]) => lines.reduce((s, l) => s + Number(l.value ?? 0), 0);

export function CostGroups({
  grossRevenue, managementFee, bookingFees, cardProcessing, costs, manualByCode = {},
}: {
  grossRevenue: number; managementFee: number; bookingFees: number; cardProcessing: number;
  costs: OwnerCostCategories | undefined; manualByCode?: Record<string, number>;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setOpen((p) => ({ ...p, [k]: !p[k] }));
  const pctOf = (v: number) => (grossRevenue > 0 ? `${((v / grossRevenue) * 100).toFixed(1)}%` : "—");

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
      key: "revenue", title: "Revenue", icon: PoundSterling, tone: "revenue", color: "primary",
      lines: [
        { label: "Revenue (gross)", value: grossRevenue + (manualByCode["revenue"] ?? 0) },
        { label: "Refunds", value: refunds > 0 ? -refunds : null, missing: refunds === 0 },
      ],
    },
    {
      key: "distribution", title: "Distribution Fees", icon: CreditCard, tone: "cost", color: "chart-3",
      lines: [
        derived("Booking Fees", bookingFees, "booking_fees"),
        derived("Card Processing Fees", cardProcessing, "card_processing"),
      ],
    },
    {
      key: "servicing", title: "Servicing", icon: Sparkles, tone: "cost", color: "chart-2",
      lines: [
        withLabel("Cleaning", merge(costs?.cleaning, "cleaning")),
        withLabel("Laundry", merge(costs?.laundry, "laundry")),
        withLabel("Consumables", merge(costs?.consumables, "consumables")),
        withLabel("Welcome Baskets", merge(costs?.welcomeBaskets, "welcome_baskets")),
      ],
    },
    {
      key: "operations", title: "Operations", icon: Wrench, tone: "cost", color: "chart-4",
      lines: [
        withLabel("Utilities", merge(costs?.utilities, "utilities")),
        withLabel("Maintenance", merge(costs?.maintenance, "maintenance")),
      ],
    },
    {
      key: "management", title: "Management", icon: Briefcase, tone: "cost", color: "chart-5",
      lines: [
        derived("Management Fees", managementFee, "management"),
        withLabel("Setup Fees", merge(costs?.setup, "setup")),
      ],
    },
  ];

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-display font-semibold text-foreground">Statement Breakdown</h3>
        <p className="text-[10px] text-muted-foreground">tap a card to expand · £0 = nothing this period · <span className="text-amber-400">—</span> = not set up yet</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-start">
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
              <div className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{g.title}</div>
              <div className="text-xl font-bold">{gbp(total)}</div>
              {g.tone === "cost" && <div className="text-[11px] text-muted-foreground">{pctOf(total)} of revenue</div>}

              <div className={`grid transition-all duration-200 ${isOpen ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="overflow-hidden">
                  <div className="space-y-1.5 border-t border-border/50 pt-2">
                    {g.lines.map((l) => (
                      <div key={l.label} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">{l.label}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          {g.tone === "cost" && !l.missing && l.value != null && grossRevenue > 0 && (
                            <span className="text-[10px] text-muted-foreground/70">{pctOf(Number(l.value))}</span>
                          )}
                          <span className={l.missing ? "text-amber-400" : "text-foreground"}>
                            {l.missing || l.value == null ? "—" : gbp(Number(l.value))}
                          </span>
                        </span>
                      </div>
                    ))}
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
