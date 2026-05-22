import { format } from "date-fns";

export interface CleanerHoliday {
  id: string;
  cleaner_id: string;
  start_date: string; // yyyy-MM-dd
  end_date: string;   // yyyy-MM-dd
  reason: string;
  notes: string | null;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dayNameFor(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date + "T12:00:00Z") : date;
  return DAY_NAMES[d.getDay()];
}

/**
 * Returns reason string if the cleaner is unavailable on the date, or null.
 * Holidays take precedence over weekday rules in the returned label.
 */
export function getUnavailabilityReason(
  cleaner: { non_working_days?: string[] | null } | undefined | null,
  date: Date | string,
  holidays: CleanerHoliday[] = []
): string | null {
  if (!cleaner) return null;
  const dateStr = typeof date === "string" ? date : format(date, "yyyy-MM-dd");

  const holiday = holidays.find(
    (h) => dateStr >= h.start_date && dateStr <= h.end_date
  );
  if (holiday) return holiday.reason || "Holiday";

  const day = dayNameFor(date);
  if ((cleaner.non_working_days || []).includes(day)) return "Non-working day";

  return null;
}

export function isCleanerUnavailable(
  cleaner: { non_working_days?: string[] | null } | undefined | null,
  date: Date | string,
  holidays: CleanerHoliday[] = []
): boolean {
  return getUnavailabilityReason(cleaner, date, holidays) !== null;
}
