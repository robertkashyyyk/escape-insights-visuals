import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, CalendarCheck, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";

interface Exception { id: string; work_date: string; }

/** Single-date overrides of a cleaner's recurring day-off — "works this Thursday".
 *  Used when the area's other cleaner is off and this cleaner covers. Multi-day
 *  time OFF stays in Holidays. */
export function CleanerWorkingExceptionsSection({ cleanerId, cleanerName }: { cleanerId: string; cleanerName: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Exception[]>([]);
  const [offDays, setOffDays] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [exRes, clRes] = await Promise.all([
      (supabase.from("cleaner_working_exceptions" as any) as any)
        .select("id, work_date").eq("cleaner_id", cleanerId).order("work_date"),
      (supabase.from("cleaners" as any) as any).select("non_working_days").eq("id", cleanerId).single(),
    ]);
    setRows(((exRes.data || []) as Exception[]));
    setOffDays(((clRes.data as any)?.non_working_days) || []);
    setLoading(false);
  };
  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, [cleanerId]);

  const add = async () => {
    if (!date) { toast({ title: "Pick a date", variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await (supabase.from("cleaner_working_exceptions" as any) as any)
      .insert({ cleaner_id: cleanerId, work_date: date });
    if (error) {
      toast({ title: error.message.includes("duplicate") ? "That date's already added" : "Could not add", description: error.message, variant: "destructive" });
      setSaving(false); return;
    }
    // Re-run that day's schedule so this cleaner can pick up unassigned jobs.
    await supabase.functions.invoke("generate-daily-cleaning-schedule", { body: { date } }).catch(() => {});
    toast({ title: "Working day added", description: `${cleanerName} now available on ${format(parseISO(date), "EEE d MMM")} — schedule refreshed.` });
    setDate(""); setSaving(false); fetchAll();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase.from("cleaner_working_exceptions" as any) as any).delete().eq("id", id);
    if (error) { toast({ title: "Could not remove", description: error.message, variant: "destructive" }); return; }
    fetchAll();
  };

  return (
    <div className="border border-border/30 rounded-lg p-4 space-y-3">
      <div>
        <Label className="text-xs font-semibold flex items-center gap-1.5"><CalendarCheck className="h-3.5 w-3.5" /> Works on these days (day-off overrides)</Label>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {offDays.length > 0
            ? <>Normally off: <b>{offDays.join(", ")}</b>. Add a date here to say they DO work it (e.g. covering while the area's other cleaner is away).</>
            : <>Add a date they'll work despite a recurring day-off. Multi-day time off goes in Holidays.</>}
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-[11px] text-muted-foreground py-1">No overrides — follows the normal weekly pattern.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {rows.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-1.5 text-xs font-medium pl-2.5 pr-1.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
              {format(parseISO(r.work_date), "EEE d MMM")}
              <button onClick={() => remove(r.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-center">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 bg-secondary/50 border-border/40" />
        <Button size="sm" onClick={add} disabled={saving} className="gap-1.5 shrink-0">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
        </Button>
      </div>
    </div>
  );
}
