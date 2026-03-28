

# Plan: Pricing Strategy Page

## Overview

New `/pricing` route with a Location Group filter and a grouped bar chart comparing Actual ADR vs Min Rate vs Base Rate across five seasonal buckets.

## 1. Data Hook: `src/hooks/usePricingStrategy.ts`

- Accepts `locationGroup: string | null`
- Queries `listings` filtered by `location_group`, gets their `min_rate` and `base_rate`
- Queries `reservations` for those listings
- Assigns each reservation to a season bucket based on check-in month:
  - **Jan–Mar** (months 1–3)
  - **Shoulder** (months 4, 5, 9)
  - **Summer** (months 6, 7, 8)
  - **Autumn** (months 10, 11)
  - **December** (month 12)
- Per bucket calculates:
  - **Actual ADR**: total revenue / total nights
  - **Avg Min Rate**: average of `min_rate` across matched listings
  - **Avg Base Rate**: average of `base_rate` across matched listings
- Also fetches distinct `location_group` values for the filter dropdown
- Returns `{ data: BucketData[], locationGroups: string[], isLoading }`

## 2. Page: `src/pages/PricingStrategy.tsx`

**Header**: Title "Pricing Strategy" + Location Group `Select` dropdown (defaults to all / first group)

**Chart**: Recharts `BarChart` with:
- X-axis: 5 season buckets
- 3 grouped bars per bucket: Actual ADR (accent color), Avg Min Rate (amber), Avg Base Rate (muted)
- `ChartTooltip` with exact € figures on hover
- Legend below chart
- Glassmorphic card wrapper, responsive

**Loading**: Skeleton while fetching

## 3. Route & Nav

- `src/App.tsx`: Add `/pricing` route with `ProtectedRoute` (all roles)
- `src/components/layout/AppSidebar.tsx`: Add "Pricing Strategy" after "Occupancy Heatmap" with `DollarSign` icon

## File Summary

| File | Action |
|------|--------|
| `src/hooks/usePricingStrategy.ts` | New — seasonal bucket aggregation |
| `src/pages/PricingStrategy.tsx` | New — filter + grouped bar chart |
| `src/App.tsx` | Add `/pricing` route |
| `src/components/layout/AppSidebar.tsx` | Add nav item |

