

# Plan: Import 2,471 Reservations from CSV

## What We Have

- **CSV**: 2,471 reservations with Guest, Check-in, Check-out, Listing name, Listing ID (Hostaway), guest fees, tax, rental revenue, owner payout, nights
- **Database**: 46 listings already loaded, each with `hostaway_listing_id` matching the CSV's `Listing ID` column
- **Reservations table**: Currently empty — ready for import

## Approach

Use an edge function to parse the CSV server-side, look up each `Listing ID` → `listings.id` via `hostaway_listing_id`, and batch-insert into `reservations`.

## 1. Database Migration

Add two columns the CSV provides but the current schema lacks:

```sql
ALTER TABLE reservations ADD COLUMN owner_payout numeric;
ALTER TABLE reservations ADD COLUMN guest_fees numeric;
```

These are useful for owner reporting later.

## 2. Edge Function: `import-reservations`

- Accepts the CSV as text in the request body
- Parses each row (skipping the totals row at the end where Guest = "0")
- Looks up `listing_id` from `listings` by matching `hostaway_listing_id` to the CSV's `Listing ID`
- Maps columns:
  - `guest_name` ← Guest
  - `check_in` ← Check-in date
  - `check_out` ← Check-out date
  - `total_amount` ← rentalRevenue
  - `owner_payout` ← Owner payout
  - `guest_fees` ← Total guest fees
  - `platform` ← "hostaway" (default, since this is a Hostaway export)
  - `status` ← "confirmed"
- Batch upserts (to be safe on re-runs) using a unique constraint on `(listing_id, check_in, guest_name)`
- Returns count of inserted/skipped rows

## 3. Trigger the Import

Invoke the edge function with the CSV content to load all 2,471 reservations.

## 4. Verify

Query the database to confirm row count and spot-check a few records.

## File Summary

| File | Action |
|------|--------|
| Database migration | Add `owner_payout` and `guest_fees` columns to `reservations` |
| Database migration | Add unique constraint on `(listing_id, check_in, guest_name)` |
| `supabase/functions/import-reservations/index.ts` | New edge function |
| Invoke edge function | One-time call with CSV data |

