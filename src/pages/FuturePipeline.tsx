import { useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { useOTBData } from "@/hooks/useOTBData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PoundSterling, CalendarDays, Clock, Building2, LogIn, Upload, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";

type PeriodWindow = 30 | 60 | 90 | 180;

const PERIODS: { label: string; value: PeriodWindow }[] = [
  { label: "Next 30 days", value: 30 },
  { label: "Next 60 days", value: 60 },
  { label: "Next 90 days", value: 90 },
  { label: "Next 6 months", value: 180 },
];

const fmt = (v: number) => `£${v.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 rounded-lg border border-border/50 shadow-xl">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-display font-semibold text-foreground">{fmt(payload[0].value)}</p>
    </div>
  );
};

export default function FuturePipeline() {
  const [window, setWindow] = useState<PeriodWindow>(180);
  const { data, isLoading } = useOTBData(window);

  const isEmpty = !isLoading && data && !data.hasData;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">Future Pipeline (OTB)</h1>
            <p className="text-sm text-muted-foreground mt-1">Confirmed bookings with future check-in dates</p>
          </div>
          <div className="flex gap-1 p-1 rounded-xl bg-secondary/50 w-fit">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setWindow(p.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  window === p.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Empty State */}
        {isEmpty && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">No future bookings found in the database.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload a current Hostaway CSV export (with check-in dates beyond today) to populate this view.
              </p>
            </div>
            <Button asChild size="sm" className="shrink-0">
              <Link to="/upload">
                <Upload className="h-4 w-4 mr-1.5" /> Upload Data
              </Link>
            </Button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
          ) : (
            <>
              <KpiCard title="Future Revenue" value={fmt(data?.totalRevenue ?? 0)} icon={PoundSterling} accentColor="primary" delay={0} />
              <KpiCard title="Future Nights" value={(data?.totalNights ?? 0).toLocaleString()} icon={CalendarDays} accentColor="accent" delay={60} />
              <KpiCard title="Upcoming Check-ins" value={(data?.upcomingCheckins ?? 0).toLocaleString()} icon={LogIn} accentColor="chart-3" delay={120} />
              <KpiCard title="Properties Booked" value={(data?.propertiesWithBookings ?? 0).toLocaleString()} icon={Building2} accentColor="chart-4" delay={180} />
              <KpiCard title="Avg Lead Time" value={`${data?.avgLeadTime ?? 0} days`} icon={Clock} accentColor="chart-5" delay={240} />
            </>
          )}
        </div>

        {/* Revenue Bar Chart */}
        {!isEmpty && (
          <div className="glass-card p-6 rounded-xl">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Confirmed Revenue — {PERIODS.find((p) => p.value === window)?.label}
            </h3>
            {isLoading ? (
              <Skeleton className="h-72 rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={288}>
                <BarChart data={data?.monthlyData ?? []} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* Bookings by Property */}
        {!isEmpty && !isLoading && data && data.propertySummaries.length > 0 && (
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="p-6 pb-3">
              <h3 className="font-display font-bold text-lg text-foreground">Bookings by Property</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Ranked by future revenue</p>
            </div>
            <div className="divide-y divide-border/20">
              {data.propertySummaries.map((p) => (
                <div key={p.listingId} className="flex items-center gap-4 px-6 py-3 hover:bg-secondary/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.propertyName}</p>
                    {p.locationGroup && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{p.locationGroup}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 shrink-0 text-right">
                    <div>
                      <p className="text-xs text-muted-foreground">Bookings</p>
                      <p className="text-sm font-display font-bold text-foreground">{p.bookingCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Revenue</p>
                      <p className="text-sm font-display font-bold text-foreground">{fmt(p.totalRevenue)}</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-xs text-muted-foreground">Next Check-in</p>
                      <p className="text-xs font-medium text-foreground">{format(parseISO(p.nextCheckIn), "dd MMM yyyy")}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Check-ins — Next 14 Days */}
        {!isEmpty && (
          <div className="space-y-3">
            <div>
              <h3 className="font-display font-bold text-lg text-foreground">Upcoming Check-ins</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Next 14 days</p>
            </div>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
              </div>
            ) : !data?.upcomingReservations.length ? (
              <div className="glass-card p-8 text-center">
                <p className="text-sm text-muted-foreground">No check-ins in the next 14 days</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.upcomingReservations.map((r, i) => (
                  <div key={i} className="glass-card p-4 hover:translate-y-[-1px] hover:shadow-lg transition-all duration-200">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{r.guestName}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{r.propertyName}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {r.platform && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 capitalize">
                            {r.platform}
                          </Badge>
                        )}
                        <span className="text-sm font-display font-bold text-foreground">{fmt(r.revenue)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span>
                        <span className="text-foreground font-medium">{format(parseISO(r.checkIn), "dd MMM")}</span> → {format(parseISO(r.checkOut), "dd MMM")}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border/30">
                        {r.nights} {r.nights === 1 ? "night" : "nights"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
