# Escape Grids — Feature Spec (from meeting)

Discrete work items derived from the planning meeting. Each item: Summary → Data
model → UI/flow → Logic & validation → Open questions. Shared concepts live in the
Glossary. `[ASSUMPTION]` = something we inferred; `[DECISION NEEDED]` = needs a
product decision before/while building.

This is tracked against the live build. **Build status** per item is noted at the
top of each section.

---

## Glossary & cross-cutting concepts

- **Region / Zone** — one concept. In this codebase it is `listings.location_group`
  (text, managed via `location_groups` / Settings → General → Location Groups).
- **Communal** — shared facilities/costs across multiple properties (vs Self-Contained).
- **Communal Group** — a named grouping of properties that share communal costs.
  A property belongs to **exactly one** group; its share lives on the property record.
  *(Distinct from Region.)*
- **Communal Ratio %** — each property's fixed share of a communal cost. Across a
  group the ratios must sum to **exactly 100%** (hard rule). Allocation = `bill × ratio%`.
- **Turnover** — a single changeover/clean between bookings.
- **Billable / Non-billable** — outcome flag on a completed task; drives owner report.
- **"Are you sure?" pattern** — confirmation modal before any irreversible/billing action.

---

## Build status summary

| # | Item | Status |
|---|------|--------|
| 5 | Per-property records (fees, communal flag, share) | ✅ Built |
| 6 | Communal Group | ✅ Built |
| 7 | Maintenance task list (+Setup, +scope) | ✅ Built |
| 9 | Maintenance manual add | ✅ Built |
| 2 | Requests + cleaner reminder | ✅ Built |
| 3 | Laundry per-region rate | ⏳ Planned |
| 4 | Consumables (+communal type) | ⏳ Planned |
| 10 | Utilities expenses tab | ⏳ Planned |
| 8 | Welcome Baskets / Seasons | ⏳ Planned |
| 1 | Hostnote/Guestnote/Custom Field (Hostaway) | ⏳ Planned (gated on creds) |

---

## 5. Per-property records — ✅ Built

Fields added to `listings`: `cleaning_fee`, `deep_fee`, `is_communal`,
`communal_ratio_pct`, `communal_group_id` (FK → `communal_groups`).
`communal_ratio_pct` is only meaningful when `is_communal = true`. Across a communal
group the shares must total exactly 100% — enforced in the Communal Groups manager.

Migration: `supabase/migrations/20260603132504_communal_groups_and_property_fields.sql`.
UI: `src/components/properties/PropertyForm.tsx` (fees + Communal section).

## 6. Communal Group — ✅ Built

New table `communal_groups (id, name, notes, timestamps)`. Property → group via single
FK on `listings.communal_group_id` (`ON DELETE SET NULL`). Allocation = `bill_total ×
(communal_ratio_pct / 100)`.

Worked example: a £100 communal bill across 9 properties — 8 at 10% and 1 at 20%
(sums to 100%) — bills the eight £10 each and the ninth £20.

UI: `src/components/settings/CommunalGroupsSettings.tsx` (Settings → General). Manages
groups, membership, per-member share editing, even-split helper, and **hard-blocks
saving shares unless the group totals exactly 100%**. Helper: SQL function
`communal_group_ratio_sum(uuid)`.

## 7. Maintenance task list (+ Setup type, + communal/by-property) — ✅ Built

New table `maintenance_tasks` (migration `20260603134502_maintenance_tasks.sql`):
`type` (maintenance|setup), `scope` (property|communal, with a CHECK enforcing the
matching FK), `status` (pending→accepted→done | postponed), `billable` + `cost` set on
completion, `source` (manual|welcome_basket). Lifecycle actions Accept / Done / Postpone.
Done → choose Billable/Non-billable → "Are you sure?" confirm (AlertDialog). Setup uses the
same flow (type flag only). Billable tasks feed the owner report; communal billable tasks
allocate cost across the group by Communal Ratio % (allocation applied at report time).

UI: `src/pages/MaintenanceQueue.tsx` now has an outer **Issues | Tasks** split; the Tasks
board is `src/components/maintenance/MaintenanceTasksPanel.tsx` (hook
`src/hooks/useMaintenanceTasks.ts`).

[ASSUMPTION] Added a `pending` status so the **Accept** action is meaningful (spec listed
only accepted/done/postponed). Manually-added tasks start `pending`.

## 9. Maintenance → manual task add — ✅ Built

"Add task" button in the Tasks board opens a form (title, description, type, scope,
property/communal group) and inserts with `source = manual`.

## 2. Requests (e.g. High Chair, Cot) + cleaner reminder — ✅ Built

Tables `requests` (catalogue: name, icon, active) + `booking_requests`
(reservation_id, request_id, quantity, unique per pair) — migration
`20260603151355_requests.sql`. Seeded High Chair / Cot / Travel Cot / Extra Towels.
- Catalogue admin: `src/components/settings/RequestsSettings.tsx` (Settings → General).
- Add to a booking: `src/components/requests/BookingRequestsDialog.tsx`, opened from the
  Requests column in `ReservationsTable` (shows a count badge).
- Cleaner: request chips on the job card + two-step completion — `handleCompleteClick`
  shows a reminder modal listing the booking's requests; **"No, not yet" blocks and
  returns to the job** (chosen default), **"Yes, all sorted"** proceeds to the standard
  "Yes, confirm". Icon helper: `src/lib/requestIcon.tsx`.
- RLS: cleaners can read requests for reservations they're assigned to clean.
- [DEFERRED] Push notification on add — visibility is icon-driven on the job for v1.

## 3. Laundry — per-region rate + per-turnover charge — ⏳ Planned

Flat £-per-turnover rate assigned to region(s); a charge accrues per turnover for each
property in an assigned region; surfaced per property and on the owner report.

## 4. Consumables — per turnover/booking, per property + type — ⏳ Planned

Same pattern as laundry. Extend allocation type with `communal` (allocate via Communal
Ratio % across the group).

## 10. Expenses → "Utilities" tab — ⏳ Planned

`UtilityExpense (type, date, value, [property + attribution_pct])`. Default even split
across selected properties; ratios sum to 100%.

## 8. Settings → "Welcome Baskets" tab — ⏳ Planned

User-defined Seasons stored as month/day ranges that tile the year with no gaps/overlaps
(validator treats the year as a 365/366 loop). A booking mapped by **check-in date** to a
season, with revenue over that season's threshold, creates a `welcome_basket` Maintenance
task.

## 1. Hostnote / Guestnote / Custom Field on a booking — ⏳ Planned (gated)

Pull `hostNote` / `guestNote` / `customFieldValues` from the Hostaway reservation onto our
booking record. Requires `includeResources=1`, OAuth client-credentials, `afterId`
pagination. Map `customFieldId → name` via the custom-field definitions. Read-only first.

---

## Consolidated decisions still open

- **Hostaway sync** — read-only vs two-way; which custom fields to surface; webhook vs polling (1).
- **Requests reminder on "No"** — block vs log vs loop (2). *Suggest: block + return to job.*
- **Consumables cadence** — confirm a cost generates on each changeover (4).
- **Setup vs Maintenance** — functional difference; does Postpone need a date/reason? (7).
- **Utilities attribution** — editable custom ratios vs even-split-only; do communal selections
  defer to Communal Ratio % or stay independent? (10).
- **Laundry edge case** — multiple rates on one region: sum or prevent? *Suggest: prevent* (3).
