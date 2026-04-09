

## Fix: Add Missing Unique Constraint for Hostaway Sync

### Problem
The sync logs show every listing upsert failing with:
`"there is no unique or exclusion constraint matching the ON CONFLICT specification"`

The edge function does `upsert(..., { onConflict: "hostaway_listing_id" })` but the `listings` table has no unique constraint on that column. Reservations are syncing (800+ processed) but can't link to listings properly since none were upserted.

### Fix

**Step 1 — Add unique constraint via migration**
```sql
ALTER TABLE listings
ADD CONSTRAINT listings_hostaway_listing_id_key UNIQUE (hostaway_listing_id);
```

This single migration fixes the root cause. No edge function code changes needed — the upsert logic is already correct, it just needs the constraint to exist.

**Step 2 — Re-run sync**
After the constraint is added, the user hits "Sync Now" again. This time:
- All 50 listings will upsert correctly
- Reservations will match to listings via `hostaway_listing_id`
- The `hostaway_reservation_id` unique constraint (added in a prior migration) handles reservation dedup

### Files changed
- One new migration file only

### What stays the same
- Edge function code — no changes needed
- All existing data unaffected

