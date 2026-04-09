import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { useRevenuePacing } from "@/hooks/useRevenuePacing";
import { Skeleton } from "@/components/ui/skeleton";
import { PoundSterling, Clock, TrendingUp, AlertCircle } from "lucide-react";
import { addMonths, subMonths, startOfMonth, format, differenceInDays } from "date-fns";

const formatGBP = (v: number) =>
  `£${v.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function RevenuePacing() {
  const months = useMemo(() => {
    const lastMonth = startOfMonth(subMonths(new Date(), 1));
    return Array.from({ length: 6 }, (_, i) => startOfMonth(addMonths(lastMonth, i)));
  }, []);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const targetMonth = months[selectedIdx];
  const { data, isLoading } = useRevenuePacing(targetMonth);

  const pacingPct = data?.pacingPct ?? 0;
  const isAhead = pacingPct >= 100;
  const gaugeAngle = Math.min(pacingPct, 200);

  const progressPct = data?.historicalFinalRevenue
    ? Math.min((data.currentRevenue / data.historicalFinalRevenue) * 100, 100)
    : 0;
  const historicalPointPct = data?.historicalFinalRevenue && data.historicalRevenue
    ? Math.min((data.historicalRevenue / data.historicalFinalRevenue) * 100, 100)
    : 0;

  // Fix 1: compute days-out subtitle
  const today = new Date();
  const monthStart = startOfMonth(targetMonth);
  const isCurrentOrPast = today >= monthStart;
  const daysSubtitle = isCurrentOrPast
    ? `${differenceInDays(today, monthStart)} days into ${format(targetMonth, "MMMM")}`
    : `${differenceInDays(monthStart, today)} days until ${format(targetMonth, "MMMM")} starts`;

  // Fix 2: empty state
  const hasNoBookings = !isLoading && data && data.currentRevenue === 0;

  return (
    <AppLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
            Revenue Pacing
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Compare current bookings against the same point last year
          </p>
        </div>

        <div className="flex gap-1 p-1 rounded-xl bg-secondary/50 w-fit">
          {months.map((m, i) => (
            <button
              key={i}
              onClick={() => setSelectedIdx(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                i === selectedIdx
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {format(m, "MMM yyyy")}
            </button>
          ))}
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : hasNoBookings ? (
          <div className="glass-card p-8 flex flex-col items-center gap-3 border border-primary/30 bg-primary/5">
            <AlertCircle className="h-10 w-10 text-primary" />
            <p className="text-sm text-center text-muted-foreground max-w-md">
              No bookings on the books yet for <span className="font-semibold text-foreground">{format(targetMonth, "MMMM yyyy")}</span>. This view will populate once bookings are confirmed for this period.
            </p>
          </div>
        ) : (
          <div className="glass-card p-8 flex flex-col items-center">
            <svg viewBox="0 0 200 120" className="w-64 h-32 mb-4">
              <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="hsl(var(--secondary))" strokeWidth="12" strokeLinecap="round" />
              <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={isAhead ? "hsl(var(--success))" : "hsl(var(--destructive))"} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(Math.min(gaugeAngle, 200) / 200) * 251.2} 251.2`} className="transition-all duration-700" />
              <text x="100" y="85" textAnchor="middle" className="fill-foreground font-display font-bold" fontSize="28">{Math.round(pacingPct)}%</text>
              <text x="100" y="105" textAnchor="middle" fontSize="11" className={isAhead ? "fill-success" : "fill-destructive"} fontWeight="600">{isAhead ? "AHEAD" : "BEHIND"}</text>
            </svg>
            <p className="text-xs text-muted-foreground">{daysSubtitle}</p>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard title="Current Booked Revenue" value={formatGBP(data?.currentRevenue ?? 0)} subtitle={format(targetMonth, "MMMM yyyy")} icon={PoundSterling} accentColor="primary" delay={0} />
            <KpiCard title="Same Point Last Year" value={formatGBP(data?.historicalRevenue ?? 0)} subtitle={daysSubtitle} icon={Clock} accentColor="accent" delay={100} />
            <KpiCard title="Final Revenue Last Year" value={formatGBP(data?.historicalFinalRevenue ?? 0)} subtitle={format(startOfMonth(new Date(targetMonth.getFullYear() - 1, targetMonth.getMonth())), "MMMM yyyy")} icon={TrendingUp} accentColor="chart-3" delay={200} />
          </div>
        )}

        {!isLoading && data && !hasNoBookings && (
          <div className="glass-card p-6 space-y-3">
            <p className="text-sm font-medium text-foreground">Progress vs Last Year's Final</p>
            <div className="relative">
              <div className="h-4 rounded-full bg-secondary/50 overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${progressPct}%` }} />
              </div>
              {historicalPointPct > 0 && (
                <div className="absolute top-0 h-4 w-0.5 bg-muted-foreground" style={{ left: `${historicalPointPct}%` }} title={`Last year at this point: ${formatGBP(data.historicalRevenue)}`} />
              )}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatGBP(data.currentRevenue)} booked</span>
              <span>{formatGBP(data.historicalFinalRevenue)} last year total</span>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
