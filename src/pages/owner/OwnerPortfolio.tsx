import { useState } from "react";
import { OwnerLayout } from "@/components/layout/OwnerLayout";
import { useOwnerPortalData, type OwnerPeriodType, type OwnerDateMode, type OwnerProperty, getPeriodLabel, getPeriodRange, shiftPeriod } from "@/hooks/useOwnerPortalData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PoundSterling, Percent, BedDouble, TrendingUp, TrendingDown, CalendarDays, ChevronLeft, ChevronRight, BookOpen, Moon, CalendarCheck, MapPin, ListTree, AlertTriangle, RefreshCw } from "lucide-react";
import { isFuture, formatDistanceToNow, parseISO } from "date-fns";
import { OwnerLocalAreaTab } from "@/components/amenities/OwnerLocalAreaTab";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { OwnerReservationsDrawer } from "@/components/owners/OwnerReservationsDrawer";

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

const periods: OwnerPeriodType[] = ["Week", "Month", "Quarter", "Year"];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const isUp = pct >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-medium ${isUp ? "text-emerald-400" : "text-red-400"}`}>
      {isUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {isUp ? "+" : ""}{pct.toFixed(0)}% vs same period last year
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
  const now = new Date();
  const [periodType, setPeriodType] = useState<OwnerPeriodType>("Year");
  const [periodRef, setPeriodRef] = useState<Date>(now);
  const [dateMode, setDateMode] = useState<OwnerDateMode>("check_in");
  const [drawerProperty, setDrawerProperty] = useState<OwnerProperty | null>(null);
  const { data, isLoading } = useOwnerPortalData(periodType, periodRef, dateMode);

  const canGoForward = (() => {
    const next = shiftPeriod(periodRef, periodType, 1);
    const { from } = getPeriodRange(periodType, next);
    return !isFuture(from);
  })();

  const handlePeriodChange = (p: OwnerPeriodType) => {
    setPeriodType(p);
    setPeriodRef(now); // reset to current period
  };

  const label = getPeriodLabel(periodType, periodRef, now);

  if (isLoading) {
    return (
      <OwnerLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
          </div>
        </div>
      </OwnerLayout>
    );
  }

  const { owner, properties, kpis, lastSyncAt, duplicatesDroppedCount } = (data as any) || { properties: [], kpis: null, currentYear: now.getFullYear(), lastSyncAt: null, duplicatesDroppedCount: 0 };
  const firstName = owner?.name?.split(" ")[0] || "there";
  const todayStr = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const kpiCards = kpis ? [
    { label: "Total Revenue", value: fmt(kpis.totalRevenue), icon: PoundSterling, prev: kpis.prevYearRevenue },
    { label: "Bookings", value: kpis.totalBookings.toLocaleString(), icon: BookOpen, prev: null },
    { label: "Nights Sold", value: kpis.totalNights.toLocaleString(), icon: Moon, prev: null },
    { label: "Occupancy Rate", value: `${kpis.occupancy.toFixed(0)}%`, icon: Percent, prev: kpis.prevYearOccupancy },
    { label: "Average Daily Rate", value: fmt(kpis.adr), icon: BedDouble, prev: kpis.prevYearAdr },
  ] : [];

  return (
    <OwnerLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">
            {getGreeting()}, {firstName}.
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here is how your portfolio is performing. · {todayStr}
          </p>
        </div>

        {/* Data freshness + duplicate notice */}
        {(lastSyncAt || duplicatesDroppedCount > 0) && (
          <div className="flex flex-wrap items-center gap-3 text-[11px] -mt-4">
            {lastSyncAt && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <RefreshCw className="h-3 w-3" />
                Data synced from Hostaway {formatDistanceToNow(parseISO(lastSyncAt), { addSuffix: true })}
              </span>
            )}
            {duplicatesDroppedCount > 0 && (
              <span className="flex items-center gap-1.5 text-amber-500">
                <AlertTriangle className="h-3 w-3" />
                {duplicatesDroppedCount} duplicate {duplicatesDroppedCount === 1 ? "reservation" : "reservations"} from Hostaway excluded in this period — open any property to review.
              </span>
            )}
          </div>
        )}

        {/* Period Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Period Type Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary/50 border border-border/30">
            {periods.map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
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

          {/* Date Mode Toggle */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-secondary/50 border border-border/30">
            <button
              onClick={() => setDateMode("check_in")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                dateMode === "check_in"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarCheck className="h-3 w-3 inline mr-1.5" />
              Check-in
            </button>
            <button
              onClick={() => setDateMode("created")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                dateMode === "created"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BookOpen className="h-3 w-3 inline mr-1.5" />
              Booking Date
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPeriodRef(shiftPeriod(periodRef, periodType, -1))}
              className="h-8 w-8 rounded-md border border-border/30 bg-secondary/30 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-foreground min-w-[180px] text-center">
              {label}
            </span>
            <button
              onClick={() => canGoForward && setPeriodRef(shiftPeriod(periodRef, periodType, 1))}
              disabled={!canGoForward}
              className={`h-8 w-8 rounded-md border border-border/30 bg-secondary/30 flex items-center justify-center transition-colors ${
                canGoForward
                  ? "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  : "text-muted-foreground/30 cursor-not-allowed"
              }`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {/* Reset to current */}
            {(() => {
              const currentStart = getPeriodRange(periodType, now).from;
              const selectedStart = getPeriodRange(periodType, periodRef).from;
              if (currentStart.getTime() !== selectedStart.getTime()) {
                return (
                  <button
                    onClick={() => setPeriodRef(now)}
                    className="text-[11px] text-primary hover:text-primary/80 font-medium ml-1 transition-colors"
                  >
                    Today
                  </button>
                );
              }
              return null;
            })()}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {kpiCards.map((kpi) => (
            <Card key={kpi.label} className="border-border/30 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <kpi.icon className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-medium uppercase tracking-wider">{kpi.label}</span>
                </div>
                <p className="text-xl md:text-2xl font-display font-bold text-foreground">{kpi.value}</p>
                {kpi.prev != null && (
                  <TrendBadge current={parseFloat(kpi.value.replace(/[£%,]/g, "")) || 0} previous={kpi.prev} />
                )}
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
                      <h3 className="font-display font-semibold text-foreground text-sm">
                        {p.name}
                        {p.isBundle && <Badge variant="outline" className="text-[9px] ml-2 px-1.5 py-0 border-primary/30 text-primary">Bundle</Badge>}
                      </h3>
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

                    <div className="grid grid-cols-5 gap-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Revenue</p>
                        <p className="text-sm font-display font-bold text-foreground">{fmt(p.revenueThisYear)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Bookings</p>
                        <p className="text-sm font-display font-bold text-foreground">{p.totalBookings}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Nights</p>
                        <p className="text-sm font-display font-bold text-foreground">{p.totalNights}</p>
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

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/20">
                      <button
                        onClick={() => setDrawerProperty(p)}
                        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ListTree className="h-3 w-3" />
                        View {p.totalBookings} {p.totalBookings === 1 ? "reservation" : "reservations"}
                        {p.duplicatesDropped.length > 0 && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/40 text-amber-500 ml-1">
                            {p.duplicatesDropped.length} dup
                          </Badge>
                        )}
                      </button>
                    </div>

                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                        <MapPin className="h-3 w-3" /> Local area
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <OwnerLocalAreaTab listingId={p.id} />
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <OwnerReservationsDrawer
        property={drawerProperty}
        periodLabel={label}
        onClose={() => setDrawerProperty(null)}
      />
    </OwnerLayout>
  );
}
