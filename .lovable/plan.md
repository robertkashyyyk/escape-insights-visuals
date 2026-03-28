

# Plan: Revenue Pacing Dashboard

## Problem

The `reservations` table has no `reservation_date` column (the date the booking was *made*). Without it, we can't reconstruct the historical booking curve — i.e. "how much revenue was on the books for July 2025, as of 60 days before July 1st." The CSV that was imported earlier contained a "Reservation date" column, but it was not mapped during import.

## Prerequisites

**Migration**: Add `reservation_date date` column to `reservations`. Then backfill from the original CSV data (or accept nulls for now and re-import later).

**Key question**: Do you still have the CSV, or should we just add the column now and backfill later? Without `reservation_date` populated, the pacing comparison won't have historical data to work with. We could use `created_at` as a rough proxy if the CSV data was imported close to the actual reservation dates, but that would be inaccurate.

## Implementation

### 1. Database Migration

- Add `reservation_date date` column to `reservations` (nullable)

### 2. Backfill (one-time script)

- Re-read the original CSV, match reservations by `(listing_id, check_in, guest_name)`, and update `reservation_date` for each row

### 3. Hook: `src/hooks/useRevenuePacing.ts`

Accepts `targetMonth: Date` (e.g. August 2025)

Logic:
- Calculate `daysUntilStart = differenceInDays(startOfMonth(targetMonth), today)`
- **Current year**: Query reservations where `check_in` falls in `targetMonth` — these are already booked. Sum `total_amount` → `currentRevenue`
- **Previous year**: Query reservations where `check_in` falls in the *same month last year* AND `reservation_date <= (startOfSameMonthLastYear - daysUntilStart)` — i.e. bookings that were on the books at the same lead time. Sum `total_amount` → `historicalRevenue`
- Compute `pacingPct = (currentRevenue / historicalRevenue) * 100`
- Also compute the final historical total for that month (all reservations, regardless of reservation_date) → `historicalFinalRevenue`
- Returns `{ currentRevenue, historicalRevenue, historicalFinalRevenue, pacingPct, daysUntilStart }`

### 4. Page: `src/pages/RevenuePacing.tsx`

**Header**: "Revenue Pacing" title

**Month Selector**: Dropdown of the next 6 months (e.g. Apr 2026 – Sep 2026)

**Pacing Gauge**: A visual arc/gauge component showing:
- Current booked revenue vs historical at same point
- Green fill + "Ahead" label if pacing > 100%
- Red fill + "Behind" label if pacing < 100%
- Percentage displayed prominently

**KPI row** (3 cards):
- Current Booked Revenue (for selected month)
- Same Point Last Year
- Final Revenue Last Year (what the month ultimately achieved)

**Progress bar**: Visual bar showing current revenue as % of last year's final, with a marker showing where last year was at this same lead time

### 5. Route & Nav

- `/pacing` route in `App.tsx` (all roles)
- "Revenue Pacing" nav item in sidebar after "Future Pipeline" with `Gauge` icon

## File Summary

| File | Action |
|------|--------|
| Database migration | Add `reservation_date` column |
| One-time backfill | Update existing rows from CSV |
| `src/hooks/useRevenuePacing.ts` | New — pacing comparison logic |
| `src/pages/RevenuePacing.tsx` | New — month selector + gauge + KPIs |
| `src/App.tsx` | Add `/pacing` route |
| `src/components/layout/AppSidebar.tsx` | Add nav item |

