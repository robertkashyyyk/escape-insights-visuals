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
| 3 | Laundry per-region rate | ✅ Built (owner-statement rollup pending statements feature) |
| 4 | Consumables (+communal type) | ✅ Built (owner-statement rollup pending statements feature) |
| 10 | Utilities expenses tab | ✅ Built |
| 8 | Welcome Baskets / Seasons | ✅ Built |
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

## 3. Laundry — BY BED TYPE (per turnover) — ✅ Built

**Refined: laundry is priced by bed type, not region.** `bed_types` (name, laundry_cost)
+ `property_beds` (listing, bedroom_label, bed_type, quantity) — migration
`20260603162954_bed_type_laundry.sql`. A property's laundry per turnover =
Σ(bed_type.laundry_cost × quantity); the `generate_turnover_charges` trigger computes it
from the bed inventory (region laundry_rates tables retained but no longer drive
generation). UI: per-property **Bedrooms & Beds** editor in PropertyForm (edit mode,
`PropertyBedsEditor.tsx`); **Bed-Type Laundry Costs** config in Expenses → Set Rates.
Owner-report **Laundry** card now also includes existing `expense_laundry_allocations`
(actual supplier bills) so historical data shows. (Original region-rate notes below.)

### 3 (original) — per-region rate

Migration `20260603154350_laundry_consumable_rates.sql`. `laundry_rates` (£/turnover) +
`laundry_rate_regions` (→ region/location_group) + generated `laundry_charges`
(one per turnover, unique on clean_task_id). **Generation:** a SECURITY DEFINER trigger
`generate_turnover_charges()` on `clean_tasks` AFTER UPDATE OF status fires when a clean
transitions to `completed`; it's exception-wrapped so a billing-accrual error can never
block clean completion. One active rate per region (enforced in the config UI).
UI: Expenses → **Set Rates** tab (`src/components/expenses/TurnoverRatesTab.tsx`):
Laundry Rates config (amount + region chips, overlap-blocked), and a per-property
**Accrued charges** table by month. Owners have RLS read on `laundry_charges`.

## 4. Consumables — per turnover/booking, per property + type — ✅ Built

Same migration/engine. `consumable_rates` (type `direct_to_property` / `region` /
`communal`, with a CHECK that the matching target is set) + generated `consumable_charges`.
The trigger generates: direct → 1 row (the property); region → 1 row if the property is in
that region; **communal → one row per group member = amount × Communal Share %**.
UI: Consumable Rates config in the same Set Rates tab. Owners have RLS read on charges.

> Owner-statement rollup (both items): the accruals are staff-visible now and
> owner-readable via RLS, but `OwnerStatements.tsx` is currently a stub — line-iteming
> these onto an owner invoice is deferred to the (separate) owner-statements feature.

## 10. Expenses → "Utilities" tab — ✅ Built

Migration `20260603161312_utility_expenses.sql`: `utility_expenses` (type/date/value) +
`utility_expense_allocations` (listing, attribution_pct, amount, denormalised
expense_date). UI: Expenses → **Utilities** tab (`src/components/expenses/UtilitiesTab.tsx`)
— type (with suggestions), date, value, multi-select properties, **even-split-by-default
attribution that recalculates as properties change and is editable; hard-blocks save
unless it totals 100%**. [DECISION taken] custom ratios editable; utilities stay
independent of the Communal Ratio % (even-split default regardless of communal status).
Feeds the owner-report **Utilities** card (now a real figure, no longer "—").

## 8. Settings → "Welcome Baskets" tab — ✅ Built

Migration `20260603164657_welcome_baskets_seasons.sql`: `seasons` (name, start/end month+day,
spend_threshold) seeded with a tiling set (Winter/Spring/Easter/Early Summer/Summer/Autumn/
Christmas). UI: Settings → **Welcome Baskets** (`WelcomeBasketsSettings.tsx`) with a live
**no-gap/no-overlap validator over a 365-day loop** (mmdd wrap supported) that hard-blocks
Save. Trigger `tg_create_welcome_basket` fires AFTER INSERT on reservations (new bookings
only, so historical/re-sync never mass-creates): maps check-in by mmdd to a season; if
revenue > threshold, creates a `welcome_basket` setup task linked to the reservation
(idempotent via partial unique index). Exception-wrapped so it can't block sync. Added
`maintenance_tasks.reservation_id`. Populates the owner-report Welcome Baskets card.

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
