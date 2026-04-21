

# Why Belfast cleans aren't being assigned on Apr 24–26

## Root cause

Odette is the **only** cleaner with `Belfast` in her `location_groups`, so she's the only eligible cleaner for these properties. The tasks ARE being created (I confirmed: `1 Malone Place` 25th, `University Road 1 & 2` 24th, `University Road 1` 26th all exist as `unassigned`). They just never get assigned to her.

Two problems in `generate-daily-cleaning-schedule/index.ts`:

### Problem 1 — Capacity gate (the main one)
At line 355, every candidate is filtered by:
```
projected = cleanerScheduledMinutes + duration + 15  ≤  daily_working_hours * 60
```

`cleanerScheduledMinutes` is built (line 261-280) from **all existing tasks for that date, including the unassigned ones being re-evaluated**. Wait — actually that part filters by `assigned_cleaner_id`, so unassigned don't count. The real issue: on Apr 24 there are **3 Belfast checkouts** (Escape Ordinary No.2 + Uni Road 1 + Uni Road 2). If `Escape Ordinary No.2` already got assigned to Odette in a previous run, her `cleanerScheduledMinutes` starts at 105 (90 + 15 travel). Adding Uni Road 1 → 210, Uni Road 2 → 315 — all well under 480 min (8 hr), so capacity isn't the blocker here.

The **actual** blocker is more subtle: `cleanerScheduledMinutes` only counts **already-existing tasks in the DB**. When the regenerator processes a date where tasks already exist as `unassigned` (which is exactly the user's situation), it skips them in the dedupe at line 240–242 (`existingSet`) — so they're **never re-evaluated**, and they stay unassigned forever.

That's the bug. **The regenerator only assigns tasks it newly creates. Pre-existing unassigned tasks are skipped by the dedupe and never get a cleaner.**

### Problem 2 — Empty `location_groups` for some Belfast cleaners
Only Odette covers Belfast. If she's at capacity or off, there is no fallback cleaner. Not the immediate cause but worth flagging.

## What we'll build

### Fix 1 — Make regenerate also assign existing unassigned tasks
Update `processDate()` in `supabase/functions/generate-daily-cleaning-schedule/index.ts`:
- After the dedupe step, also fetch all existing **unassigned** tasks for `targetDate` and feed them into the same allocation pass as new tasks.
- Treat them as `TaskInfo` objects (using their stored `listing_id`, `scheduled_date`, `cleaning_duration_minutes`, etc., re-derived from the listings table).
- After allocation, **UPDATE** these existing rows with `assigned_cleaner_id`, `status='scheduled'`, `estimated_start_time`, `travel_time_from_previous_minutes` rather than INSERT.
- Newly-created tasks continue to be inserted as today.

This means clicking "Regenerate" will retry assignment for any orphaned `unassigned` tasks, which is what the user expects.

### Fix 2 — Better toast for partial success
Update `useCleaningSchedule.ts` regenerate toast: when tasks_created is 0 but `tasks_unassigned > 0`, say:
> "No new tasks needed for {date}, but {n} tasks remain unassigned — no cleaner has {region} in their coverage areas, or all eligible cleaners are at capacity."

### Fix 3 — Surface unassigned reason in the UI (small)
In the matrix view, when a task is unassigned, show a tooltip on the empty cell: "No cleaner covers Belfast" or "All Belfast cleaners are at capacity for this day" — derived client-side from the cleaners list.

## Immediate workaround for Andreas
Either:
1. Add `Belfast` to another cleaner's `location_groups` in Settings → Cleaners (e.g. Aneta who is currently `Other` only), OR
2. Manually drag the unassigned tile in the matrix onto Odette — this works today.

## Technical changes

**Files to edit:**
- `supabase/functions/generate-daily-cleaning-schedule/index.ts` — load existing unassigned tasks for the date alongside new ones; route them through the same eligibility + allocation logic; UPDATE existing rows instead of INSERT.
- `src/hooks/useCleaningSchedule.ts` — improve regenerate toast wording for the "0 created, N still unassigned" case.
- `src/components/cleaning/MatrixView.tsx` — add tooltip on unassigned cells explaining why (no eligible cleaner / capacity).

No DB migration needed.

## Out of scope
- Auto-spreading Belfast coverage across other cleaners (manual config change in Settings).
- Multi-day rebalancing.

