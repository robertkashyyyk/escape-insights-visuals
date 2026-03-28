

# Plan: Supabase Connection + Properties Management

## Step 1: Connect Your Supabase Project
Use the Lovable Supabase integration panel (top-right button or Settings → Integrations) to connect `https://pftqjrmdksrrpczhomln.supabase.co`. You'll need your Supabase project's **anon key** and **URL**.

## Step 2: Create Database Schema (Migrations)
Create all four tables via Supabase migrations:

- **property_owners** — id, name, email, phone, company_name, management_rate_pct, notes, created_at
- **listings** — id, hostaway_listing_id, name, owner_id (FK → property_owners), city, postcode, latitude, longitude, bedrooms, max_guests, tags (text[]), location_group, min_rate, base_rate, active, created_at
- **reservations** — id, hostaway_reservation_id, listing_id (FK → listings), guest_name, check_in/out dates, reservation_date, nights, revenues, derived date fields, upload_batch_id (FK), created_at
- **upload_batches** — id, uploaded_at, filename, row_count, date_range_start, date_range_end

Enable RLS on all tables with authenticated-user policies (select, insert, update, delete).

## Step 3: Build Properties Page
Replace the placeholder Properties page with a full listing management view:

- **Listing cards grid** — glassmorphism cards showing: property name, city, location group, tags (pill badges), bedrooms, max guests, active status
- **Add Listing form** — dialog/sheet with fields for all listing attributes, owner dropdown
- **Edit Listing** — click a card to edit its details
- **Owner selector** — dropdown populated from property_owners table
- **Search/filter** — filter by location group, city, or tags

## Step 4: Add Property Owners Quick-Add
- Simple form to create property owners (accessible from the Owners page or inline when adding a listing)
- Owner dropdown on listing form auto-refreshes after adding a new owner

## Technical Details
- Supabase client initialized via `@supabase/supabase-js` with project URL and anon key
- React Query for data fetching/caching
- All CRUD operations via Supabase client with proper error handling and toast notifications
- Forms use react-hook-form + zod validation
- Premium card design consistent with existing glassmorphism style

