import { AppLayout } from "@/components/layout/AppLayout";
import { format } from "date-fns";
import { useTodayData } from "@/hooks/useTodayData";
import { Sparkles, LogOut, LogIn, AlertTriangle, PoundSterling, CalendarCheck, BarChart3, Loader2, SprayCan } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

export default function Today() {
  const { data, isLoading } = useTodayData();
  const today = new Date();

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">

        {/* 1. Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">
              Today
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {format(today, "EEEE, d MMMM yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatChip label="Checkouts" value={isLoading ? "–" : String(data?.checkoutsToday ?? 0)} icon={<LogOut className="h-3.5 w-3.5" />} />
            <StatChip label="Check-ins" value={isLoading ? "–" : String(data?.checkinsToday ?? 0)} icon={<LogIn className="h-3.5 w-3.5" />} />
            <StatChip label="Cleans" value={isLoading ? "–" : String(data?.checkoutsToday ?? 0)} icon={<CalendarCheck className="h-3.5 w-3.5" />} />
            {!isLoading && (data?.dirtyProperties ?? 0) > 0 && (
              <Link to="/operations/cleaning">
                <StatChip
                  label="Needs Cleaning"
                  value={String(data?.dirtyProperties ?? 0)}
                  icon={<SprayCan className="h-3.5 w-3.5" />}
                  alert
                />
              </Link>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* 2. Today's Movements */}
            <section className="glass-card rounded-xl border border-border/30 overflow-hidden">
              <div className="px-5 py-4 border-b border-border/20">
                <h2 className="text-sm font-display font-semibold text-foreground uppercase tracking-wider">
                  Today's Movements
                </h2>
              </div>
              <div className="divide-y divide-border/20">
                {data?.movements.length === 0 && (
                  <div className="px-5 py-8 text-center text-muted-foreground text-sm">
                    No check-ins or check-outs today.
                  </div>
                )}
                {data?.movements.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors">
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                      m.type === "checkout" ? "bg-destructive/10" : "bg-accent/10"
                    }`}>
                      {m.type === "checkout"
                        ? <LogOut className="h-3.5 w-3.5 text-destructive" />
                        : <LogIn className="h-3.5 w-3.5 text-accent" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground font-medium truncate">{m.propertyName}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.guestName}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 shrink-0 ${
                      m.type === "checkout"
                        ? "border-destructive/30 text-destructive"
                        : "border-accent/30 text-accent"
                    }`}>
                      {m.type === "checkout" ? "Checkout" : "Check-in"}
                    </Badge>
                    {data?.sameDayTurnarounds.has(m.listingId) && (
                      <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] px-2 py-0.5 shrink-0">
                        Same-Day Turnaround
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* 3. Orin's Morning Note */}
            <section className="rounded-xl border border-primary/20 bg-primary/5 p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-primary/60" />
              <div className="flex items-center gap-2 mb-3 ml-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-display font-semibold text-primary uppercase tracking-wider">
                  Orin's Morning Note
                </h2>
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed ml-3">
                3 cleans scheduled today. July is pacing 14% behind last year on the North Coast.
                Devenish Manor No.27 has had no new bookings in 19 days. Consider a rate adjustment
                or running a last-minute promotion for gaps in the next 14 days.
              </p>
            </section>

            {/* 4. This Week strip */}
            <section className="glass-card rounded-xl border border-border/30 p-5">
              <h2 className="text-sm font-display font-semibold text-foreground uppercase tracking-wider mb-4">
                This Week
              </h2>
              <div className="grid grid-cols-7 gap-2">
                {data?.weekStrip.map((day, i) => {
                  const isTodayDay = i === 0;
                  return (
                    <div
                      key={i}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-lg transition-colors ${
                        isTodayDay ? "bg-primary/10 ring-1 ring-primary/30" : "bg-secondary/30"
                      }`}
                    >
                      <span className={`text-[10px] uppercase font-medium tracking-wider ${isTodayDay ? "text-primary" : "text-muted-foreground"}`}>
                        {day.label}
                      </span>
                      <span className={`text-xs font-medium ${isTodayDay ? "text-foreground" : "text-muted-foreground"}`}>
                        {format(day.date, "d")}
                      </span>
                      <div className="flex gap-1">
                        {day.checkouts > 0 && (
                          <span className="flex items-center gap-0.5 text-[9px] text-destructive">
                            <LogOut className="h-2.5 w-2.5" />{day.checkouts}
                          </span>
                        )}
                        {day.checkins > 0 && (
                          <span className="flex items-center gap-0.5 text-[9px] text-accent">
                            <LogIn className="h-2.5 w-2.5" />{day.checkins}
                          </span>
                        )}
                        {day.checkouts === 0 && day.checkins === 0 && (
                          <span className="text-[9px] text-muted-foreground/40">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 5. Open Actions */}
            <section className="glass-card rounded-xl border border-border/30 overflow-hidden">
              <div className="px-5 py-4 border-b border-border/20">
                <h2 className="text-sm font-display font-semibold text-foreground uppercase tracking-wider">
                  Open Actions
                </h2>
              </div>
              <div className="divide-y divide-border/20">
                {[
                  "4 owner management rates not set",
                  "Owner report for Dunaird Ltd due in 3 days",
                  "2 properties missing location group assignment",
                ].map((action, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <AlertTriangle className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <p className="text-sm text-foreground/80">{action}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 6. Portfolio Pulse */}
            <section>
              <h2 className="text-sm font-display font-semibold text-foreground uppercase tracking-wider mb-4">
                Portfolio Pulse
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <PulseCard title="Revenue MTD" value={`£${(data?.revenueMTD ?? 0).toLocaleString()}`} icon={<PoundSterling className="h-4 w-4" />} />
                <PulseCard title="Occupancy This Week" value={`${data?.occupancyThisWeek ?? 0}%`} icon={<BarChart3 className="h-4 w-4" />} />
                <PulseCard title="Bookings Next 30 Days" value={String(data?.bookingsNext30 ?? 0)} icon={<CalendarCheck className="h-4 w-4" />} />
              </div>
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function StatChip({ label, value, icon, muted, alert }: { label: string; value: string; icon: React.ReactNode; muted?: boolean; alert?: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
      alert ? "border-red-500/30 bg-red-500/10" : muted ? "border-border/20 bg-secondary/20" : "border-border/30 bg-secondary/40"
    }`}>
      <span className={alert ? "text-red-400" : muted ? "text-muted-foreground/50" : "text-primary"}>{icon}</span>
      <div className="flex flex-col">
        <span className={`text-xs font-semibold ${alert ? "text-red-400" : muted ? "text-muted-foreground/50" : "text-foreground"}`}>{value}</span>
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
    </div>
  );
}

function PulseCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="glass-card rounded-xl border border-border/30 p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-primary">{icon}</span>
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{title}</span>
      </div>
      <p className="text-2xl font-display font-bold text-foreground">{value}</p>
    </div>
  );
}
