

# Plan: Seed Owners and Listings Data

## Schema Changes Needed

Your CSVs contain columns not yet in the database. A migration will add them:

**`property_owners`** — add `management_rate_pct` (numeric, nullable)
- `company_name` in CSV maps to existing `company` column

**`listings`** — add:
- `hostaway_listing_id` (integer, nullable) — external system ID
- `postcode` (text, nullable)
- `latitude` (numeric, nullable)
- `longitude` (numeric, nullable)
- `tags` (text, nullable) — comma-separated tags
- `location_group` (text, nullable) — e.g. "Castle Hume", "Belfast"
- `min_rate` (numeric, nullable) — minimum nightly rate
- `base_rate` (numeric, nullable) — standard nightly rate

The existing `nightly_rate` column stays (can be used for current/dynamic rate). `status` will map from the CSV `active` boolean (TRUE → 'active').

## Data Notes

- **19 owners** to insert, all with pre-set UUIDs from your system
- **46 listings** to insert, also with pre-set UUIDs
- Some listings reference owners not in the Owners CSV (IPT Ltd, Andy/Warren Little, John/Richard Stuart, Erik, Dunaird Ltd). These will be created as additional owner records using names from the Properties CSV.
- `owner_id` is empty for ~10 listings — those owners will be matched by `owner_name` from the Properties CSV and created if missing

## Implementation Steps

1. **Migration**: Add the missing columns listed above
2. **Insert owners**: All 19 from Owners CSV + ~6 additional owners referenced in Properties CSV but not in Owners CSV (using generated UUIDs)
3. **Insert listings**: All 46 properties, linking to correct `owner_id`s

All inserts use the UUIDs from your CSVs to maintain referential integrity.

## Technical Details
- Migration via Supabase migration tool
- Data inserts via Supabase insert tool (SQL INSERT statements)
- Owner records without IDs in the CSV will get stable generated UUIDs
- No frontend changes needed — this is purely database seeding

