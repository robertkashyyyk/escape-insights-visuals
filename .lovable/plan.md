

# Make "Regenerate" cover the visible week, not just one day

## What's happening
The Regenerate button on `/operations/schedule` only sends a **single date** (whatever `selectedDate` is) to the edge function. So when you click it, it processes one day, finds no checkouts on that day, and shows "No checkouts found for {date}". The other 6 days of the week you're looking at are ignored.

The edge function itself already supports a date range — it accepts a `days_ahead` parameter and will process up to 30 days. The frontend just isn't using it.

## What we'll change

### Matrix view (`/operations/schedule`) — regenerate the whole visible week
The matrix view shows a 7-day week. Regenerate should process **all 7 days of that week**.

- Pass `{ date: weekStart, days_ahead: 7 }` to the edge function instead of a single date.
- Update the toast to summarise the whole range:
  - `"12 tasks created across this week, 2 still unassigned"` (success)
  - `"No checkouts found for {weekStart} – {weekEnd}. Nothing to generate."` (empty)
  - `"3 tasks remain unassigned for this week — no cleaner covers Belfast, or eligible cleaners are at capacity."` (partial)

### Day view (`/operations/cleaning` if applicable) — keep single-day behaviour, add a secondary action
The existing single-day Regenerate stays (it makes sense for a day-focused view), but we add a small **"Regenerate next 7 days"** option in a dropdown next to the button so users have the wider option without losing the targeted one.

### Wording
The current toast wording ("No checkouts found for {date}") is technically correct but misleading because users assume Regenerate is broader. The new wording will make the scope explicit in every toast: "for the week of Apr 21 – Apr 27" rather than just one date.

## Technical changes

**Files to edit:**
- `src/hooks/useMatrixSchedule.ts` — add a `regenerateWeek()` callback that invokes the edge function with `{ date: weekStartStr, days_ahead: 7 }`, sums per-day results from the response, and shows a week-scoped toast. Invalidate the matrix-tasks query after.
- `src/pages/CleaningSchedule.tsx` (or wherever the matrix Regenerate button lives) — wire the button to `regenerateWeek` instead of the single-day version.
- `src/hooks/useCleaningSchedule.ts` — add an optional `regenerateRange(days)` variant alongside the existing single-day `regenerate`. Keep current behaviour as default.
- Edge function: **no change needed** — it already returns `per_day_results` for ranges.

No DB migration. No edge function redeploy strictly needed (already supports the param), but we'll redeploy to be safe.

## Out of scope
- Auto-regenerating on week navigation (still manual click).
- Regenerating across multiple weeks at once from the UI.

