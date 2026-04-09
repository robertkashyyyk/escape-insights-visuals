

## Plan: Clean Slate for Hostaway Sync

### What we're doing
1. **Delete all 2,459 existing reservations** from the database so the Hostaway sync can repopulate from scratch with proper `hostaway_reservation_id` keys — no deduplication headaches.
2. **Remove the Upload Data feature** entirely since the Hostaway API sync replaces manual CSV imports.

### Step 1 — Delete all reservations
Use the Supabase data tool to run:
```sql
DELETE FROM reservations;
```
This clears the table so the first Hostaway sync writes clean data with proper IDs.

### Step 2 — Remove Upload Data page and references
Files to modify:
- **Delete** `src/pages/UploadData.tsx`
- **`src/App.tsx`** — Remove the UploadData import and `/upload` route
- **`src/components/layout/AppSidebar.tsx`** — Remove the "Upload Data" nav item (line 75) and the `Upload` icon import
- **`src/components/orin/OrinChatPanel.tsx`** — Remove `/upload` from the route map (line 28)

### Step 3 — Update references to uploading
- **`src/pages/FuturePipeline.tsx`** — Change the empty-state message and button from "Upload a CSV" / link to `/upload` → "Connect Hostaway in Settings → Integrations to sync your bookings" with a link to `/settings`
- **`src/components/settings/HostawayApiKeyForm.tsx`** — Update description text that mentions "manual CSV uploads"
- **`src/components/landing/FeaturesSection.tsx`** — Update the "Seamless Ingestion" feature description from CSV upload language to API sync language
- **`src/components/landing/PricingSection.tsx`** — Change "Basic dashboard & CSV uploads" to "Basic dashboard & API sync"

### What stays
- The `upload_batches` table — it's still used by the Hostaway sync to log each run
- The Hostaway sync edge function and "Sync Now" button in Settings

