

# Plan: Management Revenue Dashboard

## Overview

New `/management` route showing agency revenue — calculated as each reservation's `total_amount × owner.management_rate_pct / 100`. Includes a YTD KPI card, monthly line chart, and top 10 most profitable properties for the agency.

## 1. Data Hook: `src/hooks/useAgencyRevenue.ts`

- Queries `reservations` with `listings(name, city, location_group, owner_id)` for current year
- Queries `property_owners` to get `management_rate_pct` per owner
- For each reservation: `agencyRevenue = total_amount × (management_rate_pct / 100)`
- Computes:
  - **Total Agency Revenue YTD**: sum of all agency revenue
  - **Monthly buckets**: 12 months, agency revenue per month (for line chart)
  - **Top 10 properties**: grouped by listing, sorted by agency revenue descending
- Returns `{ totalYTD, monthlyData, topProperties, isLoading }`

## 2. Page: `src/pages/ManagementRevenue.tsx`

**Header**: "Management Revenue" title

**Large KPI card**: Total Agency Revenue YTD — uses `KpiCard` component with `DollarSign` icon, prominent styling

**Line chart**: Recharts `LineChart` (not bar — differentiates from the main dashboard) showing agency revenue month-by-month. Glassmorphic card wrapper. Custom tooltip with £ formatting.

**Top 10 table**: Glassmorphic card with shadcn `Table` — columns: Property Name, Location, Total Revenue, Agency Revenue, Management %. Sorted by agency revenue descending.

**Loading**: Skeletons while data fetches.

## 3. Route & Nav

- `src/App.tsx`: Add `/management` route with `ProtectedRoute` restricted to `super` and `senior` roles
- `src/components/layout/AppSidebar.tsx`: Add "Management Revenue" nav item with `Briefcase` icon, visible to `super` and `senior` only, positioned after Upload Data

## File Summary

| File | Action |
|------|--------|
| `src/hooks/useAgencyRevenue.ts` | New — agency revenue aggregation |
| `src/pages/ManagementRevenue.tsx` | New — KPI, line chart, top 10 table |
| `src/App.tsx` | Add `/management` route |
| `src/components/layout/AppSidebar.tsx` | Add nav item |

