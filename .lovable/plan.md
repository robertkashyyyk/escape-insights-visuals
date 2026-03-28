

# Plan: Future Pipeline (OTB) Dashboard

## Overview

New `/pipeline` route showing only future reservations (check-in >= today). KPI cards, a 6-month forward revenue bar chart, and a grouped upcoming check-ins table.

## 1. Data Hook: `src/hooks/useOTBData.ts`

- Queries `reservations` where `check_in >= today`, joined with `listings(name, city)`
- Computes:
  - **Total Confirmed Future Revenue**: sum of `total_amount`
  - **Total Future Nights**: sum of nights (check_out - check_in) per reservation
  - **Average Lead Time**: average days between today and check_in
  - **Monthly buckets**: next 6 calendar months, revenue per month (for bar chart)
  - **Upcoming 14 days**: reservations with check_in within next 14 days, grouped by property name
- Returns `{ totalRevenue, totalNights, avgLeadTime, monthlyData, upcomingByProperty, isLoading }`

## 2. Page: `src/pages/FuturePipeline.tsx`

**Header**: "Future Pipeline (OTB)" title + subtitle

**3 KPI Cards** (row):
- Total Confirmed Future Revenue (DollarSign icon)
- Total Future Nights Booked (CalendarDays icon)
- Average Lead Time (Clock icon)

**Bar Chart**: Recharts `BarChart` — X-axis: next 6 months, Y-axis: confirmed revenue. Glassmorphic card wrapper, custom tooltip with GBP formatting. Uses the same styling patterns as existing charts.

**Upcoming Check-ins Table**: Glassmorphic card with shadcn `Table`. Grouped by property name (property name as a spanning header row). Columns: Guest Name, Check-in, Check-out, Nights, Revenue. Only shows next 14 days.

**Loading**: Skeletons on KPIs and chart while fetching.

## 3. Route & Nav

- `src/App.tsx`: Add `/pipeline` route with `ProtectedRoute` (all roles)
- `src/components/layout/AppSidebar.tsx`: Add "Future Pipeline" nav item with `Telescope` icon, after Reservations

## File Summary

| File | Action |
|------|--------|
| `src/hooks/useOTBData.ts` | New — future reservations aggregation |
| `src/pages/FuturePipeline.tsx` | New — KPIs, bar chart, grouped table |
| `src/App.tsx` | Add `/pipeline` route |
| `src/components/layout/AppSidebar.tsx` | Add nav item |

