import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, CalendarOff, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";

const REASONS = ["Holiday", "Leave", "Sick", "Unavailable", "Other"] as const;

interface Holiday {
  id: string;
  cleaner_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  notes: string | null;
}

interface Props {
  cleanerId: string;
  cleanerName: string;
}

export function CleanerHolidaysSection({ cleanerId, cleanerName }: Props) {
  const { toast } = useToast();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState<string>("Holiday");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Confirm-reallocate dialog state
  const [pendingReallocate, setPendingReallocate] = useState<{
    holidayId: string;
    start: string;
    end: string;
    taskCount: number;
  } | null>(null);
  const [reallocating, setReallocating] = useState(false);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cleaner_holidays" as any)
      .select("*")
      .eq("cleaner_id", cleanerId)
      .order("start_date", { ascending: false });
    setHolidays((data || []) as unknown as Holiday[]);
    setLoading(false);
  };

  useEffect(() => { fetch(); /* eslint-disable-next-line */ }, [cleanerId]);

  const handleAdd = async () => {
    if (!start || !end) {
      toast({ title: "Pick start and end dates", variant: "destructive" });
      return;
    }
    if (end < start) {
      toast({ title: "End date must be after start", variant: "destructive" });
      return;
    }
    setSaving(true);

    const { data: inserted, error } = await (supabase
      .from("cleaner_holidays" as any) as any)
      .insert({
        cleaner_id: cleanerId,
        start_date: start,
        end_date: end,
        reason,
        notes: notes.trim() || null,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Failed to add", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Check existing assigned cleans in that period
    const { data: existing } = await supabase
      .from("clean_tasks" as any)
      .select("id", { count: "exact" })
      .eq("assigned_cleaner_id", cleanerId)
      .gte("scheduled_date", start)
      .lte("scheduled_date", end)
      .not("status", "in", "(completed,cancelled)");

    const count = (existing || []).length;
    toast({ title: `${reason} added for ${cleanerName}` });
    setStart(""); setEnd(""); setNotes(""); setReason("Holiday");
    fetch();
    setSaving(false);

    if (count > 0 && inserted) {
      setPendingReallocate({
        holidayId: (inserted as any).id,
        start, end, taskCount: count,
      });
    }
  };

  const handleReallocate = async () => {
    if (!pendingReallocate) return;
    setReallocating(true);
    const { start, end } = pendingReallocate;

    // Unassign the cleans for this cleaner in the period
    const { error: unErr } = await (supabase.from("clean_tasks" as any) as any)
      .update({ assigned_cleaner_id: null, status: "unassigned" })
      .eq("assigned_cleaner_id", cleanerId)
      .gte("scheduled_date", start)
      .lte("scheduled_date", end)
      .not("status", "in", "(completed,cancelled)");

    if (unErr) {
      toast({ title: "Reallocate failed", description: unErr.message, variant: "destructive" });
      setReallocating(false);
      return;
    }

    // Trigger generation per-date (covers the whole range)
    try {
      const startD = parseISO(start);
      const endD = parseISO(end);
      const days = Math.round((endD.getTime() - startD.getTime()) / 86400000) + 1;
      await supabase.functions.invoke("generate-daily-cleaning-schedule", {
        body: { date: start, days_ahead: days },
      });
      toast({ title: "Reallocation triggered", description: `${pendingReallocate.taskCount} task(s) sent back into the pool.` });
    } catch (e: any) {
      toast({ title: "Reallocate triggered but generator failed", description: e?.message, variant: "destructive" });
    }
    setReallocating(false);
    setPendingReallocate(null);
  };

  const handleDelete = async (id: string) => {
    await (supabase.from("cleaner_holidays" as any) as any).delete().eq("id", id);
    toast({ title: "Removed" });
    fetch();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs flex items-center gap-1.5">
          <CalendarOff className="h-3 w-3" /> Holidays / Leave
        </Label>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-[11px] text-muted-foreground">Loading…</p>
      ) : holidays.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">No holidays recorded.</p>
      ) : (
        <div className="space-y-1">
          {holidays.map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border/30 bg-secondary/30 px-2 py-1.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-300">
                  {h.reason}
                </Badge>
                <span className="text-[11px] text-foreground truncate">
                  {format(parseISO(h.start_date), "d MMM")}
                  {h.start_date !== h.end_date && ` → ${format(parseISO(h.end_date), "d MMM yyyy")}`}
                  {h.start_date === h.end_date && ` ${format(parseISO(h.start_date), "yyyy")}`}
                </span>
                {h.notes && <span className="text-[10px] text-muted-foreground truncate">· {h.notes}</span>}
              </div>
              <Button
                size="icon" variant="ghost" className="h-6 w-6 text-destructive shrink-0"
                onClick={() => handleDelete(h.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <div className="rounded-md border border-border/30 bg-card/40 p-2 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-muted-foreground">Start</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-8 bg-secondary/50 border-border/40 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">End</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-8 bg-secondary/50 border-border/40 text-xs" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-muted-foreground">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-8 bg-secondary/50 border-border/40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              type="button" size="sm" className="w-full h-8 text-xs"
              onClick={handleAdd} disabled={saving || !start || !end}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Plus className="h-3 w-3 mr-1" />Add</>}
            </Button>
          </div>
        </div>
        <Textarea
          value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes"
          rows={2}
          className="bg-secondary/50 border-border/40 text-xs"
        />
      </div>

      {/* Reallocate prompt */}
      <AlertDialog open={!!pendingReallocate} onOpenChange={(o) => !o && setPendingReallocate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reallocate assigned cleans?</AlertDialogTitle>
            <AlertDialogDescription>
              {cleanerName} has <strong>{pendingReallocate?.taskCount}</strong> clean
              {pendingReallocate?.taskCount === 1 ? "" : "s"} assigned between{" "}
              {pendingReallocate && format(parseISO(pendingReallocate.start), "d MMM")}{" "}
              and {pendingReallocate && format(parseISO(pendingReallocate.end), "d MMM yyyy")}.
              Unassign and rerun the allocator so other cleaners pick them up?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reallocating}>Keep as is</AlertDialogCancel>
            <AlertDialogAction onClick={handleReallocate} disabled={reallocating}>
              {reallocating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Reallocate now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
