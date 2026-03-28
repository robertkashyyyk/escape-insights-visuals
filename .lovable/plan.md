

# Plan: Revenue Forecaster Module

## Overview

New `/forecast` route showing a stacked bar chart for the next 3 months. Each bar has a solid OTB (confirmed) portion and a semi-transparent Projected Pickup portion. A KPI badge per month shows the Projected Final Revenue.

## 1. Data Hook: `src/hooks/useRevenueForecaster.ts`

**Inputs**: None (auto-computes next 3 calendar months)

**Logic per month**:

1. **OTB Revenue**: Query confirmed reservations where `check_in` falls in the target month → sum `total_amount`
2. **Historical pickup rate by location group**:
   - For the same month last year, query all reservations (the "final" revenue per location group)
   - Also query reservations for that same month last year where `reservation_date <= (start_of_last_year_month - daysUntilStart)` — i.e. what was on the books at the same lead time
   - `pickupRatio = finalRevenue / otbAtSamePoint` per location group (capped at reasonable bounds)
   - If `reservation_date` is null for historical data, fall back to using all historical revenue as final and current OTB as the baseline (simpler ratio)
3. **Projected pickup**: For each location group's current OTB, multiply by `pickupRatio` to get projected final, then subtract OTB = projected additional pickup
4. **Aggregate across all location groups** per month

**Returns**:
```ts
{
  months: Array<{
    month: string;          // "Apr 2026"
    otbRevenue: number;
    projectedPickup: number;
    projectedFinal: number;
  }>;
  isLoading: boolean;
}
```

**Query strategy**: Fetch listings with `location_group`, current year confirmed reservations for next 3 months, and last year's reservations for same 3 months (with `reservation_date` for the historical curve). Group and compute in JS.

## 2. Page: `src/pages/RevenueForecaster.tsx`

**Header**: "Revenue Forecaster" title + subtitle explaining the projection methodology

**Stacked Bar Chart** (Recharts `BarChart`):
- X-axis: 3 months
- Two stacked `<Bar>` components:
  - `otbRevenue`: solid primary color, label "OTB Revenue"
  - `projectedPickup`: same hue at 40% opacity, label "Projected Pickup"
- Custom tooltip showing OTB, Projected Pickup, and Projected Final
- Legend distinguishing the two segments

**Projected Final KPI cards**: 3 glassmorphic cards (one per month) showing:
- Month name
- Projected Final Revenue (large number)
- OTB vs Pickup breakdown as a mini progress bar
- Confidence indicator (shows "Based on historical data" or "No historical data" if `reservation_date` is missing)

**Loading**: Skeletons while fetching

## 3. Route & Nav

- `src/App.tsx`: Add `/forecast` route with `ProtectedRoute` (all roles), after `/pacing`
- `src/components/layout/AppSidebar.tsx`: Add "Revenue Forecaster" nav item after "Revenue Pacing" with `TrendingUp` icon (or `LineChart` — will use a distinct icon like `Target`)

## Technical Details

- The hook fetches in two batches: current-year future reservations and previous-year reservations for the same 3 months
- Location group grouping ensures properties in different markets use their own historical booking curves
- If no `reservation_date` data exists for last year, the projected pickup defaults to 0 (OTB only) with a visual indicator
- Pickup ratio is clamped between 1.0 and 5.0 to avoid extreme extrapolations from sparse data

## File Summary

| File | Action |
|------|--------|
| `src/hooks/useRevenueForecaster.ts` | New — OTB + historical pickup calculation |
| `src/pages/RevenueForecaster.tsx` | New — stacked bar chart + monthly KPI cards |
| `src/App.tsx` | Add `/forecast` route |
| `src/components/layout/AppSidebar.tsx` | Add nav item |

