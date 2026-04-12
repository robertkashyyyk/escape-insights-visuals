

## Plan: Dual Listing Support, Occupancy Fix, and Owner Graphs Page

This covers three distinct features the user requested.

---

### 1. Dual Listing / Bundle Support

**Problem**: "Ernie's Den & Lily's Pad" is a bundle of two other listings. When it sells, the component listings can't sell. Its stats (nights, revenue) should be split across the two component listings, and it shouldn't count as a separate property for occupancy calculations.

**Database change** — Add columns to `listings`:
- `is_bundle` (boolean, default false) — marks a listing as a bundle/dual
- `bundle_parent_id` (uuid, nullable) — on the child listings, points to the bundle listing (or vice versa — see below)

Actually, better approach: store on the **bundle** listing which children it maps to and the split percentages:
- `is_bundle` (boolean, default false)
- `bundle_components` (jsonb, nullable) — e.g. `[{"listing_id": "xxx", "split_pct": 55}, {"listing_id": "yyy", "split_pct": 45}]`

This way the bundle listing carries the mapping. The admin can set this in the property form.

**Hook changes** (`useOwnerPortalData.ts`):
- After fetching listings, identify bundle listings (`is_bundle = true`)
- For occupancy denominator: exclude bundle listings from the property count (so 3 not 4)
- For bundle reservations: distribute nights and revenue to component listings based on `split_pct`
- The bundle property card still shows in the UI but with a "Bundle" badge and a note about split attribution
- Occupancy calculation uses: `nightsBooked / (periodDays * nonBundleListingCount) * 100`

**Property Form** (`PropertyForm.tsx`):
- Add "Is Bundle/Dual Listing" toggle
- When enabled, show a multi-select of other listings owned by the same owner + percentage split fields

---

### 2. Fix Occupancy Calculation for "Booking Date" Mode

Currently occupancy uses the same nights-in-period logic regardless of date mode. When in "Booking Date" mode, the denominator should be `days_in_period × number_of_non_bundle_properties`, and the numerator should be the total nights sold from bookings created in that period (not capped to the period window).

**Changes in `useOwnerPortalData.ts`**:
- When `dateMode === "created"`: numerator = sum of all nights from reservations created in the period (full stay duration, not clipped to period)
- Denominator = `periodDays * nonBundleListingCount`
- This will correctly show 134% in the March example (125 nights / 93 available = 134%)

---

### 3. "My Graphs" Page

**New nav item** in `OwnerLayout.tsx`: "My Graphs" with a chart icon, route `/owner/graphs`.

**New page** `src/pages/owner/OwnerGraphs.tsx`:

**Controls at the top:**
- Metric selector (multi-select, add/remove): 10 options total — Revenue, Bookings, Nights Sold, Occupancy %, ADR — each available in both "by check-in" and "by booking date" variants
- Period selector: Week / Month / Quarter / Year / Custom (date range picker)
- Period navigation (← / →) same as portfolio page
- **Zoom By** selector: Day / Week / Month / Quarter / Year — determines the granularity of chart bars/lines

**Chart rendering:**
- Uses Recharts (already in the project via the chart component)
- Bar or line chart with one series per selected metric
- X-axis labels based on zoom level (e.g., "Jan", "Feb"... for Month zoom; "W1", "W2"... for Week zoom)
- Multiple metrics shown as separate colored series with legend

**Data hook** `src/hooks/useOwnerGraphData.ts`:
- Accepts: selected metrics, period range, zoom granularity, owner context
- Fetches all reservations for the owner's listings in the period
- Buckets data by the zoom interval
- Returns array of `{ label: string, [metricKey]: number }` for Recharts

**Route** in `App.tsx`: `/owner/graphs` → `OwnerGraphs`

---

### Technical Details

**Migration SQL:**
```sql
ALTER TABLE listings
  ADD COLUMN is_bundle boolean NOT NULL DEFAULT false,
  ADD COLUMN bundle_components jsonb DEFAULT NULL;
```

**Files to create:**
- `src/pages/owner/OwnerGraphs.tsx`
- `src/hooks/useOwnerGraphData.ts`

**Files to modify:**
- `supabase/migrations/` — new migration for bundle columns
- `src/hooks/useOwnerPortalData.ts` — bundle-aware occupancy, night splitting
- `src/components/layout/OwnerLayout.tsx` — add "My Graphs" nav item
- `src/App.tsx` — add route
- `src/components/properties/PropertyForm.tsx` — bundle config UI (admin side)
- `src/pages/owner/OwnerPortfolio.tsx` — badge for bundle listings, exclude from occupancy count display

