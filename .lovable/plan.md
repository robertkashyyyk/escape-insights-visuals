## Goal

Make every number on `/owner` defensible against the underlying reservations table. Today the headers don't tie to the property cards, occupancy can exceed 100%, and overlapping/duplicate Hostaway rows quietly inflate counts.

## Root causes I found in the data

1. **Aggregate vs cards mismatch (1 booking / 4 nights off in May).** Header KPIs use raw reservations (bundle counted once). Property cards use expanded reservations (bundle counted on each component). The sum will always differ by `(components − 1) × bundle stays`.
2. **Duplicate / overlapping reservations on the same listing.** Lily's Pad has Mark 1–4 May *and* Shannon 2–4 May on the same unit (both `status='confirmed'`). Likely a Hostaway sync artefact (channel duplicate, owner block, or pending→confirmed dupe). Currently both count, which is why Lily shows 31 nights / 100% in a 31-day month.
3. **Nights are summed literally, not clipped to the period.** A reservation 30 Apr → 2 May contributes 2 nights to the May card even though only 1 night is in May. Same at month edges and across years.
4. **No visibility for the owner.** They can't see *which* reservations make up the numbers, so when something looks off there's no way to verify.

## What I'll change

### A. One source of truth for both views (`src/hooks/useOwnerPortalData.ts`)
- Build a single `expandedReservations` list (bundle → components, revenue split by `split_pct`).
- Header KPIs and property cards both aggregate from the **same** expanded list. They will tie by construction. Header bookings will go up slightly (each bundle stay counts as 1 per component) — this matches what the owner sees on the cards.

### B. Dedupe overlapping reservations per listing
- For each listing, sort confirmed reservations by `check_in`. If two share the same dates ±1 day on the same listing, keep the one with the higher `total_amount` (real booking) and drop the other (likely sync dupe). Log dropped ones in dev console.
- This will collapse Lily's Mark/Shannon and Holly/Holly Johnston pairs.

### C. Clip nights to the visible period
- `nightsInPeriod = max(0, min(check_out, periodEnd+1) − max(check_in, periodStart))`.
- Stops cross-month bleed (Laura 30 Apr → 2 May = 1 night in May, not 2).
- Occupancy denominator stays `periodDays × componentListings.length`; with clipped nights it can no longer exceed 100% via overlap.

### D. Status hygiene
- Filter at SQL level: `status='confirmed'` only (already done) **and** exclude any with `total_amount IS NULL OR total_amount = 0` from revenue, but keep their nights (with a dev warning). Prevents free/blocked stays from polluting ADR.

### E. Transparency: "View reservations" drawer per property
- Small link under each property card → opens a drawer listing every reservation that made up that card's numbers for the selected period, with: guest, dates, nights-in-period, revenue (and `× factor` for bundle splits), source platform, and a "duplicate of" badge for ones we dropped.
- The owner can sanity-check the numbers themselves. This is the most important trust-rebuilding piece.

### F. "Last synced" + sanity banner
- Show the most recent `sync_logs.completed_at` at the top of `/owner` so the owner knows how fresh the data is.
- If we detected & dropped duplicates for this owner in the current period, show a small amber note: *"3 duplicate reservations from Hostaway were excluded — view details"*.

## What I will not touch in this pass

- The underlying Hostaway sync (the duplicates come from upstream — fixing there is a separate, larger task).
- Statements / payouts maths.
- The other internal dashboards (Today, Pricing, etc.) — they have their own hooks.

## Files changed

- `src/hooks/useOwnerPortalData.ts` — single-source aggregation, dedupe, clip-to-period.
- `src/pages/OwnerPortal.tsx` (or wherever the cards render) — add "View reservations" link + sanity banner.
- New: `src/components/owner/OwnerReservationsDrawer.tsx` — drawer with per-card reservation list.

## Verification before I hand it back

For May 2026 / Kashyyyk I'll print and check:
- Header bookings = Ernie + Lily + Mabel cards (exactly).
- Lily occupancy ≤ 100%, nights ≤ 31.
- Drawer for Lily lists 9 (or 8 after dedupe) confirmed stays + Luke's bundle stay, with nights-in-period summing to the card's nights.
- Header nights = sum of card nights.
