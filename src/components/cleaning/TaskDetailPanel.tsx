import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CheckCircle2, Clock, Trash2, Save, Undo2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { getCleanerColor } from "@/lib/cleanerColors";
import type { MatrixCleaner, MatrixListing, MatrixReservation, MatrixTask } from "@/hooks/useMatrixSchedule";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: MatrixTask | null;
  listing: MatrixListing | null;
  cleaners: MatrixCleaner[];
  reservations: MatrixReservation[];
  onReassign: (taskId: string, cleanerId: string | null) => Promise<boolean>;
  onComplete: (taskId: string, listingId: string) => Promise<boolean>;
  onUndoComplete: (taskId: string, listingId: string) => Promise<boolean>;
  onRemove: (taskId: string) => Promise<boolean>;
  onSaveNotes: (taskId: string, notes: string) => Promise<boolean>;
}

function fmtTime(t: string | null | undefined, fallback = "—"): string {
  if (!t) return fallback;
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : fallback;
}

function timeDiffMinutes(start: string, end: string): number | null {
  const sm = start.match(/^(\d{1,2}):(\d{2})/);
  const em = end.match(/^(\d{1,2}):(\d{2})/);
  if (!sm || !em) return null;
  return (Number(em[1]) * 60 + Number(em[2])) - (Number(sm[1]) * 60 + Number(sm[2]));
}

export function TaskDetailPanel({
  open, onOpenChange, task, listing, cleaners, reservations,
  onReassign, onComplete, onUndoComplete, onRemove, onSaveNotes,
}: Props) {
  const [notes, setNotes] = useState("");
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setNotes(task?.notes ?? "");
  }, [task?.id, task?.notes]);

  if (!task || !listing) return null;

  const checkoutRes = reservations.find(r => r.id === task.reservation_id);
  const nextCheckin = reservations
    .filter(r => r.listing_id === task.listing_id && r.check_in >= task.scheduled_date && r.id !== task.reservation_id)
    .sort((a, b) => a.check_in.localeCompare(b.check_in))[0];

  const checkoutTime = fmtTime(task.checkout_time ?? checkoutRes?.check_out_time ?? listing.default_check_out_time, "10:00");
  const sameDay = nextCheckin?.check_in === task.scheduled_date;
  const checkinTime = sameDay
    ? fmtTime(task.checkin_time ?? nextCheckin?.check_in_time ?? listing.default_check_in_time, "15:00")
    : null;

  const windowMins = sameDay && checkinTime ? timeDiffMinutes(checkoutTime, checkinTime) : null;
  const windowLabel = windowMins != null
    ? `${Math.floor(windowMins / 60)}h ${windowMins % 60}m window`
    : "No same-day check-in";

  const guestFirstName = checkoutRes?.guest_name?.split(/\s+/)[0] ?? "—";
  const nights = checkoutRes
    ? Math.round((new Date(checkoutRes.check_out).getTime() - new Date(checkoutRes.check_in).getTime()) / 86400000)
    : null;

  const assignedCleaner = task.assigned_cleaner_id
    ? cleaners.find(c => c.id === task.assigned_cleaner_id)
    : null;
  const color = getCleanerColor(task.assigned_cleaner_id, assignedCleaner?.name);

  const statusBadge = (() => {
    if (task.status === "completed") return { label: "Completed", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
    if (task.status === "unassigned" || !task.assigned_cleaner_id) return { label: "Unassigned", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
    return { label: "Assigned", className: "bg-primary/15 text-primary border-primary/30" };
  })();

  const handleReassign = async (val: string) => {
    setBusy(true);
    await onReassign(task.id, val === "unassigned" ? null : val);
    setBusy(false);
  };

  const handleComplete = async () => {
    setBusy(true);
    const ok = await onComplete(task.id, task.listing_id);
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  const handleUndoComplete = async () => {
    setBusy(true);
    const ok = await onUndoComplete(task.id, task.listing_id);
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  const handleRemove = async () => {
    setBusy(true);
    const ok = await onRemove(task.id);
    setBusy(false);
    setShowRemoveConfirm(false);
    if (ok) onOpenChange(false);
  };

  const handleSaveNotes = async () => {
    setBusy(true);
    await onSaveNotes(task.id, notes);
    setBusy(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <SheetTitle className="text-xl font-display text-foreground">{listing.name}</SheetTitle>
              <Badge variant="outline" className={statusBadge.className}>{statusBadge.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {format(parseISO(task.scheduled_date), "EEEE d MMMM yyyy")}
            </p>
            {task.source === "manual" && (
              <Badge variant="outline" className="bg-purple-500/15 text-purple-300 border-purple-500/30 w-fit text-[10px]">
                Manual · {task.task_type}
              </Badge>
            )}
          </SheetHeader>

          <div className="mt-6 space-y-5">
            {/* Times */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/30 bg-secondary/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Checkout</p>
                <p className="text-lg font-display font-semibold text-foreground tabular-nums mt-0.5">{checkoutTime}</p>
              </div>
              <div className="rounded-lg border border-border/30 bg-secondary/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Next check-in</p>
                <p className="text-lg font-display font-semibold text-foreground tabular-nums mt-0.5">
                  {checkinTime ?? "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{windowLabel}</span>
              {sameDay && (
                <Badge variant="outline" className="bg-red-500/15 text-red-300 border-red-500/30 ml-2 text-[10px]">
                  ↺ Same-day turnaround
                </Badge>
              )}
            </div>

            {/* Reservation info */}
            {checkoutRes && (
              <div className="rounded-lg border border-border/30 bg-card/50 p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Guest</span>
                  <span className="text-foreground font-medium">{guestFirstName}</span>
                </div>
                {nights != null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Stay length</span>
                    <span className="text-foreground font-medium">{nights} night{nights === 1 ? "" : "s"}</span>
                  </div>
                )}
              </div>
            )}

            {/* Reassignment */}
            <div>
              <Label className="text-xs">Assigned cleaner</Label>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: color.hex }}
                  aria-hidden
                />
                <Select
                  value={task.assigned_cleaner_id ?? "unassigned"}
                  onValueChange={handleReassign}
                  disabled={busy || task.status === "completed"}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {cleaners.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="task-notes" className="text-xs">Notes</Label>
              <Textarea
                id="task-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Manager notes for this task…"
                rows={3}
                className="mt-1"
              />
              <Button
                size="sm" variant="outline" onClick={handleSaveNotes}
                disabled={busy || notes === (task.notes ?? "")}
                className="mt-2 h-7 text-xs"
              >
                <Save className="h-3 w-3 mr-1" /> Save note
              </Button>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-2 border-t border-border/30">
              {task.status !== "completed" ? (
                <Button onClick={handleComplete} disabled={busy} className="w-full">
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> Mark complete
                </Button>
              ) : (
                <Button onClick={handleUndoComplete} disabled={busy} variant="secondary" className="w-full">
                  <Undo2 className="h-4 w-4 mr-1.5" /> Undo complete
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setShowRemoveConfirm(true)}
                disabled={busy}
                className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1.5" /> Remove this clean
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove cleaning task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will not cancel the reservation. The cleaning task will be deleted and can be regenerated from the schedule if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} disabled={busy} className="bg-destructive hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
