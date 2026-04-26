import { useMemo, useState, useCallback } from "react";
import { addDays, format, isSameDay, parseISO, startOfWeek } from "date-fns";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Plus, AlertTriangle, Loader2 } from "lucide-react";
import { useMatrixSchedule, type MatrixListing, type MatrixTask } from "@/hooks/useMatrixSchedule";
import {
  getCleanerColor,
  UNASSIGNED_COLOR,
  COMPLETED_COLOR,
  MANUAL_CLEAN_COLOR,
} from "@/lib/cleanerColors";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { AddManualCleanModal } from "./AddManualCleanModal";
import { shortenName } from "@/lib/shortenName";

interface Props {
  initialDate?: Date;
  weekAnchor?: Date;
  onWeekAnchorChange?: (d: Date) => void;
  hideWeekNav?: boolean;
}

export function MatrixView({ initialDate, weekAnchor: weekAnchorProp, onWeekAnchorChange, hideWeekNav }: Props) {
  const [weekAnchorInternal, setWeekAnchorInternal] = useState<Date>(() => initialDate ?? new Date());
  const weekAnchor = weekAnchorProp ?? weekAnchorInternal;
  const setWeekAnchor = (updater: Date | ((d: Date) => Date)) => {
    const next = typeof updater === "function" ? (updater as (d: Date) => Date)(weekAnchor) : updater;
    if (onWeekAnchorChange) onWeekAnchorChange(next);
    else setWeekAnchorInternal(next);
  };
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [addCleanCell, setAddCleanCell] = useState<{ listing: MatrixListing; date: Date } | null>(null);
  const [filterGroups, setFilterGroups] = useState<Set<string>>(new Set());
  const [filterCleaners, setFilterCleaners] = useState<Set<string>>(new Set()); // empty = all; "unassigned" = unassigned tasks
  const [showCompleted, setShowCompleted] = useState(true);
  const [activeDragTaskId, setActiveDragTaskId] = useState<string | null>(null);

  // Derive weekStart locally from weekAnchor so the header label is always in sync
  // with the navigation buttons (independent of any caching inside the data hook).
  const weekStart = useMemo(() => startOfWeek(weekAnchor, { weekStartsOn: 1 }), [weekAnchor]);

  const {
    days, groupedListings, listings,
    cleaners, tasks, reservations, isLoading,
    reassignTask, completeTask, undoComplete, removeTask, updateNotes, addManualClean,
  } = useMatrixSchedule(weekAnchor);

  // Index tasks by listing+date
  const taskGrid = useMemo(() => {
    const map = new Map<string, MatrixTask>();
    for (const t of tasks) map.set(`${t.listing_id}|${t.scheduled_date}`, t);
    return map;
  }, [tasks]);

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  // Filtering
  const isTaskVisible = useCallback((t: MatrixTask | undefined): boolean => {
    if (!t) return true; // empty cells always visible
    if (!showCompleted && t.status === "completed") return false;
    if (filterCleaners.size === 0) return true;
    if (filterCleaners.has("unassigned") && (!t.assigned_cleaner_id || t.status === "unassigned")) return true;
    if (t.assigned_cleaner_id && filterCleaners.has(t.assigned_cleaner_id)) return true;
    return false;
  }, [showCompleted, filterCleaners]);

  // When a cleaner filter is active, hide property rows that have no
  // matching tasks at all this week (so the matrix collapses instead of
  // showing a sea of empty rows).
  const cleanerFilterActive = filterCleaners.size > 0;
  const listingsWithVisibleTask = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) {
      if (isTaskVisible(t)) set.add(t.listing_id);
    }
    return set;
  }, [tasks, isTaskVisible]);

  const visibleGroups = useMemo(() => {
    let groups = filterGroups.size === 0 ? groupedListings : groupedListings.filter(([g]) => filterGroups.has(g));
    if (cleanerFilterActive) {
      groups = groups
        .map(([g, ls]) => [g, ls.filter(l => listingsWithVisibleTask.has(l.id))] as [string, MatrixListing[]])
        .filter(([, ls]) => ls.length > 0);
    }
    return groups;
  }, [groupedListings, filterGroups, cleanerFilterActive, listingsWithVisibleTask]);

  // Summary
  const summary = useMemo(() => {
    const visibleTasks = tasks.filter(isTaskVisible);
    const total = visibleTasks.length;
    const byCleaner: Record<string, number> = {};
    let unassigned = 0;
    for (const t of visibleTasks) {
      if (!t.assigned_cleaner_id || t.status === "unassigned") {
        unassigned++;
      } else {
        byCleaner[t.assigned_cleaner_id] = (byCleaner[t.assigned_cleaner_id] || 0) + 1;
      }
    }
    return { total, byCleaner, unassigned };
  }, [tasks, isTaskVisible]);

  const selectedTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : null;
  const selectedListing = selectedTask ? listings.find(l => l.id === selectedTask.listing_id) : null;

  // Week nav
  const goPrev = () => setWeekAnchor(d => addDays(startOfWeek(d, { weekStartsOn: 1 }), -7));
  const goNext = () => setWeekAnchor(d => addDays(startOfWeek(d, { weekStartsOn: 1 }), 7));
  const goThisWeek = () => setWeekAnchor(new Date());
  const isCurrentWeek = useMemo(
    () => isSameDay(weekStart, startOfWeek(new Date(), { weekStartsOn: 1 })),
    [weekStart]
  );


  // DnD
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragStart = (e: DragStartEvent) => {
    setActiveDragTaskId(String(e.active.id));
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveDragTaskId(null);
    const taskId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    if (!overId.startsWith("cleaner:")) return;
    const cleanerId = overId.slice("cleaner:".length);
    await reassignTask(taskId, cleanerId === "unassigned" ? null : cleanerId);
  };

  const toggleGroup = (g: string) => {
    setFilterGroups(prev => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  };

  const toggleCleanerFilter = (id: string) => {
    setFilterCleaners(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allLocationGroups = groupedListings.map(([g]) => g);
  const dragTask = activeDragTaskId ? tasks.find(t => t.id === activeDragTaskId) : null;

  return (
    <div className="space-y-4">
      {/* Week navigation (can be hidden when parent renders it inline with view-mode toggle) */}
      {!hideWeekNav && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goPrev} className="h-9 w-9">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant={isCurrentWeek ? "default" : "outline"}
              size="sm"
              onClick={goThisWeek}
              className="h-9"
              disabled={isCurrentWeek}
            >
              Current Week
            </Button>
            <Button variant="outline" size="icon" onClick={goNext} className="h-9 w-9">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span key={format(weekStart, "yyyy-MM-dd")} className="ml-2 text-sm font-medium text-foreground tabular-nums">
              {format(weekStart, "d MMM")} – {format(addDays(weekStart, 6), "d MMM yyyy")}
            </span>
            {!isCurrentWeek && (
              <button
                onClick={goThisWeek}
                className="ml-2 text-xs text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
              >
                Back to Current Week
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Locations:</span>
          <button
            onClick={() => setFilterGroups(new Set())}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              filterGroups.size === 0
                ? "bg-primary/15 border-primary/40 text-primary"
                : "border-border/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {allLocationGroups.map(g => (
            <button
              key={g}
              onClick={() => toggleGroup(g)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                filterGroups.has(g)
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "border-border/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Cleaners:</span>
          <button
            onClick={() => setFilterCleaners(new Set())}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              filterCleaners.size === 0
                ? "bg-primary/15 border-primary/40 text-primary"
                : "border-border/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {cleaners.map(c => {
            const color = getCleanerColor(c.id, c.name, c.color);
            const active = filterCleaners.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCleanerFilter(c.id)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors flex items-center gap-1.5 ${
                  active ? "border-primary/40 text-foreground" : "border-border/40 text-muted-foreground hover:text-foreground"
                }`}
                style={active ? { backgroundColor: color.bg } : undefined}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color.hex }} />
                {c.name}
              </button>
            );
          })}
          <button
            onClick={() => toggleCleanerFilter("unassigned")}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors flex items-center gap-1.5 ${
              filterCleaners.has("unassigned")
                ? "border-amber-500/40 text-amber-300 bg-amber-500/10"
                : "border-border/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: UNASSIGNED_COLOR.hex }} />
            Unassigned
          </button>
          <label className="ml-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border/40"
            />
            Show completed
          </label>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Cleaner assignment strip */}
        <Card className="border-border/40 bg-card/50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">
              Drop tasks here to reassign:
            </span>
            {cleaners.map(c => (
              <CleanerDropTarget
                key={c.id}
                id={`cleaner:${c.id}`}
                name={c.name}
                count={summary.byCleaner[c.id] || 0}
                color={getCleanerColor(c.id, c.name, c.color)}
                isDragging={!!activeDragTaskId}
              />
            ))}
            <CleanerDropTarget
              id="cleaner:unassigned"
              name="Unassigned"
              count={summary.unassigned}
              color={UNASSIGNED_COLOR}
              isDragging={!!activeDragTaskId}
              warn={summary.unassigned > 0}
            />
          </div>
        </Card>

        {/* Summary bar */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground px-1">
          <span>
            Week of {format(weekStart, "d MMM")}: <span className="font-semibold text-foreground tabular-nums">{summary.total}</span> cleans total
          </span>
          {cleaners.map(c => {
            const count = summary.byCleaner[c.id] || 0;
            if (count === 0) return null;
            return (
              <span key={c.id}>
                {c.name}: <span className="font-semibold text-foreground tabular-nums">{count}</span>
              </span>
            );
          })}
          {summary.unassigned > 0 && (
            <button
              onClick={() => setFilterCleaners(new Set(["unassigned"]))}
              className="text-amber-400 font-semibold hover:underline"
            >
              Unassigned: {summary.unassigned}
            </button>
          )}
        </div>

        {/* Mobile banner */}
        <div className="md:hidden rounded-lg border border-border/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300">
          For full matrix view, use a desktop or tablet.
        </div>

        {/* Matrix */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="border border-border/30 rounded-xl overflow-hidden bg-card/30">
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                {/* Header row */}
                <div className="grid grid-cols-[200px_repeat(7,minmax(110px,1fr))] sticky top-0 z-20 bg-card/95 backdrop-blur border-b border-border/40">
                  <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-r border-border/30">
                    Property
                  </div>
                  {days.map(d => {
                    const isTodayCol = isSameDay(d, today);
                    return (
                      <div
                        key={d.toISOString()}
                        className={`px-3 py-2 text-center text-[11px] font-medium border-r border-border/20 last:border-r-0 ${
                          isTodayCol ? "bg-amber-500/10 text-amber-300" : "text-muted-foreground"
                        }`}
                      >
                        <div>{format(d, "EEE")}</div>
                        <div className="text-foreground tabular-nums text-sm font-display font-semibold mt-0.5">
                          {format(d, "d")}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Body */}
                {visibleGroups.map(([groupName, groupListings]) => (
                  <div key={groupName}>
                    {/* Group divider */}
                    <div className="grid grid-cols-[200px_repeat(7,minmax(110px,1fr))] bg-secondary/40 border-b border-border/30">
                      <div className="col-span-8 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                        {groupName} <span className="font-normal text-muted-foreground/70">({groupListings.length} {groupListings.length === 1 ? "property" : "properties"})</span>
                      </div>
                    </div>

                    {groupListings.map(listing => (
                      <div
                        key={listing.id}
                        className="grid grid-cols-[200px_repeat(7,minmax(110px,1fr))] border-b border-border/20 hover:bg-secondary/10 transition-colors min-h-[56px]"
                      >
                        {/* Property name (sticky col) */}
                        <div className="px-3 py-2 border-r border-border/30 sticky left-0 bg-card/80 backdrop-blur-sm z-10 flex flex-col justify-center">
                          <p
                            className="text-xs font-medium text-foreground leading-tight truncate"
                            title={listing.name}
                          >
                            {shortenName(listing.name)}
                          </p>
                          {listing.location_group && (
                            <span className="text-[9px] text-muted-foreground/70 mt-0.5">{listing.location_group}</span>
                          )}
                        </div>

                        {days.map(d => {
                          const ds = format(d, "yyyy-MM-dd");
                          const rawTask = taskGrid.get(`${listing.id}|${ds}`);
                          const isTodayCol = isSameDay(d, today);
                          const visible = isTaskVisible(rawTask);
                          // Hide filtered-out tasks entirely (render as empty cell)
                          const task = visible ? rawTask : undefined;

                          return (
                            <MatrixCell
                              key={ds}
                              date={d}
                              listing={listing}
                              task={task}
                              cleaners={cleaners}
                              isToday={isTodayCol}
                              dimmed={false}
                              onTaskClick={(id) => setSelectedTaskId(id)}
                              onAddClick={() => setAddCleanCell({ listing, date: d })}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DragOverlay>
          {dragTask ? (
            <div
              className="rounded-md px-2 py-1.5 text-[11px] font-medium border shadow-lg"
              style={{
                backgroundColor: getCleanerColor(dragTask.assigned_cleaner_id, cleaners.find(c => c.id === dragTask.assigned_cleaner_id)?.name, cleaners.find(c => c.id === dragTask.assigned_cleaner_id)?.color).bg,
                borderColor: getCleanerColor(dragTask.assigned_cleaner_id, cleaners.find(c => c.id === dragTask.assigned_cleaner_id)?.name, cleaners.find(c => c.id === dragTask.assigned_cleaner_id)?.color).border,
                color: getCleanerColor(dragTask.assigned_cleaner_id, cleaners.find(c => c.id === dragTask.assigned_cleaner_id)?.name, cleaners.find(c => c.id === dragTask.assigned_cleaner_id)?.color).text,
              }}
            >
              {listings.find(l => l.id === dragTask.listing_id)?.name ?? "Task"}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskDetailPanel
        open={!!selectedTaskId}
        onOpenChange={(o) => !o && setSelectedTaskId(null)}
        task={selectedTask ?? null}
        listing={selectedListing ?? null}
        cleaners={cleaners}
        reservations={reservations}
        onReassign={reassignTask}
        onComplete={completeTask}
        onUndoComplete={undoComplete}
        onRemove={removeTask}
        onSaveNotes={updateNotes}
      />

      <AddManualCleanModal
        open={!!addCleanCell}
        onOpenChange={(o) => !o && setAddCleanCell(null)}
        listing={addCleanCell?.listing ?? null}
        date={addCleanCell?.date ?? null}
        cleaners={cleaners}
        onSubmit={addManualClean}
      />
    </div>
  );
}

/* ── Cleaner drop target chip ── */
function CleanerDropTarget({
  id, name, count, color, isDragging, warn,
}: {
  id: string;
  name: string;
  count: number;
  color: { hex: string; bg: string; border: string; text: string };
  isDragging: boolean;
  warn?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-all ${
        isOver ? "scale-105 shadow-md" : ""
      } ${isDragging ? "ring-1 ring-border/50" : ""}`}
      style={{
        backgroundColor: isOver ? color.bg : "transparent",
        borderColor: isOver ? color.hex : color.border,
        color: warn ? "#fcd34d" : "inherit",
      }}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color.hex }} />
      <span className="font-medium">{name}</span>
      <span className="tabular-nums text-muted-foreground">({count})</span>
    </div>
  );
}

/* ── Single matrix cell ── */
function MatrixCell({
  date, listing, task, cleaners, isToday, dimmed, onTaskClick, onAddClick,
}: {
  date: Date;
  listing: MatrixListing;
  task: MatrixTask | undefined;
  cleaners: { id: string; name: string; location_groups?: string[] }[];
  isToday: boolean;
  dimmed: boolean;
  onTaskClick: (id: string) => void;
  onAddClick: () => void;
}) {
  const baseBorder = "border-r border-border/20 last:border-r-0";
  const todayTint = isToday ? "bg-amber-500/[0.04]" : "";
  const dimClass = dimmed ? "opacity-25" : "";

  if (!task) {
    return (
      <button
        onClick={onAddClick}
        className={`group ${baseBorder} ${todayTint} flex items-center justify-center text-muted-foreground/0 hover:text-muted-foreground hover:bg-secondary/30 transition-colors min-h-[56px]`}
        aria-label={`Add manual clean for ${listing.name} on ${format(date, "EEE d MMM")}`}
      >
        <Plus className="h-4 w-4 opacity-0 group-hover:opacity-60 transition-opacity" />
      </button>
    );
  }

  // For unassigned tasks, compute the "why" tooltip
  const isUnassigned = !task.assigned_cleaner_id || task.status === "unassigned";
  let unassignedReason: string | null = null;
  if (isUnassigned) {
    const group = listing.location_group || "Other";
    const eligible = cleaners.filter(c => (c.location_groups || []).includes(group));
    if (eligible.length === 0) {
      unassignedReason = `No active cleaner covers "${group}". Add it to a cleaner's coverage in Settings → Cleaners, or drag this task onto a cleaner above.`;
    } else {
      unassignedReason = `Eligible cleaners (${eligible.map(c => c.name).join(", ")}) appear to be at capacity for this day. Drag this task onto a cleaner above to assign manually.`;
    }
  }

  const cell = (
    <div className={`${baseBorder} ${todayTint} ${dimClass} p-1`}>
      <DraggableCellInner task={task} cleaners={cleaners} onClick={() => onTaskClick(task.id)} />
    </div>
  );

  if (unassignedReason) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>{cell}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            {unassignedReason}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return cell;
}

function DraggableCellInner({
  task, cleaners, onClick,
}: {
  task: MatrixTask;
  cleaners: { id: string; name: string; color?: string | null }[];
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });

  const cleaner = task.assigned_cleaner_id ? cleaners.find(c => c.id === task.assigned_cleaner_id) : null;
  const isCompleted = task.status === "completed";
  const isUnassigned = !task.assigned_cleaner_id || task.status === "unassigned";
  const isManual = task.source === "manual";

  const color = isCompleted
    ? COMPLETED_COLOR
    : isUnassigned
    ? UNASSIGNED_COLOR
    : isManual
    ? MANUAL_CLEAN_COLOR
    : getCleanerColor(task.assigned_cleaner_id, cleaner?.name, cleaner?.color);

  const checkout = task.checkout_time ? task.checkout_time.slice(0, 5) : null;
  const initial = cleaner?.name?.charAt(0).toUpperCase() ?? "?";

  const isSameDayTA = !!task.is_same_day_turnaround;

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      {...listeners}
      {...attributes}
      className={`w-full h-full min-h-[48px] rounded-md p-1.5 text-left transition-all hover:shadow-sm ${
        isDragging ? "opacity-30" : ""
      } ${isCompleted ? "opacity-90" : ""} ${
        isSameDayTA
          ? "border-[2.5px] border-red-500 ring-1 ring-white shadow-[0_0_0_1px_rgba(255,255,255,0.9)]"
          : "border"
      }`}
      style={{
        backgroundColor: color.bg,
        borderColor: isSameDayTA ? "#ef4444" : color.border,
        color: color.text,
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1 min-w-0">
          {isCompleted ? (
            <span className="text-[11px] font-bold">✓</span>
          ) : isUnassigned ? (
            <AlertTriangle className="h-3 w-3 shrink-0" />
          ) : (
            <span
              className="h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
              style={{ backgroundColor: color.initialBg }}
            >
              {initial}
            </span>
          )}
          {checkout && !isUnassigned && (
            <span className="text-[10px] tabular-nums truncate">{checkout}</span>
          )}
        </div>
        {isSameDayTA && (
          <span
            className="text-[9px] font-bold px-1 rounded bg-red-500 text-white tracking-wide"
            title="Same-day turnaround"
          >
            STO
          </span>
        )}
      </div>
      {isUnassigned && (
        <div className="text-[9px] mt-0.5 leading-tight">
          Unassigned
          {checkout && <span className="block tabular-nums opacity-80">{checkout} out</span>}
        </div>
      )}
      {isManual && !isUnassigned && (
        <div className="text-[9px] mt-0.5 opacity-80 capitalize truncate">{task.task_type}</div>
      )}
    </button>
  );
}
