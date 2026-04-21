# Escape Grids — App Guide

This guide describes how to use the Escape Grids platform. Use it to answer "how do I…" questions. Always cite the route (e.g. `/operations/schedule`) and give concrete click-by-click steps.

---

## Today (`/today`)
- Roles: super, senior, admin
- The default landing page for staff. Shows today's checkouts, check-ins, and open issues at a glance.
- To resolve an open issue: scroll to "Open Issues" → click the issue card → choose Acknowledge or Resolve.

## Dashboard (`/dashboard`)
- Roles: super, senior, admin
- High-level KPIs: revenue, occupancy, ADR, top properties, revenue chart.
- To change the date range: use the Date Filter dropdown at the top right.

## Orin Intelligence (`/orin`)
- Roles: super, senior, admin
- Full-page Orin chat with daily/weekly briefs.
- Orin is also available everywhere via the floating button (bottom right).

## YoY Performance (`/yoy`)
- Roles: super, senior, admin
- Side-by-side year-over-year comparison per property.

## Occupancy Heatmap (`/heatmap`)
- Roles: super, senior, admin
- Calendar-style view of occupancy across all properties.

## Pricing Strategy (`/pricing`)
- Roles: super, senior, admin
- Per-property nightly rate, base rate and minimum rate review.

## Reservations (`/reservations`)
- Roles: super, senior, admin
- Full reservation list with filters (property, platform, date range, status).
- Data is synced from Hostaway — to force a fresh sync go to `/sync-health`.

## Future Pipeline (`/pipeline`)
- Roles: super, senior, admin
- Confirmed bookings looking forward (next 30/60/90 days).

## Revenue Pacing (`/pacing`)
- Roles: super, senior, admin
- Current month actual + booked vs same month last year.

## Revenue Forecaster (`/forecast`)
- Roles: super, senior, admin
- Projects revenue forward based on current pace and pipeline.

## Properties (`/properties`)
- Roles: super, senior, admin
- List of all listings. Click a property to open its detail page (`/properties/:id`) for full info, performance and edits.
- To edit a property: open detail → click "Edit" in the property header.

## Property Knowledge (`/property-knowledge`)
- Roles: super, senior, admin
- The internal operational brain — boiler locations, stopcocks, WiFi, cleaning quirks, hot tub schedules per property.
- To search across all properties: use the global search at the top.
- To edit a property's knowledge: click the property card → edit any section inline. Completion score updates automatically.

## Amenities (`/amenities`)
- Roles: super, senior, admin
- Manage local amenities (restaurants, shops, attractions) and link them to properties.
- To link an amenity to a property: open the property's amenities tab → "Link amenity" → pick from list.

## Owners (`/owners`)
- Roles: super, senior
- Manage property owners (clients). Click an owner to see their portfolio and performance.
- To add a new owner: click "Add Owner" top-right → fill the form. To invite them to the Owner Portal: open the owner → "Invite to portal".

## Management Revenue (`/management`)
- Roles: super, senior
- Agency-side revenue (management fees) across all owners.

## Operations — Cleaning Schedule (`/operations/schedule`)
- Roles: super, senior, admin
- Three views: **Day**, **Week**, **Matrix** (toggle top-left).
- Week navigation (Prev / Current Week / Next) is to the right of the view toggle.
- **Filters**: location group chips and cleaner chips at the bottom — click to isolate. Click again to clear. Rows with no matching tasks disappear (not just dim).
- **To regenerate the schedule** (matrix/week view): click "Regenerate Week" — processes all 7 visible days. Toast shows tasks created across the week.
- **To regenerate a single day** (day view): click "Regenerate". For a wider sweep, use the dropdown next to it → "Regenerate next 7 days".
- **To mark a clean complete**: click the task tile → side panel opens → "Mark complete".
- **To reassign a clean**: click the task tile → side panel → change "Assigned cleaner" dropdown.
- **To add a manual clean**: click "Add manual clean" top-right → pick property, date, cleaner.
- **To flag an issue**: open the task → "Flag issue" → describe + add photos.

## Operations — Cleaning Numbers (`/operations/numbers`)
- Roles: super, senior
- Per-cleaner workload, completion rates, and rate-per-clean totals.

## Sync Health (`/sync-health`)
- Roles: super, senior
- Hostaway sync status. To force a manual sync: click "Sync Now" top-right.

## Settings (`/settings`)
- Roles: super only
- Tabs: General, Account, Cleaners, Finance, Integrations.
- **To change Hostaway API key**: Integrations tab → update key.
- **To add a cleaner**: Cleaners tab → "Add cleaner" → fill name, region, location groups, rate.
- **To set sync schedule**: Integrations → choose interval (1/3/6/12/24h).

## Team Management (`/settings/team`)
- Roles: super only
- Invite team members and assign roles.
- To invite a user: "Invite user" → email + role (super/senior/admin/client/cleaner).

## Owner Reports (`/owner-reports`)
- Roles: super, senior
- Monthly statement generator per owner.
- To generate: pick owner + month → review → download/send.

---

## Owner Portal — for clients (`/owner`, `/owner/reservations`, `/owner/statements`, `/owner/graphs`)
- Roles: client
- Read-only portal showing the owner's own properties only.
- **Portfolio** (`/owner`): properties overview + performance.
- **Reservations** (`/owner/reservations`): bookings across the owner's properties.
- **Statements** (`/owner/statements`): monthly income statements.
- **Graphs** (`/owner/graphs`): revenue and occupancy charts.
- To switch property focus: use the property selector at the top of any owner page.

## Cleaner Portal (`/cleaner`)
- Roles: cleaner
- Mobile-friendly view of today's assigned cleans.
- To start a clean: tap the task → "Start". To complete: "Mark complete".
- To flag an issue: tap task → "Flag issue" → photo + note.

## Guest Portal (`/stay/:slug`)
- Public — no login required.
- Per-property guest-facing page with WiFi, check-in instructions, local area, amenities.

---

## Common workflows

**Undo a clean that shouldn't have happened:**
1. Go to `/operations/schedule` → find the task.
2. Click the task → "Remove this clean".
3. Click "Regenerate Week" to refresh the schedule.

**Why is a property showing as "dirty"?**
- A reservation checked out but no clean has been completed yet. Mark the clean complete on `/operations/schedule` to clear it.

**A cleaner left — how do I deactivate them?**
1. `/settings` → Cleaners tab.
2. Find the cleaner → toggle "Active" off.
3. Reassign their open tasks on `/operations/schedule`.

**An owner can't log in:**
1. `/owners` → open the owner → confirm email is correct.
2. Click "Invite to portal" to resend the invite.

**Force a fresh Hostaway sync:**
- `/sync-health` → "Sync Now". Wait for the run to complete (status turns green).
