

## Fix: Dynamic Year Filter for Reservations Table

### Problem
The Reservations page has hardcoded year options (2025, 2026), but the database contains reservations from 2021–2027.

### Other Pages Checked
- **Dashboard DateFilter** — uses chevron arrows to increment/decrement year freely. No issue.
- **YoY Performance** — same chevron pattern. No issue.
- **Owners** — same chevron pattern. No issue.
- **Revenue Pacing** — uses month tabs, no year dropdown. No issue.

Only the Reservations table needs fixing.

### Fix
Derive year options dynamically from the fetched reservation data. After processing all rows, extract the distinct years present and build the dropdown options from that set, sorted ascending.

### Changes
**`src/components/reservations/ReservationsTable.tsx`** (single file)
- After `processedRows` is computed, derive `yearOptions` from `new Set(processedRows.map(r => r.year))`, sorted ascending.
- Replace the hardcoded `[2025, 2026]` options array with the dynamic list.

