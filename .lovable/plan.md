

# Plan: Owner Portfolios — List/View Toggle + Portfolio Dashboard

## Overview

Add a List/View toggle to the Owners page. List = current table. View = card grid with clickable owner cards that open a detailed portfolio dashboard.

## 1. Owners Page Toggle

**`src/pages/Owners.tsx`** — Add state for `viewMode: "list" | "view"` with a toggle in the header row (using the same button toggle pattern from YoY). Render `OwnersTable` in list mode, new `OwnersCardGrid` in view mode. Both share the same Add Owner button.

## 2. Owner Card Grid

**`src/components/owners/OwnersCardGrid.tsx`** — New component:

- Queries `property_owners` + counts listings per owner (same as OwnersTable)
- Renders responsive grid (1/2/3 cols) of glassmorphic cards
- Each card shows: owner name, company, number of active listings
- Click opens the portfolio dashboard (inline expansion or dedicated sub-view)

## 3. Owner Portfolio Dashboard

**`src/components/owners/OwnerPortfolio.tsx`** — New component shown when an owner card is clicked (replaces the grid, with a back button):

- **Data**: Queries `reservations` joined with `listings` where `listings.owner_id = selectedOwner.id`, filtered to current year
- **KPI Cards** (3 across top):
  - **Total Portfolio Revenue**: sum of `total_amount`
  - **Avg Portfolio Occupancy**: total nights / (listings count × 365) × 100
  - **Blended ADR**: total revenue / total nights
- **Monthly Revenue Bar Chart**: Same Recharts `BarChart` pattern as dashboard, grouped by month for current year
- **Property Breakdown Table**: Each listing's name, revenue contribution, nights, ADR — sorted by revenue descending. Shows percentage of total portfolio revenue.

## 4. Hook

**`src/hooks/useOwnerPortfolio.ts`** — Accepts `ownerId` and `year`, queries reservations + listings, computes all KPIs, monthly chart buckets, and per-property breakdown. Uses `react-query`.

## File Summary

| File | Action |
|------|--------|
| `src/pages/Owners.tsx` | Add List/View toggle state, conditionally render table or cards |
| `src/components/owners/OwnersCardGrid.tsx` | New — card grid with listing counts |
| `src/components/owners/OwnerPortfolio.tsx` | New — portfolio dashboard with KPIs, chart, breakdown |
| `src/hooks/useOwnerPortfolio.ts` | New — data hook for portfolio metrics |

## Design

- Toggle uses the same rounded border button group as YoY period selector
- Cards use `glass-card-hover` class, show owner initials avatar, name, company, listing count badge
- Portfolio dashboard uses existing `KpiCard` component for the 3 KPIs
- Revenue chart reuses the same Recharts pattern from `RevenueChart.tsx`
- Property breakdown uses shadcn `Table` with progress bars showing % contribution
- Back arrow button to return from portfolio to card grid

