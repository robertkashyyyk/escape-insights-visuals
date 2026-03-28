

# Plan: Dynamic Dashboard Date Filtering

## Problem
The DateFilter is cosmetic — clicking Week/Month/Quarter/Year does nothing. All KPIs, the revenue chart, and top properties are hardcoded. There's no way to change year or pick a custom date range.

## Approach

All dashboard data will be queried live from the `reservations` table (joined with `listings` and `property_owners`), filtered by a date range derived from the user's selection.

## 1. Redesigned DateFilter Component

Replace the current static filter with a full date control:

- **Period presets**: Year, Quarter, Month, Week (same toggle buttons)
- **Period selector**: When "Quarter" is active, show a dropdown with Q1/Q2/Q3/Q4. When "Month" is active, show Jan–Dec. When "Week" is active, show Week 1–52. When "Year" is active, just show the year.
- **Year selector**: Left/right arrows to change year (2025 ← → 2026)
- **Custom range**: A "Custom" option that opens a date range picker (two calendars via shadcn Popover + Calendar) to select any start/end date
- **Output**: Emits a `{ from: Date, to: Date }` range that all child components consume

## 2. New Hook: `useDashboardData`

**`src/hooks/useDashboardData.ts`** — accepts `{ from: Date, to: Date }` and queries Supabase:

- Fetches `reservations` where `check_in` or `check_out` overlaps the date range, joined with `listings` (name, owner_id, bedrooms) and `property_owners` (name)
- Computes from the filtered reservations:
  - **Total Revenue**: sum of `total_amount`
  - **Reservations count**
  - **Nights Booked**: sum of nights per reservation (check_out - check_in)
  - **Avg Daily Rate**: total_revenue / nights_booked
  - **Avg Occupancy**: nights_booked / (total_listings × days_in_range)
  - **Revenue by time bucket**: grouped by month/week/quarter depending on active period, for the chart
  - **Top Properties**: ranked by revenue within the range
- Returns `{ kpis, chartData, topProperties, isLoading }`

## 3. Dashboard Page Wiring

**`src/pages/Dashboard.tsx`**:
- Lift date range state: `const [dateRange, setDateRange] = useState({ from, to })` defaulting to current year
- Pass `dateRange` to `useDashboardData` hook
- Pass computed KPIs to `KpiCard` components (no more hardcoded values)
- Pass `chartData` to `RevenueChart`
- Pass `topProperties` to `TopProperties`
- Pass `dateRange` + `setDateRange` to `DateFilter`

## 4. Updated Child Components

- **KpiCard**: No structural change — just receives dynamic values instead of hardcoded strings
- **RevenueChart**: Remove hardcoded data arrays; accept `chartData` and `periodType` as props. Chart labels adapt (months vs weeks vs quarters)
- **TopProperties**: Remove hardcoded array; accept `topProperties` prop. Same UI, live data.

## File Summary

| File | Action |
|------|--------|
| `src/components/dashboard/DateFilter.tsx` | Rewrite — presets, year nav, period dropdowns, custom range picker |
| `src/hooks/useDashboardData.ts` | New — queries reservations, computes KPIs/chart/top properties |
| `src/pages/Dashboard.tsx` | Rewrite — lift state, wire hook to all components |
| `src/components/dashboard/RevenueChart.tsx` | Rewrite — accept data as props, adapt labels to period type |
| `src/components/dashboard/TopProperties.tsx` | Rewrite — accept data as props |
| `src/components/dashboard/KpiCard.tsx` | Minor — no structural change, already accepts dynamic props |

## Design
- DateFilter stays in the header row, responsive (wraps on mobile)
- Custom date range uses shadcn Popover + Calendar with `pointer-events-auto`
- Loading skeletons on KPI cards and charts while data fetches
- Period dropdown uses shadcn Select component
- Year navigation with ChevronLeft/ChevronRight buttons

