import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, Eye, Building2, Calendar, Lock } from "lucide-react";

export default function OrinIntelligence() {
  const [view, setView] = useState<"monthly" | "quarterly">("monthly");

  return (
    <AppLayout>
      <div className="p-6 md:p-10 lg:p-12 max-w-3xl mx-auto">
        {/* Page Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              The Orin Brief
            </h1>
            <Badge className="bg-primary/15 text-primary border-primary/20 text-[9px] px-2 py-0.5 font-semibold tracking-wider">
              <Sparkles className="h-3 w-3 mr-1" />AI-Powered
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Your portfolio intelligence, delivered monthly.</p>

          {/* Tabs */}
          <div className="mt-6 inline-flex rounded-xl bg-secondary/40 p-1 border border-border/20">
            {(["monthly", "quarterly"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  view === v
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {v === "monthly" ? "Monthly Brief" : "Quarterly Deep Dive"}
              </button>
            ))}
          </div>
        </div>

        {view === "monthly" ? <MonthlyBrief /> : <QuarterlyPlaceholder />}
      </div>
    </AppLayout>
  );
}

function MonthlyBrief() {
  return (
    <article className="space-y-10 animate-fade-in">
      {/* Report Header */}
      <div className="border-l-2 border-primary/40 pl-6">
        <h2 className="text-xl md:text-2xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          April 2026 — Monthly Performance Brief
        </h2>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs text-muted-foreground">Generated 9 April 2026</span>
          <span className="text-[10px] text-muted-foreground/50">•</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-primary" /> Prepared by Orin
          </span>
        </div>
      </div>

      {/* Section 1 — Portfolio Snapshot */}
      <section>
        <SectionHeading icon={Building2} title="Portfolio Snapshot" />
        <div className="grid grid-cols-3 gap-3 mt-4">
          <StatCard label="Total Revenue" value="£142,300" trend="+8.0%" up />
          <StatCard label="Occupancy Rate" value="74.2%" trend="-1.9%" up={false} />
          <StatCard label="Active Properties" value="46" trend="+3" up />
        </div>
      </section>

      {/* Section 2 — Headline Observation */}
      <section>
        <SectionHeading icon={Sparkles} title="Orin's Headline Observation" />
        <blockquote className="mt-4 border-l-2 border-primary/50 pl-5 py-3 bg-primary/5 rounded-r-lg">
          <p className="text-sm text-foreground/90 leading-relaxed italic">
            "July and August are tracking as your strongest months by revenue, consistent with 2025 patterns. The North Coast cluster is showing early strength — Portstewart properties are booking 18 days ahead of last year's pace at this point."
          </p>
        </blockquote>
      </section>

      {/* Section 3 — Watch List */}
      <section>
        <SectionHeading icon={AlertTriangle} title="Watch List" />
        <div className="space-y-3 mt-4">
          <WatchItem
            property="Devenish Manor No.27"
            note="19 days without a new booking. Consider a rate review."
          />
          <WatchItem
            property="Lough Erne View 4"
            note="Guest rating dropped below 4.2 — two consecutive complaints about check-in process."
          />
          <WatchItem
            property="Castle Hume Lodge B"
            note="Listing photos are 8+ months old. Airbnb algorithm may be suppressing visibility."
          />
        </div>
      </section>

      {/* Section 4 — Owner Highlights */}
      <section>
        <SectionHeading icon={Eye} title="Owner Highlights" />
        <div className="mt-4 rounded-xl border border-border/20 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/20 bg-secondary/20">
                <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-2.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Owner</th>
                <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-2.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Revenue</th>
                <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-2.5" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>vs Prior</th>
              </tr>
            </thead>
            <tbody>
              <OwnerRow name="Dunaird Ltd" revenue="£28,400" change="+22%" up />
              <OwnerRow name="IPT Ltd" revenue="£21,100" change="+14%" up />
              <OwnerRow name="Hunter Berkeley Ltd" revenue="£18,900" change="+9%" up />
              <tr><td colSpan={3} className="py-1"><div className="border-t border-border/10" /></td></tr>
              <OwnerRow name="Ryan & Sinead" revenue="£4,200" change="-18%" up={false} />
              <OwnerRow name="Leo McKee" revenue="£3,800" change="-24%" up={false} />
              <OwnerRow name="Adam Stockman" revenue="£2,100" change="-31%" up={false} />
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 5 — Next Month Outlook */}
      <section>
        <SectionHeading icon={Calendar} title="Next Month Outlook" />
        <div className="mt-4 border-l-2 border-accent/40 pl-5 py-3 bg-accent/5 rounded-r-lg">
          <p className="text-sm text-foreground/90 leading-relaxed">
            May bookings are pacing ahead of April at the same point. Shoulder season demand appears to be building earlier than 2025. Forward bookings for May sit at 68% — 11 percentage points ahead of this time last year. Consider holding rates firm rather than discounting.
          </p>
        </div>
      </section>
    </article>
  );
}

function QuarterlyPlaceholder() {
  return (
    <div className="animate-fade-in">
      <div className="rounded-2xl border border-border/20 bg-secondary/10 p-10 md:p-14 text-center">
        <div className="h-16 w-16 rounded-2xl bg-secondary/30 flex items-center justify-center mx-auto mb-6">
          <Lock className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Q2 2026 Quarterly Deep Dive
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Your Q2 2026 Quarterly Deep Dive will be available on <span className="text-foreground font-medium">1 July 2026</span>. Orin analyses the full quarter — revenue trends, occupancy patterns, pricing performance, and owner portfolio rankings.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 text-xs text-muted-foreground/50">
          <Calendar className="h-3.5 w-3.5" />
          Next report: 1 October 2026
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function SectionHeading({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <h3 className="text-base font-semibold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{title}</h3>
    </div>
  );
}

function StatCard({ label, value, trend, up }: { label: string; value: string; trend: string; up: boolean }) {
  return (
    <div className="rounded-xl border border-border/20 bg-secondary/10 p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{label}</p>
      <p className="text-xl font-bold text-foreground" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{value}</p>
      <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${up ? "text-emerald-400" : "text-red-400"}`}>
        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {trend}
      </div>
    </div>
  );
}

function WatchItem({ property, note }: { property: string; note: string }) {
  return (
    <div className="flex gap-3 p-3.5 rounded-xl border border-border/15 bg-secondary/10">
      <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <AlertTriangle className="h-3 w-3 text-primary" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{property}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{note}</p>
      </div>
    </div>
  );
}

function OwnerRow({ name, revenue, change, up }: { name: string; revenue: string; change: string; up: boolean }) {
  return (
    <tr className="border-b border-border/10 last:border-0">
      <td className="px-4 py-2.5 text-sm text-foreground font-medium">{name}</td>
      <td className="px-4 py-2.5 text-sm text-foreground text-right">{revenue}</td>
      <td className={`px-4 py-2.5 text-sm text-right font-medium ${up ? "text-emerald-400" : "text-red-400"}`}>
        <span className="flex items-center justify-end gap-1">
          {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {change}
        </span>
      </td>
    </tr>
  );
}
