import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CheckCircle2, Clock, Trash2, Save, Undo2, X, Loader2, Check, Ban, PackageCheck, Flag } from "lucide-react";
import { format, parseISO } from "date-fns";
import { getCleanerColor } from "@/lib/cleanerColors";
import type { MatrixCleaner, MatrixListing, MatrixReservation, MatrixTask, CleanerHolidayRow } from "@/hooks/useMatrixSchedule";
import { getUnavailabilityReason } from "@/lib/cleanerAvailability";
import { supabase } from "@/integrations/supabase/client";
import { parseCustomFields } from "@/lib/customFields";
import { RequestIcon } from "@/lib/requestIcon";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: MatrixTask | null;
  listing: MatrixListing | null;
  cleaners: MatrixCleaner[];
  reservations: MatrixReservation[];
  holidays?: CleanerHolidayRow[];
  onReassign: (taskId: string, cleanerId: string | null, override?: { reason: string }) => Promise<boolean>;
  onComplete: (taskId: string, listingId: string) => Promise<boolean>;
  onUndoComplete: (taskId: string, listingId: string) => Promise<boolean>;
  onRemove: (taskId: string) => Promise<boolean>;
  onNotRequired: (taskId: string) => Promise<boolean>;
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
  open, onOpenChange, task, listing, cleaners, reservations, holidays = [],
  onReassign, onComplete, onUndoComplete, onRemove, onNotRequired, onSaveNotes,
}: Props) {
  const [notes, setNotes] = useState("");
  const [pendingCleanerId, setPendingCleanerId] = useState<string | null>(null);
  const [pendingUnavailReason, setPendingUnavailReason] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showNotRequiredConfirm, setShowNotRequiredConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);

  const flashSaved = () => { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 2000); };

  useEffect(() => {
    setNotes(task?.notes ?? "");
    setConfirmComplete(false);
    setSavedFlash(false);
  }, [task?.id, task?.notes]);

  // Requests (travel cot, high chair, …) for the guest ARRIVING after this clean —
  // a manager-side double-check that a request is in and flagged on the right turnover.
  const [requests, setRequests] = useState<{ name: string; icon: string | null; quantity: number }[]>([]);
  useEffect(() => {
    if (!open || !task) { setRequests([]); return; }
    const arrival = reservations
      .filter(r => r.listing_id === task.listing_id && r.check_in >= task.scheduled_date && r.id !== task.reservation_id)
      .sort((a, b) => a.check_in.localeCompare(b.check_in))[0];
    if (!arrival) { setRequests([]); return; }
    let cancelled = false;
    (async () => {
      const [reqRes, cfRes] = await Promise.all([
        supabase.from("booking_requests").select("quantity, requests(name, icon)").eq("reservation_id", arrival.id),
        supabase.from("reservations").select("custom_fields").eq("id", arrival.id).maybeSingle(),
      ]);
      if (cancelled) return;
      const list: { name: string; icon: string | null; quantity: number }[] = [];
      for (const row of (reqRes.data ?? []) as any[]) {
        list.push({ name: (row.requests as any)?.name ?? "Request", icon: (row.requests as any)?.icon ?? null, quantity: row.quantity ?? 1 });
      }
      const parsed = parseCustomFields((cfRes.data as any)?.custom_fields);
      for (const q of parsed.requests) {
        if (!list.some(x => x.name.toLowerCase() === q.label.toLowerCase())) {
          list.push({ name: q.label, icon: null, quantity: /^\d+$/.test(q.value) ? Number(q.value) : 1 });
        }
      }
      setRequests(list);
    })();
    return () => { cancelled = true; };
  }, [open, task?.id, reservations]);

  // Open (unresolved) issues flagged on THIS clean.
  const [issues, setIssues] = useState<{ id: string; issue_type: string; description: string; urgency: string; created_at: string; photo_paths: string[] | null }[]>([]);
  useEffect(() => {
    if (!open || !task) { setIssues([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("clean_issues")
        .select("id, issue_type, description, urgency, status, maintenance_stage, created_at, photo_paths")
        .eq("clean_task_id", task.id)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setIssues(((data ?? []) as any[]).filter((i) => i.status !== "resolved" && i.maintenance_stage !== "complete"));
    })();
    return () => { cancelled = true; };
  }, [open, task?.id]);

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
  const color = getCleanerColor(task.assigned_cleaner_id, assignedCleaner?.name, assignedCleaner?.color);

  const statusBadge = (() => {
    if (task.status === "completed") return { label: "Completed", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
    if (task.status === "unassigned" || !task.assigned_cleaner_id) return { label: "Unassigned", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
    return { label: "Assigned", className: "bg-primary/15 text-primary border-primary/30" };
  })();

  const handleReassign = async (val: string) => {
    if (val !== "unassigned") {
      const c = cleaners.find((x) => x.id === val);
      const holidaysForC = holidays.filter((h) => h.cleaner_id === val);
      const reason = getUnavailabilityReason(c, task.scheduled_date, holidaysForC);
      if (reason) {
        setPendingCleanerId(val);
        setPendingUnavailReason(reason);
        return;
      }
    }
    setBusy(true);
    await onReassign(task.id, val === "unassigned" ? null : val);
    setBusy(false);
    flashSaved();
  };

  const confirmReassign = async () => {
    if (!pendingCleanerId) return;
    setBusy(true);
    await onReassign(task.id, pendingCleanerId, { reason: `Override: ${pendingUnavailReason ?? "cleaner unavailable"}` });
    setBusy(false);
    setPendingCleanerId(null);
    setPendingUnavailReason(null);
    flashSaved();
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

  const handleNotRequired = async () => {
    setBusy(true);
    const ok = await onNotRequired(task.id);
    setBusy(false);
    setShowNotRequiredConfirm(false);
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
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <Badge variant="outline" className={statusBadge.className}>{statusBadge.label}</Badge>
                {task.status !== "completed" ? (
                  !confirmComplete ? (
                    <Button
                      size="sm" variant="ghost" onClick={() => setConfirmComplete(true)} disabled={busy}
                      className="h-6 px-2 text-[11px] text-muted-foreground hover:text-emerald-400"
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Mark complete
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm" onClick={handleComplete} disabled={busy}
                        className="h-6 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-600/90 text-white"
                      >
                        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3 mr-1" /> Confirm</>}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmComplete(false)} disabled={busy} className="h-6 px-1.5">
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )
                ) : (
                  <Button
                    size="sm" variant="ghost" onClick={handleUndoComplete} disabled={busy}
                    className="h-6 px-2 text-[11px] text-muted-foreground"
                  >
                    <Undo2 className="h-3 w-3 mr-1" /> Undo complete
                  </Button>
                )}
              </div>
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

            {/* Open issues flagged on this clean. */}
            {issues.length > 0 && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-red-600 dark:text-red-300 font-semibold">
                  <Flag className="h-3.5 w-3.5" /> {issues.length} issue{issues.length === 1 ? "" : "s"} flagged
                </div>
                {issues.map((iss) => (
                  <div key={iss.id} className="rounded-md bg-background/40 border border-red-500/20 p-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">{iss.issue_type}</span>
                      {iss.urgency === "urgent" && (
                        <Badge variant="outline" className="bg-red-600/15 text-red-400 border-red-600/40 text-[9px]">URGENT</Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">{format(parseISO(iss.created_at), "d MMM, HH:mm")}</span>
                    </div>
                    <p className="text-[13px] text-foreground/90 mt-1 whitespace-pre-wrap">{iss.description}</p>
                    {iss.photo_paths && iss.photo_paths.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-1">📷 {iss.photo_paths.length} photo{iss.photo_paths.length === 1 ? "" : "s"} — see Maintenance</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Guest requests for the ARRIVING guest — must be left in the property
                on this clean, before they check in. */}
            {requests.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-300 font-semibold mb-2">
                  <PackageCheck className="h-3.5 w-3.5" /> Leave for arriving guest
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {requests.map((r, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                      title={`${r.name} × ${r.quantity}`}
                    >
                      <RequestIcon icon={r.icon} className="h-3 w-3" />
                      {r.name}{r.quantity > 1 ? ` ×${r.quantity}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

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
              <div className="flex items-center justify-between">
                <Label className="text-xs">Assigned cleaner</Label>
                {savedFlash && (
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Saved
                  </span>
                )}
              </div>
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

            {/* Actions — completion lives up in the header (small, deliberate) so it
                can't be hit by accident when reassigning. This is just removal. */}
            <div className="flex flex-col gap-2 pt-2 border-t border-border/30">
              {task.status !== "completed" && (
                <Button
                  variant="outline"
                  onClick={() => setShowNotRequiredConfirm(true)}
                  disabled={busy}
                  className="w-full border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-500"
                >
                  <Ban className="h-4 w-4 mr-1.5" /> Not required — remove for good
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setShowRemoveConfirm(true)}
                disabled={busy}
                className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1.5" /> Remove & regenerate
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
              {task.status === "completed"
                ? "This permanently deletes the completed task. To restore it as scheduled instead, use 'Undo complete'. If this clean came from a reservation, removing will auto-regenerate it from the source."
                : task.source === "manual"
                ? "This deletes the manual cleaning task. It cannot be auto-regenerated — you'll need to add it again from the + button."
                : "This deletes the cleaning task and will auto-regenerate it from the source reservation."}
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

      <AlertDialog open={showNotRequiredConfirm} onOpenChange={setShowNotRequiredConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this clean as not required?</AlertDialogTitle>
            <AlertDialogDescription>
              Use this when the property genuinely doesn't need cleaning for this
              turnover — e.g. an owner checking in, or a guest who has told you they
              aren't coming (no-show). It's removed from the schedule and <b>will not
              come back when you regenerate</b>. The booking itself is untouched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleNotRequired} disabled={busy} className="bg-amber-600 hover:bg-amber-600/90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, not required"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingCleanerId}
        onOpenChange={(o) => { if (!o) { setPendingCleanerId(null); setPendingUnavailReason(null); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cleaner is marked unavailable</AlertDialogTitle>
            <AlertDialogDescription>
              {cleaners.find((c) => c.id === pendingCleanerId)?.name} is marked{" "}
              <strong>{pendingUnavailReason}</strong> on{" "}
              {format(parseISO(task.scheduled_date), "EEE d MMM")}. Assign anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReassign} disabled={busy}>
              Assign anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
