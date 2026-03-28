

# Plan: YoY Performance Page

## Overview

A new `/yoy` route showing a grid of property cards, each with Revenue, ADR, and Occupancy for a selected period — plus percentage change badges comparing the same period last year. Cards sorted by highest revenue growth.

## 1. New Hook: `src/hooks/useYoYData.ts`

Accepts `periodType` (Week / Month / Quarter) and `periodValue` (e.g. "Q1", "March", "W10") plus `year` (2026).

- Computes two date ranges: current period and same period in `year - 1`
- Queries `reservations` joined with `listings` for both ranges
- Groups by listing, calculates per-property:
  - **Revenue** (sum of `total_amount`)
  - **ADR** (revenue / nights)
  - **Occupancy** (nights / days-in-period × 100)
- Computes YoY % change for each metric: `((current - previous) / previous) * 100`
- Returns array sorted by revenue growth descending
- Uses `react-query` with the period params as query key

## 2. New Page: `src/pages/YoYPerformance.tsx`

**Header row:**
- Title "YoY Performance"
- Period selector: toggle for Week / Month / Quarter
- Sub-selector: dropdown (Q1–Q4, Jan–Dec, or W1–W52 depending on type)
- Year selector with left/right arrows (same pattern as Dashboard)

**Grid below:**
- Responsive grid: 1 col mobile, 2 cols tablet, 3 cols desktop
- Each card is a glassmorphic card showing:
  - Property name + location
  - Three metric rows: Revenue, ADR, Occupancy %
  - Each metric has current value on left, YoY badge on right
  - Badge: green text + `TrendingUp` icon for positive, red + `TrendingDown` for negative
  - "N/A" badge if no prior year data exists
- Loading skeleton cards while fetching

## 3. Routing & Nav

- `src/App.tsx`: Add `/yoy` route wrapped in `ProtectedRoute` (all roles)
- `src/components/layout/AppSidebar.tsx`: Add "YoY Performance" nav item with `TrendingUp` icon, positioned after Dashboard, available to all roles

## File Summary

| File | Action |
|------|--------|
| `src/hooks/useYoYData.ts` | New — queries both periods, computes metrics + % change |
| `src/pages/YoYPerformance.tsx` | New — period selector + property cards grid |
| `src/App.tsx` | Add `/yoy` route |
| `src/components/layout/AppSidebar.tsx` | Add nav item |

