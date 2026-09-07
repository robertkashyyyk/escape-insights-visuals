import { useState } from "react";
import { useScheduleAlerts } from "@/hooks/useScheduleAlerts";
import { AlertTriangle, MapPin, CalendarX, ChevronDown, ChevronRight } from "lucide-react";
import { format, parseISO, isToday, isTomorrow } from "date-fns";

const dateLabel = (d: string) => {
  const dt = parseISO(d);
  if (isToday(dt)) return "today";
  if (isTomorrow(dt)) return "tomorrow";
  return format(dt, "EEE d MMM");
};

/**
 * Proactive schedule safety-net banner: surfaces missing turnover cleans and
 * area coverage gaps so they're caught before a guest arrives, rather than by
 * chance. Renders nothing when all is well.
 */
export function ScheduleAlertsBanner() {
  const { coverageGaps, missingCleans } = useScheduleAlerts();
  const [open, setOpen] = useState(true);

  if (coverageGaps.length === 0 && missingCleans.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/[0.06]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
          Needs attention
        </span>
        <span className="text-xs text-muted-foreground">
          {missingCleans.length > 0 && `${missingCleans.length} missing clean${missingCleans.length === 1 ? "" : "s"}`}
          {missingCleans.length > 0 && coverageGaps.length > 0 && " · "}
          {coverageGaps.length > 0 && `${coverageGaps.reduce((s, g) => s + g.count, 0)} uncovered propert${coverageGaps.reduce((s, g) => s + g.count, 0) === 1 ? "y" : "ies"}`}
        </span>
        {open ? <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" /> : <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {missingCleans.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-red-600 dark:text-red-300 mb-1.5">
                <CalendarX className="h-3.5 w-3.5" /> Checkouts with no clean scheduled
              </div>
              <ul className="space-y-1">
                {missingCleans.map((m) => (
                  <li key={`${m.listingId}_${m.date}`} className="text-[13px] text-foreground/90 flex flex-wrap items-center gap-x-2">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-muted-foreground">— checks out {dateLabel(m.date)}{m.guest ? ` (${m.guest.split(/\s+/)[0]})` : ""}, no clean on the schedule</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground mt-1">Regenerate to create these, or add manually if it's a past date.</p>
            </div>
          )}

          {coverageGaps.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-amber-700 dark:text-amber-300 mb-1.5">
                <MapPin className="h-3.5 w-3.5" /> Areas with no cleaner assigned
              </div>
              <ul className="space-y-1">
                {coverageGaps.map((g) => (
                  <li key={g.group} className="text-[13px] text-foreground/90">
                    <span className="font-medium">{g.group}</span>
                    <span className="text-muted-foreground"> — {g.count} propert{g.count === 1 ? "y" : "ies"}, no active cleaner covers this area</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground mt-1">Add the area to a cleaner in Settings → Cleaners (coverage + workload %), then regenerate.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
