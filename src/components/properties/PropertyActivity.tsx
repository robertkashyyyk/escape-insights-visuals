import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { format, parseISO } from "date-fns";
import { CalendarPlus, CalendarX, SprayCan, AlertTriangle, Loader2, Activity as ActivityIcon } from "lucide-react";

type Kind = "booking" | "cancellation" | "clean" | "issue";

interface Event {
  at: string;              // ISO timestamp (when it happened in the system)
  kind: Kind;
  cleanStatus?: string;    // for cleans
  title: string;
  detail: string;
  cancelledClean: boolean;
}

const CANCELLED = new Set(["cancelled", "canceled", "declined", "expired"]);

const KIND_META: Record<Kind, { label: string; icon: any; dot: string }> = {
  booking: { label: "Bookings", icon: CalendarPlus, dot: "bg-emerald-500" },
  cancellation: { label: "Cancellations", icon: CalendarX, dot: "bg-red-500" },
  clean: { label: "Cleans", icon: SprayCan, dot: "bg-blue-500" },
  issue: { label: "Issues", icon: AlertTriangle, dot: "bg-orange-500" },
};

const cleanDot = (status?: string) => {
  const s = (status || "").toLowerCase();
  if (s === "completed" || s === "done") return "bg-emerald-500";
  if (CANCELLED.has(s)) return "bg-muted-foreground/40";
  if (s === "in_progress") return "bg-amber-500";
  return "bg-blue-500";
};

export function PropertyActivity({ listingId }: { listingId: string }) {
  const [active, setActive] = useState<Set<Kind>>(new Set(["booking", "cancellation", "clean", "issue"]));
  const [showCancelledCleans, setShowCancelledCleans] = useState(false);

  const { data: cleaners = [] } = useQuery({
    queryKey: ["activity-cleaners"],
    queryFn: async () => {
      const { data } = await supabase.from("cleaners").select("id, name");
      return (data || []) as { id: string; name: string }[];
    },
  });
  const cleanerName = useMemo(() => {
    const m = new Map(cleaners.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? m.get(id) ?? null : null);
  }, [cleaners]);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["property-activity", listingId, cleaners.length],
    queryFn: async (): Promise<Event[]> => {
      const [resv, cleans, issues] = await Promise.all([
        fetchAllRows<any>(() => supabase.from("reservations")
          .select("id, check_in, check_out, guest_name, status, created_at").eq("listing_id", listingId)),
        fetchAllRows<any>(() => supabase.from("clean_tasks")
          .select("id, scheduled_date, status, source, created_at, completed_at, assigned_cleaner_id").eq("listing_id", listingId)),
        (await supabase.from("clean_issues")
          .select("id, issue_type, description, urgency, status, created_at").eq("listing_id", listingId)).data ?? [],
      ]);

      const out: Event[] = [];
      for (const r of resv) {
        const cancelled = CANCELLED.has((r.status || "").toLowerCase());
        out.push({
          at: r.created_at,
          kind: cancelled ? "cancellation" : "booking",
          title: r.guest_name || "Guest",
          detail: `${r.check_in} → ${r.check_out} · ${r.status}`,
          cancelledClean: false,
        });
      }
      for (const c of cleans) {
        const who = cleanerName(c.assigned_cleaner_id);
        const done = c.completed_at ? ` · done ${format(parseISO(c.completed_at), "d MMM HH:mm")}` : "";
        out.push({
          at: c.created_at,
          kind: "clean",
          cleanStatus: c.status,
          title: `Clean · ${c.status}`,
          detail: `for ${c.scheduled_date}${who ? ` · ${who}` : ""} · ${c.source}${done}`,
          cancelledClean: CANCELLED.has((c.status || "").toLowerCase()),
        });
      }
      for (const i of issues as any[]) {
        out.push({
          at: i.created_at,
          kind: "issue",
          title: `Issue · ${i.issue_type}`,
          detail: `${i.description || ""}${i.urgency ? ` (${i.urgency})` : ""}${i.status ? ` — ${i.status}` : ""}`,
          cancelledClean: false,
        });
      }
      return out.sort((a, b) => (a.at < b.at ? 1 : -1));
    },
  });

  const filtered = useMemo(
    () => events.filter((e) => active.has(e.kind) && (showCancelledCleans || !e.cancelledClean)),
    [events, active, showCancelledCleans]
  );
  const shown = filtered.slice(0, 80);

  const toggle = (k: Kind) =>
    setActive((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const cancelledCleanCount = events.filter((e) => e.cancelledClean).length;

  return (
    <div className="glass-card rounded-xl border border-border/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <ActivityIcon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Activity</h3>
        <span className="text-xs text-muted-foreground">{filtered.length} events</span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        {(Object.keys(KIND_META) as Kind[]).map((k) => {
          const on = active.has(k);
          const Icon = KIND_META[k].icon;
          return (
            <button key={k} onClick={() => toggle(k)}
              className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${
                on ? "border-primary/40 bg-primary/10 text-foreground" : "border-border/40 text-muted-foreground hover:bg-secondary"
              }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${KIND_META[k].dot}`} />
              <Icon className="h-3 w-3" />{KIND_META[k].label}
            </button>
          );
        })}
        {cancelledCleanCount > 0 && (
          <button onClick={() => setShowCancelledCleans((v) => !v)}
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ml-auto ${
              showCancelledCleans ? "border-primary/40 bg-primary/10 text-foreground" : "border-border/40 text-muted-foreground hover:bg-secondary"
            }`}>
            {showCancelledCleans ? "Hide" : "Show"} cancelled cleans ({cancelledCleanCount})
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
      ) : shown.length === 0 ? (
        <p className="text-xs text-muted-foreground/50 py-6 text-center">No activity for the selected filters.</p>
      ) : (
        <div className="divide-y divide-border/20">
          {shown.map((e, i) => (
            <div key={i} className="flex items-start gap-3 py-2">
              <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${e.kind === "clean" ? cleanDot(e.cleanStatus) : KIND_META[e.kind].dot}`} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-foreground">{e.title}{e.title.startsWith("Clean") ? "" : ""}</div>
                <div className="text-[11px] text-muted-foreground truncate">{e.detail}</div>
              </div>
              <div className="text-[11px] text-muted-foreground/70 tabular-nums shrink-0">
                {e.at ? format(parseISO(e.at), "d MMM yy") : ""}
              </div>
            </div>
          ))}
          {filtered.length > shown.length && (
            <p className="text-[11px] text-muted-foreground/60 pt-2">Showing 80 of {filtered.length}.</p>
          )}
        </div>
      )}
    </div>
  );
}
