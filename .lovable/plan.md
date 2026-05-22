# Cleaner Holidays + Smarter Allocation

Two coordinated improvements. Both extend existing logic — no parallel systems.

---

## 1. Cleaner Holidays / Leave

### Database
New table `cleaner_holidays`:
- `cleaner_id` (uuid), `start_date`, `end_date` (inclusive), `reason` (Holiday / Leave / Unavailable / Sick / Other), `notes`, `created_by`.
- RLS: super/senior manage; admin read all; a cleaner can read their own.

### Settings UI (`CleanersSettings.tsx`)
- New "Holidays / Leave" section inside the cleaner edit dialog: list upcoming + add new (date range + reason + notes).
- After saving a new holiday, query `clean_tasks` for that cleaner inside the date range.
  - If any exist → dialog: *"This cleaner has N cleans assigned in this period. Reallocate them now?"* → Yes unassigns them and silently calls `generate-daily-cleaning-schedule` for those dates; No leaves them (with a warning badge later).

### Scheduler UI
- Matrix + planner cells: when the column's date falls in a holiday for that cleaner, show a small badge "On leave" + tooltip with the reason. Reuse non-working-day visual treatment.
- Manual assignment (TaskDetailPanel reassign dropdown / AddManualCleanModal): if chosen cleaner is on holiday or non-working that date, show a non-blocking confirm — "X is marked unavailable (reason). Assign anyway?".

### Edge function (`generate-daily-cleaning-schedule`)
- Load all `cleaner_holidays` overlapping the processed date window.
- Add to the existing eligibility filter: skip cleaner if the target date falls inside any of their holiday ranges (additive to the existing `non_working_days` weekday check). No other change to the unavailable-day path.

---

## 2. Allocation: Fair-Share Deficit + Nearby Property Clustering

All changes inside `generate-daily-cleaning-schedule` `processDate()`. No schema change.

### Fair-share deficit (refined)
Current code compares the cleaner's *same-day region count* against target share. Refine to use a rolling actual:

```text
window = last 28 days + current pass
actual_pct  = cleaner_completed_in_region / total_in_region (window)
target_pct  = workload_share[region]
deficit     = target_pct - actual_pct
```

Pick the eligible cleaner with the largest positive deficit. Tie-break = fewer minutes scheduled today.

### Nearby-property clustering (new, before per-task assignment)
For each `(date, location_group)`:
1. Build geo-clusters: greedy — two listings join the same cluster if within ~5 miles (haversine ≤ 8 km).
2. For each cluster:
   - **1–3 properties** → try to assign the whole cluster to one cleaner (chosen by fair-share deficit among eligible cleaners with enough remaining capacity for the whole cluster).
   - **4+ properties** → split: peel groups of ~3 and assign each group to the next best fair-share cleaner.
   - If only one eligible cleaner exists for the cluster's region/date, assign all to that cleaner and tag the day with an `overloaded` flag (logged into `automation_logs.error_message` as a soft warning + surfaced as a cell badge via task `notes` like "⚠ Overloaded: only cleaner available").
3. Within an assigned cluster, the existing route optimisation (nearest-next from previous stop) still runs.

### Compromise warnings surfaced
- Overload tag → small "⚠ Overloaded" pill in MatrixView header for the affected cleaner/day, plus a tooltip "Only one cleaner available for N nearby properties".
- Assignments forced onto holiday/non-working day (only possible via admin override) → red "Override" pill.

---

## Out of scope (kept untouched)
- Existing weekly `non_working_days` logic.
- Hostaway sync and orphan-fill path (still drives task creation; only the allocation block changes).
- Owner/Cleaner portal views.

---

## Files

**New**
- `supabase/migrations/<ts>_cleaner_holidays.sql`
- `src/components/settings/CleanerHolidaysSection.tsx`
- `src/lib/cleanerAvailability.ts` (shared client-side helper: `isCleanerUnavailable(cleaner, date, holidays)`)

**Edited**
- `supabase/functions/generate-daily-cleaning-schedule/index.ts` — holidays filter, deficit refactor, clustering pass, overload tagging.
- `src/components/settings/CleanersSettings.tsx` — mount holidays section.
- `src/components/cleaning/MatrixView.tsx` — leave/overload badges; reassign warning.
- `src/components/cleaning/TaskDetailPanel.tsx` — warning before assigning unavailable cleaner.
- `src/components/cleaning/AddManualCleanModal.tsx` — same warning.
- `src/hooks/useMatrixSchedule.ts` — load holidays for the visible week.
- `src/integrations/supabase/types.ts` — regenerated automatically after migration.

Approve and I'll build it.
