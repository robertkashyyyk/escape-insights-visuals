

# Plan: Occupancy Heatmap Page

## Overview

New `/heatmap` route showing a visual matrix — properties on Y-axis, months on X-axis, cells colored by occupancy percentage. Year toggle at top.

## 1. Data Hook: `src/hooks/useOccupancyHeatmap.ts`

- Accepts `year: number`
- Queries all `listings` (id, name) and `reservations` for that year
- For each listing × month, calculates: `nights / days_in_month × 100`
- Returns `{ listings: { id, name, months: number[] }[] }` — 12 values per listing

## 2. Page: `src/pages/OccupancyHeatmap.tsx`

**Header:** Title + year selector (ChevronLeft / year / ChevronRight)

**Heatmap grid:**
- Left column: property names (sticky)
- 12 month columns (Jan–Dec)
- Each cell shows occupancy % as text, with dynamic background:
  - `< 40%` → red/warning tint (`bg-red-500/20` to `bg-red-500/40`)
  - `40–75%` → amber/neutral tint (`bg-amber-500/20` to `bg-amber-500/30`)
  - `> 75%` → green/accent tint (`bg-emerald-500/30` to `bg-emerald-500/50`)
- Smooth color interpolation using inline `rgba` styles based on exact value
- Horizontally scrollable on mobile with sticky property name column

**Loading:** Skeleton rows while data fetches

## 3. Route & Nav

- `src/App.tsx`: Add `/heatmap` route with `ProtectedRoute` (all roles)
- `src/components/layout/AppSidebar.tsx`: Add "Occupancy Heatmap" after "YoY Performance" with `Grid3X3` icon

## File Summary

| File | Action |
|------|--------|
| `src/hooks/useOccupancyHeatmap.ts` | New — query + aggregate occupancy by listing × month |
| `src/pages/OccupancyHeatmap.tsx` | New — heatmap page with year toggle |
| `src/App.tsx` | Add `/heatmap` route |
| `src/components/layout/AppSidebar.tsx` | Add nav item after YoY |

