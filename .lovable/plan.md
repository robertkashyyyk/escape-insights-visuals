## 1. Why we have "duplicates" and "unlinked"

After a deeper look, the real story is cleaner than the earlier breakdown suggested. **All 45 "missing"-link bookings actually have a clean on that listing+date — it's just linked to a different reservation row.** Almost every case follows one pattern:

- A guest first appears as an **inquiry** (e.g. Craig, 30 May → Ernie's Den).
- The auto-clean trigger fires on the inquiry and creates a clean.
- The guest later converts (or another guest books the same night) and a **confirmed** reservation lands on the same listing + checkout date.
- The trigger sees a clean already exists for that listing+date and refuses to create another — but it never re-points the `reservation_id` to the confirmed booking, so the confirmed one looks "unlinked".

So the two numbers were really one bug: **inquiries are being given cleans**. The user has already stated inquiries should never get a clean.

**Fix (data + trigger):**
- Migration to update `auto_create_clean_from_reservation` so it skips `inquiry` status (in addition to cancelled/declined/expired).
- One-off backfill: for every clean currently linked to an inquiry where a confirmed sibling exists on the same listing+checkout date, re-point `reservation_id` to the confirmed booking. Then delete any non-manual clean that is still linked to an inquiry with no confirmed sibling.

After this: every confirmed future booking is linked 1:1, inquiries stay off the schedule (as intended), and the only remaining "duplicates" would be genuine same-day double-bookings (currently 2 — Hilltop Views 30 Jun, Harbour Heights 13 Jul), which legitimately share one clean.

## 2. Matrix View — cross out past days

In `src/components/cleaning/MatrixView.tsx`, for any cell whose date is **strictly before today**:
- Apply `opacity-60` to the whole cell.
- Add a diagonal strikethrough overlay (a thin `bg-foreground/20` line via a pseudo-element / absolutely-positioned div rotated 45°) so the cell is clearly "in the past" but contents stay readable.
- Day-column headers for past dates get `line-through text-muted-foreground`.

Today and future dates render unchanged.

## 3. Matrix drag-and-drop — confirmation flow

Currently a drop instantly writes `assigned_cleaner_id`. Replace with a two-stage confirm:

**Primary dialog** (always shown on drop):
```
Reassign clean?
  Original cleaner : <name>      (or "Unassigned")
  New cleaner      : <name>
  Property         : <listing name>
  Location group   : <listing.location_group>
  Date             : <scheduled_date>
[Cancel]  [Confirm]
```

**Secondary dialog** (only if the new cleaner's `location_groups` array does NOT include the listing's `location_group`):
```
Outside cleaner's area
  <Cleaner> doesn't cover "<location group>".
  This is outside their normal patch — are you really sure?
[Cancel]  [Confirm anyway]
```

Only after the final Confirm do we run the existing update. Cancel at any stage = no DB write, card snaps back.

### Technical detail
- New component `src/components/cleaning/ReassignConfirmDialog.tsx` using existing shadcn `AlertDialog`.
- `MatrixView.tsx` `onDrop` handler: instead of calling the mutation, stash `{ taskId, fromCleanerId, toCleanerId, listing, date }` in local state and open the dialog. Dialog reads cleaner names from already-loaded `cleaners` and listing.location_group from the task's listing; runs the mutation on Confirm.
- Suitability check: `cleaner.location_groups?.includes(listing.location_group)` — if false, after primary confirm, open the secondary warning before committing.

## Files

- `supabase/migrations/<new>.sql` — trigger fix + backfill (one migration).
- `src/components/cleaning/MatrixView.tsx` — past-day styling, replace drop handler.
- `src/components/cleaning/ReassignConfirmDialog.tsx` — new.
