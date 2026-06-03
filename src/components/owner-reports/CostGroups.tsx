import { useState } from "react";
import { ChevronDown, PoundSterling, CreditCard, Sparkles, Wrench, Briefcase, type LucideIcon } from "lucide-react";
import type { OwnerCostCategories, CostCategory } from "@/hooks/useOwnerCostCategories";

// Foldable, grouped cost cards for the owner report. Five top-level groups; each
// collapses to a headline total and expands to its constituent lines. Keeps the
// real estate tight while letting everything be seen on demand.
const gbp = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2 }).format(n);

interface Line { label: string; value: number | null; missing?: boolean; note?: string }
interface Group { key: string; title: string; icon: LucideIcon; tone: "revenue" | "cost"; lines: Line[] }

const cat = (c: CostCategory | undefined): Line["value"] => (c?.value ?? null);
const sum = (lines: Line[]) => lines.reduce((s, l) => s + Number(l.value ?? 0), 0);

export function CostGroups({
  grossRevenue, managementFee, bookingFees, cardProcessing, costs,
}: {
  grossRevenue: number; managementFee: number; bookingFees: number; cardProcessing: number;
  costs: OwnerCostCategories | undefined;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setOpen((p) => ({ ...p, [k]: !p[k] }));

  const groups: Group[] = [
    {
      key: "revenue", title: "Revenue", icon: PoundSterling, tone: "revenue",
      lines: [
        { label: "Revenue (gross)", value: grossRevenue },
        { label: "Refunds", value: null, missing: true },   // no source yet
      ],
    },
    {
      key: "distribution", title: "Distribution Fees", icon: CreditCard, tone: "cost",
      lines: [
        { label: "Booking Fees", value: bookingFees },
        { label: "Card Processing Fees", value: cardProcessing },
        // Provider Fees — to add once its source is defined
      ],
    },
    {
      key: "servicing", title: "Servicing", icon: Sparkles, tone: "cost",
      lines: [
        { label: "Cleaning", value: cat(costs?.cleaning), missing: costs?.cleaning?.missing, note: costs?.cleaning?.note },
        { label: "Laundry", value: cat(costs?.laundry), missing: costs?.laundry?.missing },
        { label: "Consumables", value: cat(costs?.consumables), missing: costs?.consumables?.missing },
        { label: "Welcome Baskets", value: cat(costs?.welcomeBaskets), missing: costs?.welcomeBaskets?.missing },
      ],
    },
    {
      key: "operations", title: "Operations", icon: Wrench, tone: "cost",
      lines: [
        { label: "Utilities", value: cat(costs?.utilities), missing: costs?.utilities?.missing },
        { label: "Maintenance", value: cat(costs?.maintenance), missing: costs?.maintenance?.missing },
      ],
    },
    {
      key: "management", title: "Management", icon: Briefcase, tone: "cost",
      lines: [
        { label: "Management Fees", value: managementFee },
        { label: "Setup Fees", value: cat(costs?.setup), missing: costs?.setup?.missing },
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
          return (
            <button
              key={g.key}
              onClick={() => toggle(g.key)}
              className={`text-left rounded-xl border p-4 transition-colors ${isOpen ? "border-primary/40 bg-primary/[0.04]" : "border-border/60 hover:border-border bg-card/40"}`}
            >
              <div className="flex items-center justify-between">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${g.tone === "revenue" ? "bg-primary/10" : "bg-accent/10"}`}>
                  <Icon className={`h-4 w-4 ${g.tone === "revenue" ? "text-primary" : "text-accent-foreground/80"}`} />
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </div>
              <div className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{g.title}</div>
              <div className="text-xl font-bold">{gbp(total)}</div>

              <div className={`grid transition-all duration-200 ${isOpen ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="overflow-hidden">
                  <div className="space-y-1.5 border-t border-border/50 pt-2">
                    {g.lines.map((l) => (
                      <div key={l.label} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{l.label}</span>
                        <span className={l.missing ? "text-amber-400" : "text-foreground"}>
                          {l.missing || l.value == null ? "—" : gbp(Number(l.value))}
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
