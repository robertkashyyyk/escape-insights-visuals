

# Plan: Build Out Core App Pages

All the tasks from the previous plan are still in the queue. Here's the full implementation covering Properties, Owners, Reservations, Settings (Hostaway key), and a database migration for the `app_settings` table.

## 1. Database Migration

Create an `app_settings` table for storing the Hostaway API key (and future settings):

```sql
CREATE TABLE app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_by uuid,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super can manage settings"
  ON app_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super'))
  WITH CHECK (has_role(auth.uid(), 'super'));
```

## 2. Properties Page

**`src/pages/Properties.tsx`** — Rewrite with full data table and add/edit functionality.

**`src/components/properties/PropertiesTable.tsx`** — Fetches `listings` joined with `property_owners` (owner name). Columns: Name, Location Group, City, Postcode, Owner, Bedrooms, Bathrooms, Max Guests, Nightly Rate, Status. Includes search input.

**`src/components/properties/PropertyForm.tsx`** — Sheet (slide-over) form for Add/Edit. Fields: Name, Owner (dropdown), Hostaway Listing ID, Address, City, Postcode, Country, Location Group, Property Type, Bedrooms, Bathrooms, Max Guests, Nightly Rate, Min Rate, Base Rate, Tags, Status. Uses `supabase.from('listings').insert()` / `.update()`.

## 3. Owners Page

**`src/pages/Owners.tsx`** — Rewrite with data table and add/edit.

**`src/components/owners/OwnersTable.tsx`** — Fetches `property_owners` with listing count (secondary query). Columns: Name, Company, Email, Phone, Management Rate %, Listing Count.

**`src/components/owners/OwnerForm.tsx`** — Sheet form for Add/Edit. Fields: Name, Company, Email, Phone, Management Rate %, Notes.

## 4. Reservations Page

**`src/pages/Reservations.tsx`** — New page with `AppLayout` wrapper.

**`src/components/reservations/ReservationsTable.tsx`** — Fetches `reservations` with listing name via join. Columns: Guest Name, Property, Check-in, Check-out, Nights (computed), Total Amount, Platform, Status. Sortable by date, searchable.

**`src/App.tsx`** — Add `/reservations` route (protected, all roles).

**`src/components/layout/AppSidebar.tsx`** — Add "Reservations" nav item with `CalendarDays` icon between Dashboard and Properties, accessible to all roles.

## 5. Settings — Hostaway API Key

**`src/components/settings/HostawayApiKeyForm.tsx`** — Card with password input for Hostaway API key and Save button. Reads/writes from `app_settings` table (`key = 'hostaway_api_key'`). Uses upsert.

**`src/pages/SettingsPage.tsx`** — Add `HostawayApiKeyForm` below the existing `InviteUserForm`.

## File Summary

| File | Action |
|------|--------|
| Database migration | Create `app_settings` table |
| `src/pages/Properties.tsx` | Rewrite |
| `src/components/properties/PropertiesTable.tsx` | New |
| `src/components/properties/PropertyForm.tsx` | New |
| `src/pages/Owners.tsx` | Rewrite |
| `src/components/owners/OwnersTable.tsx` | New |
| `src/components/owners/OwnerForm.tsx` | New |
| `src/pages/Reservations.tsx` | New |
| `src/components/reservations/ReservationsTable.tsx` | New |
| `src/App.tsx` | Add `/reservations` route |
| `src/components/layout/AppSidebar.tsx` | Add Reservations nav item |
| `src/pages/SettingsPage.tsx` | Add Hostaway section |
| `src/components/settings/HostawayApiKeyForm.tsx` | New |

## Design

All pages use the existing dark theme, glassmorphic cards, shadcn Table/Sheet/Card components. Loading skeletons while fetching. Toast notifications for CRUD results. Forms validate required fields client-side.

