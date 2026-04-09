import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { useRevenuePacing } from "@/hooks/useRevenuePacing";
import { Skeleton } from "@/components/ui/skeleton";
import { PoundSterling, Clock, TrendingUp } from "lucide-react";
import { addMonths, startOfMonth, format } from "date-fns";

const formatGBP = (v: number) =>
  `£${v.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function RevenuePacing() {
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => startOfMonth(addMonths(now, i)));
  }, []);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const targetMonth = months[selectedIdx];
  const { data, isLoading } = useRevenuePacing(targetMonth);

  const pacingPct = data?.pacingPct ?? 0;
  const isAhead = pacingPct >= 100;
  const gaugeAngle = Math.min(pacingPct, 200); // cap at 200% for gauge

  // Progress bar: current as % of last year final
  const progressPct = data?.historicalFinalRevenue
    ? Math.min((data.currentRevenue / data.historicalFinalRevenue) * 100, 100)
    : 0;
  const historicalPointPct = data?.historicalFinalRevenue && data.historicalRevenue
    ? Math.min((data.historicalRevenue / data.historicalFinalRevenue) * 100, 100)
    : 0;

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

        {/* Month Selector */}
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

        {/* Pacing Gauge */}
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="glass-card p-8 flex flex-col items-center">
            <svg viewBox="0 0 200 120" className="w-64 h-32 mb-4">
              {/* Background arc */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="hsl(var(--secondary))"
                strokeWidth="12"
                strokeLinecap="round"
              />
              {/* Filled arc */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke={isAhead ? "hsl(var(--success))" : "hsl(var(--destructive))"}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${(Math.min(gaugeAngle, 200) / 200) * 251.2} 251.2`}
                className="transition-all duration-700"
              />
              {/* Percentage text */}
              <text
                x="100"
                y="85"
                textAnchor="middle"
                className="fill-foreground font-display font-bold"
                fontSize="28"
              >
                {Math.round(pacingPct)}%
              </text>
              <text
                x="100"
                y="105"
                textAnchor="middle"
                fontSize="11"
                className={isAhead ? "fill-success" : "fill-destructive"}
                fontWeight="600"
              >
                {isAhead ? "AHEAD" : "BEHIND"}
              </text>
            </svg>
            <p className="text-xs text-muted-foreground">
              {data?.daysUntilStart ?? 0} days until {format(targetMonth, "MMMM")} starts
            </p>
          </div>
        )}

        {/* KPI Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              title="Current Booked Revenue"
              value={formatGBP(data?.currentRevenue ?? 0)}
              subtitle={format(targetMonth, "MMMM yyyy")}
              icon={DollarSign}
              accentColor="primary"
              delay={0}
            />
            <KpiCard
              title="Same Point Last Year"
              value={formatGBP(data?.historicalRevenue ?? 0)}
              subtitle={`At ${data?.daysUntilStart ?? 0} days out`}
              icon={Clock}
              accentColor="accent"
              delay={100}
            />
            <KpiCard
              title="Final Revenue Last Year"
              value={formatGBP(data?.historicalFinalRevenue ?? 0)}
              subtitle={format(startOfMonth(new Date(targetMonth.getFullYear() - 1, targetMonth.getMonth())), "MMMM yyyy")}
              icon={TrendingUp}
              accentColor="chart-3"
              delay={200}
            />
          </div>
        )}

        {/* Progress Bar */}
        {!isLoading && data && (
          <div className="glass-card p-6 space-y-3">
            <p className="text-sm font-medium text-foreground">
              Progress vs Last Year's Final
            </p>
            <div className="relative">
              <div className="h-4 rounded-full bg-secondary/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {/* Historical point marker */}
              {historicalPointPct > 0 && (
                <div
                  className="absolute top-0 h-4 w-0.5 bg-muted-foreground"
                  style={{ left: `${historicalPointPct}%` }}
                  title={`Last year at this point: ${formatGBP(data.historicalRevenue)}`}
                />
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
