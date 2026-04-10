import { useState } from "react";
import { OwnerLayout } from "@/components/layout/OwnerLayout";
import { useOwnerPortalData, type OwnerPeriodType } from "@/hooks/useOwnerPortalData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PoundSterling, Percent, BedDouble, TrendingUp, TrendingDown, CalendarDays } from "lucide-react";

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

const periods: OwnerPeriodType[] = ["Week", "Month", "Quarter", "Year"];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function TrendBadge({ current, previous, label }: { current: number; previous: number; label: string }) {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const isUp = pct >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-medium ${isUp ? "text-emerald-400" : "text-red-400"}`}>
      {isUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {isUp ? "+" : ""}{pct.toFixed(0)}% vs last year
    </span>
  );
}

function MiniSparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[2px] h-8">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-primary/60 min-h-[2px]"
          style={{ height: `${(v / max) * 100}%` }}
        />
      ))}
    </div>
  );
}

export default function OwnerPortfolio() {
  const [periodType, setPeriodType] = useState<OwnerPeriodType>("Year");
  const { data, isLoading } = useOwnerPortalData(periodType);

  if (isLoading) {
    return (
      <OwnerLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
          </div>
        </div>
      </OwnerLayout>
    );
  }

  const { owner, properties, kpis, currentYear } = data || { properties: [], kpis: null, currentYear: new Date().getFullYear() };
  const firstName = owner?.name?.split(" ")[0] || "there";
  const todayStr = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const kpiCards = kpis ? [
    { label: "Total Revenue", value: fmt(kpis.totalRevenue), icon: PoundSterling, prev: kpis.prevYearRevenue },
    { label: "Occupancy Rate", value: `${kpis.occupancy.toFixed(0)}%`, icon: Percent, prev: kpis.prevYearOccupancy },
    { label: "Average Daily Rate", value: fmt(kpis.adr), icon: BedDouble, prev: kpis.prevYearAdr },
  ] : [];

  return (
    <OwnerLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">
              {getGreeting()}, {firstName}.
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Here is how your portfolio is performing. · {todayStr}
            </p>
          </div>

          {/* Period Filter */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary/50 border border-border/30">
            {periods.map((p) => (
              <button
                key={p}
                onClick={() => setPeriodType(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  periodType === p
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {kpiCards.map((kpi) => (
            <Card key={kpi.label} className="border-border/30 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <kpi.icon className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-medium uppercase tracking-wider">{kpi.label}</span>
                </div>
                <p className="text-xl md:text-2xl font-display font-bold text-foreground">{kpi.value}</p>
                <TrendBadge current={parseFloat(kpi.value.replace(/[£%,]/g, "")) || 0} previous={kpi.prev} label={String(currentYear - 1)} />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* My Properties */}
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground mb-4">Your Properties</h2>
          {properties.length === 0 ? (
            <Card className="border-border/30 bg-card/50 p-8 text-center">
              <p className="text-sm text-muted-foreground">No properties linked to your account yet.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {properties.map((p) => (
                <Card key={p.id} className="border-border/30 bg-card/50 backdrop-blur-sm hover:border-primary/20 transition-colors">
                  <CardContent className="p-5 space-y-4">
                    <div>
                      <h3 className="font-display font-semibold text-foreground text-sm">{p.name}</h3>
                      <div className="flex items-center gap-2 mt-1.5">
                        {p.location_group && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{p.location_group}</Badge>
                        )}
                        {p.bedrooms != null && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <BedDouble className="h-2.5 w-2.5" /> {p.bedrooms} bed
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Revenue</p>
                        <p className="text-sm font-display font-bold text-foreground">{fmt(p.revenueThisYear)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Occupancy</p>
                        <p className="text-sm font-display font-bold text-foreground">{p.occupancyPct.toFixed(0)}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">ADR</p>
                        <p className="text-sm font-display font-bold text-foreground">{fmt(p.adr)}</p>
                      </div>
                    </div>

                    <MiniSparkline data={p.monthlyRevenue} />

                    {p.upcomingCount > 0 && (
                      <div className="flex items-center gap-1.5 text-[11px] text-primary">
                        <CalendarDays className="h-3 w-3" />
                        {p.upcomingCount} upcoming {p.upcomingCount === 1 ? "reservation" : "reservations"}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </OwnerLayout>
  );
}
