import { AppLayout } from "@/components/layout/AppLayout";
import { useCleaningSchedule, CleanTask, CleanerDay, Priority } from "@/hooks/useCleaningSchedule";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import {
  ChevronLeft, ChevronRight, RefreshCw, Calendar, CheckCircle2,
  Clock, MapPin, AlertTriangle, ChevronDown, User, Loader2,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { MatrixView } from "@/components/cleaning/MatrixView";
import { useRole } from "@/contexts/AuthContext";

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; icon: string }> = {
  TIGHT_WINDOW: { label: "TIGHT WINDOW", color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: "🟡" },
  SAME_DAY: { label: "SAME-DAY TURNAROUND", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: "🔴" },
  STANDARD: { label: "STANDARD", color: "bg-muted text-muted-foreground border-border/30", icon: "⚪" },
};

export default function CleaningSchedule() {
  const { hasRole } = useRole();
  const isManager = hasRole("super", "senior", "admin");

  const {
    selectedDate, setSelectedDate, viewMode, setViewMode,
    filterCleaner, setFilterCleaner, filterLocation, setFilterLocation,
    cleanerDays, unassigned, weekSummary,
    cleaners, locationGroups, totalTasks,
    regenerate, regenerateRange, completeTask, goBack, goForward, isToday, isRegenerating,
    buildDaySchedule,
  } = useCleaningSchedule();

  // Default managers to Matrix view on first load
  const [defaulted, setDefaulted] = useState(false);
  useEffect(() => {
    if (defaulted) return;
    if (isManager) setViewMode("matrix" as any);
    setDefaulted(true);
  }, [isManager, defaulted, setViewMode]);

  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  // Week-at-a-glance stats
  const weekStats = useMemo(() => {
    if (viewMode !== "week" || weekSummary.length === 0) return null;
    const totalCleans = weekSummary.reduce((s, d) => s + d.totalCleans, 0);
    const totalMinutes = weekSummary.reduce((s, d) => s + d.totalMinutes, 0);
    const busiest = weekSummary.reduce((best, d) => d.totalCleans > best.totalCleans ? d : best, weekSummary[0]);
    // Count unassigned across the week
    const ws = startOfWeek(selectedDate, { weekStartsOn: 1 });
    let unassignedCount = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      const { unassigned: u } = buildDaySchedule(d);
      unassignedCount += u.length;
    }
    return {
      totalCleans,
      totalHours: Math.floor(totalMinutes / 60),
      totalMins: totalMinutes % 60,
      busiestDay: busiest.dayLabel,
      busiestCleans: busiest.totalCleans,
      unassignedCount,
    };
  }, [viewMode, weekSummary, selectedDate, buildDaySchedule]);

  // Daily breakdown data for expanded view
  const weekDailyBreakdown = useMemo(() => {
    if (viewMode !== "week") return [];
    const ws = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return weekSummary.map((day, i) => {
      const d = addDays(ws, i);
      const { tasks, cleanerDays: cds } = buildDaySchedule(d);
      return {
        ...day,
        date_obj: d,
        cleanerNames: cds.map(cd => ({ name: cd.name, initial: cd.name.charAt(0) })),
        tasks: tasks.map(t => ({
          propertyName: t.propertyName,
          cleanerName: t.assignedCleanerName ?? "Unassigned",
          time: t.estimatedStart ?? "—",
        })),
      };
    });
  }, [viewMode, weekSummary, selectedDate, buildDaySchedule]);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight font-display">
              Schedule
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {totalTasks} clean{totalTasks !== 1 ? "s" : ""} · {format(selectedDate, "EEEE d MMMM yyyy")}
            </p>
          </div>
          {(() => {
            const isWeekScope = viewMode === "week" || (viewMode as any) === "matrix";
            const handleClick = () => isWeekScope ? regenerateRange(7) : regenerate();
            const label = isRegenerating
              ? "Generating..."
              : isWeekScope
                ? "Regenerate Week"
                : "Regenerate";
            return (
              <Button
                size="sm" variant="outline"
                onClick={handleClick}
                disabled={isRegenerating}
                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                title={isWeekScope ? "Regenerate cleans across the visible 7-day week" : "Regenerate cleans for this day"}
              >
                {isRegenerating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                {label}
              </Button>
            );
          })()}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-secondary/50 rounded-lg border border-border/30 p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={() => setSelectedDate(new Date())}
              className="px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary rounded-md transition-colors"
            >
              {isToday ? "Today" : format(selectedDate, "d MMM")}
            </button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goForward}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {!isToday && (
            <button
              onClick={() => setSelectedDate(new Date())}
              className="text-xs text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
            >
              Back to Today
            </button>
          )}

          <div className="flex items-center gap-1 bg-secondary/50 rounded-lg border border-border/30 p-1">
            <button
              onClick={() => setViewMode("day")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === "day" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === "week" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode("matrix" as any)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${(viewMode as any) === "matrix" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Matrix
            </button>
          </div>


          {/* Day-view-only filters (Matrix view has its own colour-coded chip filters) */}
          {viewMode === "day" && (
            <>
              <Select value={filterCleaner} onValueChange={setFilterCleaner}>
                <SelectTrigger className="w-40 h-9 text-xs bg-secondary/50 border-border/30">
                  <User className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="All Cleaners" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cleaners</SelectItem>
                  {cleaners.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger className="w-44 h-9 text-xs bg-secondary/50 border-border/30">
                  <MapPin className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locationGroups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </>
          )}
        </div>

        {/* Matrix View */}
        {(viewMode as any) === "matrix" && (
          <MatrixView initialDate={selectedDate} />
        )}

        {/* Week View */}
        {viewMode === "week" && (
          <div className="space-y-6">
            {/* Week grid */}
            <div className="grid grid-cols-7 gap-2">
              {weekSummary.map(day => {
                const isSelected = day.date === format(selectedDate, "yyyy-MM-dd");
                const isTodayDay = day.date === format(new Date(), "yyyy-MM-dd");
                return (
                  <button
                    key={day.date}
                    onClick={() => { setSelectedDate(new Date(day.date + "T12:00:00")); setViewMode("day"); }}
                    className={`glass-card rounded-xl border p-4 text-center transition-all hover:border-primary/40 ${
                      isSelected ? "border-primary/60 bg-primary/5" : "border-border/30"
                    }`}
                  >
                    <p className={`text-xs font-medium mb-1 ${isTodayDay ? "text-primary" : "text-muted-foreground"}`}>
                      {day.dayLabel}
                    </p>
                    <p className="text-2xl font-display font-bold text-foreground">{day.totalCleans}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {Math.round(day.totalMinutes / 60)}h {day.totalMinutes % 60}m
                    </p>
                  </button>
                );
              })}
            </div>

            {/* This Week at a Glance */}
            {weekStats && (
              <div>
                <h3 className="text-sm font-display font-semibold text-foreground uppercase tracking-wider mb-3">
                  This Week at a Glance
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="border-border/30 bg-card/50">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-display font-bold text-foreground">{weekStats.totalCleans}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Total cleans</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/30 bg-card/50">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-display font-bold text-foreground">
                        {weekStats.totalHours}h {weekStats.totalMins}m
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">Total cleaner hours</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/30 bg-card/50">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-display font-bold text-foreground">{weekStats.busiestDay}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Busiest day ({weekStats.busiestCleans} cleans)</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/30 bg-card/50">
                    <CardContent className="p-4 text-center">
                      <p className={`text-2xl font-display font-bold ${weekStats.unassignedCount > 0 ? "text-destructive" : "text-foreground"}`}>
                        {weekStats.unassignedCount}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">Unassigned this week</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Daily Breakdown */}
            <div>
              <h3 className="text-sm font-display font-semibold text-foreground uppercase tracking-wider mb-3">
                Daily Breakdown
              </h3>
              <div className="space-y-2">
                {weekDailyBreakdown.map(day => (
                  <Collapsible
                    key={day.date}
                    open={expandedDays[day.date] ?? false}
                    onOpenChange={open => setExpandedDays(prev => ({ ...prev, [day.date]: open }))}
                  >
                    <CollapsibleTrigger asChild>
                      <button className="w-full glass-card rounded-xl border border-border/30 p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="text-left">
                            <p className="text-sm font-display font-semibold text-foreground">
                              {format(day.date_obj, "EEEE")}
                              <span className="text-muted-foreground font-normal ml-1.5">{format(day.date_obj, "d MMM")}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {day.totalCleans} clean{day.totalCleans !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Cleaner avatars */}
                          <div className="flex -space-x-1.5">
                            {day.cleanerNames.slice(0, 4).map((cn, i) => (
                              <div
                                key={i}
                                className="h-6 w-6 rounded-full bg-primary/15 border border-background flex items-center justify-center"
                                title={cn.name}
                              >
                                <span className="text-[9px] font-bold text-primary">{cn.initial}</span>
                              </div>
                            ))}
                            {day.cleanerNames.length > 4 && (
                              <div className="h-6 w-6 rounded-full bg-secondary border border-background flex items-center justify-center">
                                <span className="text-[9px] text-muted-foreground">+{day.cleanerNames.length - 4}</span>
                              </div>
                            )}
                          </div>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedDays[day.date] ? "rotate-180" : ""}`} />
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-1">
                      <div className="ml-4 border-l-2 border-border/20 pl-4 space-y-1 py-2">
                        {day.tasks.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">No cleans scheduled</p>
                        ) : (
                          day.tasks.map((t, i) => (
                            <div key={i} className="flex items-center justify-between py-1.5 text-xs">
                              <span className="font-medium text-foreground">{t.propertyName}</span>
                              <div className="flex items-center gap-3 text-muted-foreground">
                                <span>{t.cleanerName}</span>
                                <span className="tabular-nums">{t.time}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Day View — Cleaner Sections */}
        {viewMode === "day" && (
          <div className="space-y-5">
            {cleanerDays.length === 0 && unassigned.length === 0 && (
              <Card className="border-border/30 bg-card/50 p-8 text-center">
                <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No checkouts scheduled for this date.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Click "Regenerate" to generate tasks from reservations.</p>
              </Card>
            )}

            {cleanerDays.map(cd => (
              <CleanerSection key={cd.id} cleanerDay={cd} cleaners={cleaners} onComplete={completeTask} />
            ))}
          </div>
        )}

        {/* Unassigned Tasks */}
        {unassigned.length > 0 && viewMode === "day" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <h3 className="text-sm font-display font-semibold text-red-400 uppercase tracking-wider">
                Unassigned ({unassigned.length})
              </h3>
            </div>
            <div className="border border-red-500/30 rounded-xl p-4 bg-red-500/5 space-y-3">
              {unassigned.map(task => (
                <TaskCard key={task.id} task={task} cleaners={cleaners} showReason />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

/* ── Cleaner Section ── */
function CleanerSection({ cleanerDay, cleaners, onComplete }: { cleanerDay: CleanerDay; cleaners: any[]; onComplete: (taskId: string, listingId: string) => void }) {
  const totalHours = Math.floor(cleanerDay.totalScheduledMinutes / 60);
  const totalMins = cleanerDay.totalScheduledMinutes % 60;
  const maxMinutes = cleanerDay.dailyWorkingHours * 60;
  const utilisation = maxMinutes > 0 ? (cleanerDay.totalScheduledMinutes / maxMinutes) * 100 : 0;
  const isHigh = utilisation >= 80;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-xs font-bold text-primary">{cleanerDay.name.charAt(0)}</span>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-display font-semibold text-foreground">{cleanerDay.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <p className={`text-[10px] ${isHigh ? "text-amber-400 font-semibold" : "text-muted-foreground"}`}>
              {totalHours}h {totalMins}m / {cleanerDay.dailyWorkingHours}h working day
            </p>
            <div className="w-20 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isHigh ? "bg-amber-400" : "bg-primary"}`}
                style={{ width: `${Math.min(100, utilisation)}%` }}
              />
            </div>
          </div>
        </div>
        <div className="ml-auto">
          <Badge variant="outline" className={`text-[10px] ${isHigh ? "border-amber-500/30 text-amber-400" : "border-primary/30 text-primary"}`}>
            {Math.round(utilisation)}% capacity
          </Badge>
        </div>
      </div>

      <div className="ml-4 border-l-2 border-border/20 pl-4 space-y-1">
        {(() => {
          const sorted = [...cleanerDay.tasks].sort((a, b) => (a.estimatedStart || "").localeCompare(b.estimatedStart || ""));
          return (
            <>
              {cleanerDay.homeToFirstMinutes != null && sorted.length > 0 && (
                <div className="flex items-center gap-1.5 py-1.5 text-[11px] text-muted-foreground/70">
                  <span>🏠 Home → {sorted[0].propertyName} · ~{cleanerDay.homeToFirstMinutes} min</span>
                </div>
              )}
              {sorted.map((task, idx) => (
                <div key={task.id}>
                  {idx > 0 && (
                    <div className="flex items-center gap-1.5 py-1 text-[10px] text-muted-foreground/60">
                      <div className="h-px flex-1 bg-border/20" />
                      <span>🚗 ~{task.travelMinutes ?? 0} min travel</span>
                      <div className="h-px flex-1 bg-border/20" />
                    </div>
                  )}
                  <TaskCard task={task} cleaners={cleaners} onComplete={onComplete} />
                </div>
              ))}
              {cleanerDay.lastToHomeMinutes != null && sorted.length > 0 && (
                <div className="flex items-center gap-1.5 py-1.5 text-[11px] text-muted-foreground/70">
                  <span>{sorted[sorted.length - 1].propertyName} → 🏠 Home · ~{cleanerDay.lastToHomeMinutes} min</span>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}

/* ── Task Card ── */
function TaskCard({ task, cleaners, showReason, onComplete }: { task: CleanTask; cleaners: any[]; showReason?: boolean; onComplete?: (taskId: string, listingId: string) => void }) {
  const pc = PRIORITY_CONFIG[task.priority];
  const isCompleted = task.status === "complete";

  return (
    <div className={`glass-card rounded-xl border border-border/30 p-4 space-y-2 hover:border-border/50 transition-colors ${isCompleted ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm">{pc.icon}</span>
            <h4 className="text-sm font-display font-semibold text-foreground">{task.propertyName}</h4>
            {isCompleted && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                ✓ Completed
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary px-1.5 py-0">
              {task.locationGroup}
            </Badge>
            {task.priority !== "STANDARD" && (
              <Badge className={`text-[10px] px-1.5 py-0 ${pc.color}`}>
                {pc.label}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {task.status === "scheduled" && task.dbTaskId && onComplete && (
            <Button
              size="sm" variant="outline"
              className="h-7 text-[10px] border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => onComplete(task.dbTaskId!, task.listingId)}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {task.estimatedStart && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {task.estimatedStart}
          </span>
        )}
        <span>⏱ {task.cleaningDuration} min</span>
        <span>🚪 CO {task.checkoutTime}</span>
        {task.nextCheckinDate && task.nextCheckinDate === task.checkoutDate && (
          <span>🔑 CI {task.nextCheckinTime || "15:00"}</span>
        )}
        {task.nextCheckinDate && task.nextCheckinDate !== task.checkoutDate && (
          <span className="text-muted-foreground/60">Next CI: {task.nextCheckinDate}</span>
        )}
      </div>

      {showReason && task.reason && (
        <p className="text-[10px] text-red-400 italic">{task.reason}</p>
      )}

      {task.status === "unassigned" && !task.dbTaskId && (
        <Select>
          <SelectTrigger className="w-40 h-7 text-[10px] bg-secondary/50 border-border/40">
            <SelectValue placeholder="Assign cleaner..." />
          </SelectTrigger>
          <SelectContent>
            {cleaners.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
