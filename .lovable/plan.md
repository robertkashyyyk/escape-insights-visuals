
# Fix the "Undo clean → Regenerate doesn't work" flow

## What the user hit
1. Marked a clean **complete** on a property.
2. Tried to **undo** by clicking "Remove this clean" — the dialog said the clean would be deleted and could be regenerated.
3. Clicked the global **Regenerate** button — got `0 tasks created, 0 unassigned`.

## Root causes
Three real problems in the current flow:

1. **Removal sets no flag to bring it back.** `removeTask` deletes the `clean_tasks` row but doesn't reset `listings.is_clean = false`. So the property still looks "clean" everywhere else.
2. **The global Regenerate button is date-scoped to whatever day the user is viewing**, not the date of the clean they just deleted. If they removed a clean for, say, Apr 22 but were viewing Apr 18 when they clicked Regenerate, the edge function processes Apr 18 → 0 created.
3. **The edge function only generates tasks from confirmed reservations** with `check_out = targetDate`. Manual cleans can never be "regenerated" by it. And there's no user-visible explanation of why 0 came back — the toast just says `0 tasks created`.

There's also no **one-click "undo"** — the user has to delete in one place, then navigate to another page and trust a global button. That's the real UX gap.

## What we'll build

### 1. Replace "Remove this clean" with a real Undo
In `TaskDetailPanel`, when the task's status is `completed`, show an **"Undo complete"** button (in addition to the existing remove option). Undo will:
- Set `clean_tasks.status` back to `scheduled` (or `unassigned` if no cleaner) and clear `completed_at`.
- Set `listings.is_clean = false`.
- No deletion, no regeneration needed — instant, reliable.

This is the fix for the user's actual reported problem. 95% of "undo complete" cases will use this path and never touch the regenerator.

### 2. Make the "Remove" path self-healing
For genuine removals (not undo), after `removeTask` succeeds:
- If the deleted task had a `reservation_id`, immediately call the edge function **scoped to that task's `scheduled_date`** (not the currently-viewed date) so the same clean is recreated from its source reservation.
- If it was a `source='manual'` task, just remove it and tell the user "Manual clean removed — add another from the + button if needed" (no regeneration possible, and the toast will be honest about it).

### 3. Improve the Regenerate toast
When the edge function returns `tasks_created: 0`, show a clearer message:
- If 0 created AND 0 unassigned: `"No checkouts found for {date}. Nothing to generate."`
- If the user just removed a task and regen still returns 0 for that date: surface why (e.g. reservation was cancelled, or it was a manual clean).

### 4. Confirm dialog wording
Update the remove confirmation copy on completed tasks to clarify the two paths:
- "Undo complete" — restore as a scheduled task (recommended)
- "Remove permanently" — deletes the task; will auto-regenerate from the source reservation if one exists

## Technical changes

**Files to edit:**
- `src/hooks/useMatrixSchedule.ts` — add `undoComplete(taskId, listingId)` mutation; modify `removeTask` to capture the deleted row's `scheduled_date` + `reservation_id` + `source` and trigger a targeted regenerate when applicable; pipe new toast wording.
- `src/components/cleaning/TaskDetailPanel.tsx` — add "Undo complete" button when `task.status === 'completed'`; update remove dialog copy; wire `onUndo` prop.
- `src/components/cleaning/MatrixView.tsx` — pass new `undoComplete` handler through to the panel.
- `src/hooks/useCleaningSchedule.ts` — same `undoComplete` for the day-list view; improve `regenerate` toast for the 0/0 case.
- `supabase/functions/generate-daily-cleaning-schedule/index.ts` — no logic change needed; the existing dedupe already handles "row exists → skip", which is what we want when the row hasn't been deleted yet.

No DB migration needed.

## Out of scope
- Restoring manual cleans (no source to regenerate from — the toast will say so).
- Auto-undoing across pages other than `/cleaning-schedule` and `/cleaning-numbers`.
