# Cleaning Matrix — 7 Fixes

## Fix 1 — Smarter auto-schedule guard
**File:** `src/hooks/useMatrixSchedule.ts` (the lazy-generate `useEffect`, ~lines 193-230)

Replace the `if (tasks.length > 0) return;` early-exit with a coverage check:

- Build `coveredReservationIds = new Set(tasks.map(t => t.reservation_id).filter(Boolean))`.
- Build `coveredListingDates = new Set(tasks.map(t => \`${t.listing_id}_${t.scheduled_date}\`))`.
- Compute `uncoveredCheckouts` = confirmed reservations whose `check_out` falls in `[weekStartStr, weekEndStr]` and that are NOT in `coveredReservationIds` AND whose `${listing_id}_${check_out}` is NOT in `coveredListingDates`.
- Only fire the invoke if `uncoveredCheckouts.length > 0`.

Keep the existing `inFlightRef` and 60s `recentSuccessRef` cooldown — they still guard against loops. Edge function is already idempotent.

## Fix 2 — Hide day-nav pill in Matrix view
**File:** `src/pages/CleaningSchedule.tsx` (lines ~147-168)

Wrap the `‹ Today ›` pill + the "Back to Today" link in `{viewMode !== "matrix" && (...)}` so they only render in Day/Week mode.

## Fix 3 — Guest first name in cells
**Files:** `src/hooks/useMatrixSchedule.ts`, `src/components/cleaning/MatrixView.tsx`

- Hook: add `reservationGuestMap = useMemo(() => new Map(reservations.map(r => [r.id, r.guest_name])), [reservations])` to the return value (reservations already loaded).
- `MatrixView`: destructure `reservationGuestMap` from hook, thread it down through `MatrixCell` → `DraggableCellInner` as a `guestName?: string` prop derived per task via `task.reservation_id ? reservationGuestMap.get(task.reservation_id) : undefined`.
- In `DraggableCellInner`: when `task.reservation_id` and `task.status !== "completed"` and a guest name exists, render below the cleaner initial:
  ```tsx
  <div className="text-[9px] opacity-70 truncate">{guestName.split(/\s+/)[0]}</div>
  ```

## Fix 4 — Dynamic Regenerate button label
**File:** `src/pages/CleaningSchedule.tsx` (lines ~120-141)

In the IIFE that builds the regenerate button label, when `isMatrixScope` is true set:
```
label = `Regenerate ${format(matrixWeekStart, "d MMM")} – ${format(addDays(matrixWeekStart, 6), "d MMM")}`
```
Keep the existing "Generating..." while `isRegenerating`. Day view label unchanged.

## Fix 5 — Rename floating "NOW" → "This Week"
**File:** `src/pages/CleaningSchedule.tsx` (lines ~263-272)

Change the middle floating button:
- Text: `This Week` instead of `NOW`.
- Class: `h-9 w-9 rounded-full hover:bg-secondary text-[10px] font-bold` → `h-9 px-2 rounded-full hover:bg-secondary text-[10px] font-bold`.
- Keep `title="Back to current week"` and `disabled={matrixIsCurrentWeek}`.

## Fix 6 — Weekly coverage summary in matrix nav bar
**Files:** `src/components/cleaning/MatrixView.tsx`, `src/pages/CleaningSchedule.tsx`

- `MatrixView`: add an optional prop `onSummaryChange?: (s: { total: number; unassigned: number }) => void`. After the existing `summary` `useMemo`, add a `useEffect` that calls `onSummaryChange?.({ total: summary.total, unassigned: summary.unassigned })` when those values change.
- `CleaningSchedule`: hold `const [matrixSummary, setMatrixSummary] = useState<{ total: number; unassigned: number } | null>(null)`, pass `onSummaryChange={setMatrixSummary}` to `<MatrixView>`.
- After the date-range `<span>` in the inline matrix nav (line ~209-211), render:
  ```tsx
  {matrixSummary && (
    <span className="text-xs tabular-nums">
      <span className="text-muted-foreground">{matrixSummary.total} cleans</span>
      <span className={matrixSummary.unassigned > 0 ? "text-amber-400 ml-2" : "text-muted-foreground ml-2"}>
        · {matrixSummary.unassigned > 0 ? `⚠ ${matrixSummary.unassigned} unassigned` : "all assigned"}
      </span>
    </span>
  )}
  ```

## Fix 7 — Add `source` to edge-function insert rows
**File:** `supabase/functions/generate-daily-cleaning-schedule/index.ts` (line ~887, inside the `toInsert.map` row builder)

Add `source: t.source ?? "hostaway",` to the inserted row object so auto-generated tasks are correctly tagged.

---

## Technical notes
- All fixes are surgical edits — no schema changes, no new files.
- The edge function change (Fix 7) deploys automatically; no SQL migration needed.
- Fix 1's `uncoveredCheckouts` calc uses already-loaded data — no extra queries.
- Fix 6 uses a callback rather than lifting the summary computation, so MatrixView stays the source of truth for what counts as "visible".
