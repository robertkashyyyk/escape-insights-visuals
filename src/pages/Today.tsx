import { AppLayout } from "@/components/layout/AppLayout";
import { format } from "date-fns";
import { useTodayData } from "@/hooks/useTodayData";
import { useTodayCleans } from "@/hooks/useTodayCleans";
import { useTodayCleaningProgress } from "@/hooks/useTodayCleaningProgress";
import { useCleaningAttention, type DayState } from "@/hooks/useCleaningAttention";
import { LogOut, LogIn, PoundSterling, CalendarCheck, BarChart3, Loader2, SprayCan, CheckCircle2, Gauge, CalendarDays, Building2, ClipboardList, ArrowRight, Sparkles, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { OpenIssuesSection } from "@/components/today/OpenIssuesSection";
import { cn } from "@/lib/utils";

const DOT: Record<DayState, string> = {
  green: "bg-emerald-500/70", amber: "bg-amber-500/80", red: "bg-red-500/80", empty: "bg-muted/50",
};

export default function Today() {
  const { data, isLoading } = useTodayData();
  const { data: cleans = [], isLoading: cleansLoading } = useTodayCleans();
  const progress = useTodayCleaningProgress();
  const { data: attn } = useCleaningAttention(14);
  const today = new Date();

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">Today</h1>
            <p className="text-sm text-muted-foreground mt-1">{format(today, "EEEE, d MMMM yyyy")}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatChip label="Checkouts" value={isLoading ? "–" : String(data?.checkoutsToday ?? 0)} icon={<LogOut className="h-3.5 w-3.5" />} />
            <StatChip label="Check-ins" value={isLoading ? "–" : String(data?.checkinsToday ?? 0)} icon={<LogIn className="h-3.5 w-3.5" />} />
            {progress.total > 0 && (
              <Link to="/operations/schedule">
                <StatChip label="Cleans" value={`${progress.completed}/${progress.total}`} icon={<SprayCan className="h-3.5 w-3.5" />} alert={progress.completed < progress.total} />
              </Link>
            )}
          </div>
        </div>

        {/* Needs attention — the command centre */}
        <section className="glass-card rounded-xl border border-border/30 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/20 flex items-center justify-between">
            <h2 className="text-sm font-display font-semibold text-foreground uppercase tracking-wider">Needs attention</h2>
            <Link to="/operations/traffic" className="text-[11px] font-medium text-primary inline-flex items-center gap-1 hover:opacity-80">Cleaning Traffic <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <div className="divide-y divide-border/15">
            {attn && attn.unassignedTotal > 0 && (
              <AlertRow tone="red" to="/operations/schedule"
                text={<><b>{attn.unassignedTotal}</b> clean{attn.unassignedTotal === 1 ? "" : "s"} unassigned in the next 2 weeks{attn.unassignedToday > 0 ? ` — ${attn.unassignedToday} today` : ""}.</>}
                cta="Assign" />
            )}
            {attn && attn.redDays > 0 && (
              <AlertRow tone="red" to="/operations/traffic"
                text={<><b>{attn.redDays}</b> day{attn.redDays === 1 ? "" : "s"} over capacity ahead (unassigned cleans).</>} cta="View" />
            )}
            {attn && attn.redDays === 0 && attn.amberDays > 0 && (
              <AlertRow tone="amber" to="/operations/traffic"
                text={<><b>{attn.amberDays}</b> day{attn.amberDays === 1 ? "" : "s"} tight on capacity (over the ideal cap).</>} cta="View" />
            )}
            {attn && attn.unassignedTotal === 0 && attn.redDays === 0 && attn.amberDays === 0 && (
              <div className="flex items-center gap-2.5 px-5 py-3 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Cleaning capacity is clear for the next two weeks.
              </div>
            )}
          </div>
          {/* 14-day capacity strip */}
          {attn && (
            <Link to="/operations/traffic" className="flex items-end gap-1 px-5 py-3 border-t border-border/15 hover:bg-secondary/20 transition-colors">
              {attn.days.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${format(d.date, "EEE d")} — ${d.total} clean${d.total === 1 ? "" : "s"}${d.unassigned ? `, ${d.unassigned} unassigned` : d.over ? `, ${d.over} over` : ""}`}>
                  <span className={`h-6 w-full rounded ${DOT[d.state]}`} />
                  <span className="text-[9px] text-muted-foreground">{format(d.date, "EEEEE")}</span>
                </div>
              ))}
            </Link>
          )}
        </section>

        {/* Flagged cleaner issues — self-hides when there are none */}
        <OpenIssuesSection />

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Today's Cleans */}
            <TodayCleansSection cleans={cleans} isLoading={cleansLoading} progress={progress} />

            {/* Today's Movements */}
            <section className="glass-card rounded-xl border border-border/30 overflow-hidden">
              <div className="px-5 py-4 border-b border-border/20">
                <h2 className="text-sm font-display font-semibold text-foreground uppercase tracking-wider">Today's Movements</h2>
              </div>
              <div className="divide-y divide-border/20">
                {data?.movements.length === 0 && (
                  <div className="px-5 py-8 text-center text-muted-foreground text-sm">No check-ins or check-outs today.</div>
                )}
                {data?.movements.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors">
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${m.type === "checkout" ? "bg-destructive/10" : "bg-accent/10"}`}>
                      {m.type === "checkout" ? <LogOut className="h-3.5 w-3.5 text-destructive" /> : <LogIn className="h-3.5 w-3.5 text-accent" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground font-medium truncate">{m.propertyName}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.guestName}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 shrink-0 ${m.type === "checkout" ? "border-destructive/30 text-destructive" : "border-accent/30 text-accent"}`}>
                      {m.type === "checkout" ? "Checkout" : "Check-in"}
                    </Badge>
                    {data?.sameDayTurnarounds.has(m.listingId) && (
                      <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] px-2 py-0.5 shrink-0">Same-Day Turnaround</Badge>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Portfolio Pulse */}
            <section>
              <h2 className="text-sm font-display font-semibold text-foreground uppercase tracking-wider mb-4">Portfolio Pulse</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <PulseCard title="Revenue MTD" value={`£${(data?.revenueMTD ?? 0).toLocaleString()}`} icon={<PoundSterling className="h-4 w-4" />} />
                <PulseCard title="Occupancy This Week" value={`${data?.occupancyThisWeek ?? 0}%`} icon={<BarChart3 className="h-4 w-4" />} />
                <PulseCard title="Bookings Next 30 Days" value={String(data?.bookingsNext30 ?? 0)} icon={<CalendarCheck className="h-4 w-4" />} />
              </div>
            </section>

            {/* Jump to */}
            <section>
              <h2 className="text-sm font-display font-semibold text-foreground uppercase tracking-wider mb-4">Jump to</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <NavCard to="/operations/schedule" icon={<CalendarDays className="h-4 w-4" />} label="Schedule" />
                <NavCard to="/operations/traffic" icon={<Gauge className="h-4 w-4" />} label="Cleaning Traffic" />
                <NavCard to="/operations/audit" icon={<ClipboardList className="h-4 w-4" />} label="Cleaning Audit" />
                <NavCard to="/properties" icon={<Building2 className="h-4 w-4" />} label="Properties" />
                <NavCard to="/orin" icon={<Sparkles className="h-4 w-4" />} label="Orin" />
              </div>
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function AlertRow({ tone, text, cta, to }: { tone: "red" | "amber"; text: React.ReactNode; cta: string; to: string }) {
  const dot = tone === "red" ? "bg-red-500" : "bg-amber-500";
  return (
    <Link to={to} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors group">
      <span className={`h-2 w-2 rounded-full ${dot} shrink-0`} />
      <p className="text-sm text-foreground/90 flex-1">{text}</p>
      <span className="text-[11px] font-medium text-primary inline-flex items-center gap-1 shrink-0">{cta} <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" /></span>
    </Link>
  );
}

function NavCard({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="glass-card rounded-xl border border-border/30 px-4 py-3.5 flex items-center gap-2.5 hover:border-primary/50 hover:bg-primary/5 transition-colors">
      <span className="text-primary">{icon}</span>
      <span className="text-sm font-medium truncate">{label}</span>
    </Link>
  );
}

function priorityBadgeClass(level: number | null) {
  switch (level) {
    case 0: return "border-red-500/50 text-red-400 bg-red-500/10";
    case 1: return "border-amber-500/50 text-amber-400 bg-amber-500/10";
    case 2: return "border-yellow-500/40 text-yellow-300 bg-yellow-500/10";
    case 3: return "border-blue-500/40 text-blue-300 bg-blue-500/10";
    default: return "border-border/40 text-muted-foreground";
  }
}

function fmtTime(t: string | null) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return format(d, "h:mmaaa").replace("AM", "am").replace("PM", "pm");
}

function fmtTimestamp(ts: string | null) {
  if (!ts) return "";
  return format(new Date(ts), "h:mmaaa").replace("AM", "am").replace("PM", "pm");
}

function TodayCleansSection({
  cleans,
  isLoading,
  progress,
}: {
  cleans: import("@/hooks/useTodayCleans").TodayCleanRow[];
  isLoading: boolean;
  progress: { total: number; completed: number; unassigned: number };
}) {
  const outstanding = cleans.filter(c => c.status !== "completed");
  const done = cleans.filter(c => c.status === "completed");
  const fullyDone = progress.total > 0 && progress.completed >= progress.total;

  return (
    <section className="glass-card rounded-xl border border-border/30 overflow-hidden">
      <div className="px-5 py-4 border-b border-border/20 flex items-center justify-between">
        <h2 className="text-sm font-display font-semibold text-foreground uppercase tracking-wider">
          Today's Cleans
        </h2>
        {progress.total > 0 && (
          <span className={cn(
            "text-xs tabular-nums font-medium",
            fullyDone ? "text-green-400" : "text-amber-400"
          )}>
            {progress.completed} / {progress.total} complete
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="px-5 py-8 text-center text-muted-foreground text-sm">Loading…</div>
      ) : cleans.length === 0 ? (
        <div className="px-5 py-8 text-center text-muted-foreground text-sm">
          No cleans scheduled for today
        </div>
      ) : (
        <>
          <div className="divide-y divide-border/20">
            {outstanding.map((c) => {
              const isUnassigned = !c.assigned_cleaner_id;
              const isP0 = c.priority_level === 0;
              return (
                <div
                  key={c.id}
                  className={cn(
                    "flex items-center gap-3 px-5 py-3 border-l-2 transition-colors",
                    isP0 ? "border-l-red-500 bg-red-500/5"
                      : isUnassigned ? "border-l-amber-500 bg-amber-500/5"
                      : "border-l-transparent hover:bg-secondary/30"
                  )}
                >
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] px-1.5 py-0 shrink-0", priorityBadgeClass(c.priority_level))}
                  >
                    P{c.priority_level ?? "—"}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">{c.listing_name}</p>
                    <p className={cn(
                      "text-xs truncate flex items-center gap-1",
                      isUnassigned ? "text-amber-400" : "text-muted-foreground"
                    )}>
                      {isUnassigned && <AlertTriangle className="h-3 w-3" />}
                      {c.cleaner_name ?? "Unassigned"}
                    </p>
                  </div>
                  {c.checkout_time && (
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      out {fmtTime(c.checkout_time)}
                    </span>
                  )}
                  {c.is_same_day_turnaround && (
                    <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] px-2 py-0.5 shrink-0">
                      STO
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>

          {done.length > 0 && (
            <>
              <div className="px-5 py-2 border-t border-b border-border/20 bg-secondary/20">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Completed
                </span>
              </div>
              <div className="divide-y divide-border/10">
                {done.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-2.5 opacity-60">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-muted-foreground truncate">{c.listing_name}</p>
                      <p className="text-xs text-muted-foreground/70 truncate">
                        {c.cleaner_name ?? "Unassigned"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground/70 tabular-nums shrink-0">
                      {fmtTimestamp(c.completed_at)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
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
