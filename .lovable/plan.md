

## Plan: Local Amenities + TouchStay Import + 6 Add-Ons

Single build pass covering the original Amenities scope plus the 6 new requirements. Orin enrichment was already done in an earlier loop — I'll verify and extend; the chips are already updated.

### 1. Database migration

Single migration creating:

- `amenity_category` enum (20 values per spec)
- `amenities` table — name, category, address, postcode, lat/lng, phone, website, google_place_id, opening_hours, notes, price_range, rating, tags[], is_active, added_by, timestamps
- `property_amenities` junction — listing_id (uuid), amenity_id (uuid), distance_km, drive_time_mins, walk_time_mins, directions_url, is_featured, display_order, staff_note, timestamps; unique (listing_id, amenity_id)
- `v_property_amenities` view — joined for efficient reads
- RLS:
  - Staff (super/senior/admin) full manage on both
  - Owners read amenities + property_amenities for their own listings (via `owner_owns_listing`)
  - Cleaners read for assigned listings (via `cleaner_assigned_to_listing`)
  - Public anon read on amenities + property_amenities filtered by listing — needed for the unauthenticated `/stay/:slug` Isla route
- `tg_set_updated_at` triggers
- A `slug` column on `listings` (text, unique, nullable) + backfill from `name` so `/stay/:slug` can resolve property cleanly

### 2. Seed data + TouchStay import

After migration, two data inserts (separate approval):

- **Amenities seed**: run the uploaded `amenity_seed_data.sql` (70 real POIs across Fermanagh / North Coast / Belfast / Larne)
- **TouchStay import**: rewritten UPDATE statements mapping parsed JSON to the *real* `property_knowledge` columns:
  - `section_2_access_checkin` → `access_notes`
  - `section_5_heating_hot_water` → `heating_notes`
  - `section_7_wifi` → `wifi_notes`
  - `section_8_bins_recycling` → `recycling_notes`
  - `section_3_checkout` + `section_11_local_area` (flattened) → appended to `general_notes`
  - Match by `name ILIKE` from parsed JSON
  - Skip `section_12` generic welcome text

### 3. Amenities Management UI (`/amenities`)

- `src/pages/Amenities.tsx` — table (Name, Category badge, Postcode, Rating, Active toggle, Edit), category filter dropdown, name search, "Add Amenity" button
- `src/components/amenities/AmenityFormSheet.tsx` — slide-over with all fields per spec (tags as comma-separated)
- `src/components/amenities/CategoryBadge.tsx` — icon + friendly label, colour grouped:
  - **Amber** (food & drink): restaurant, bar_pub, fast_food, cafe
  - **Green** (nature): walkway_trail, park, beach, golf_course
  - **Blue** (services): grocery, supermarket, petrol_station, ev_charging, pharmacy, atm_bank
  - **Purple** (historic/culture): castle_historic, tourist_attraction
  - **Grey** (other): accommodation, hospital_medical, other, activity_centre
- `src/lib/amenityCategories.ts` — single source of truth (label, Lucide icon, colour group)
- `src/hooks/useAmenities.ts` — list/create/update/delete + link/unlink helpers, builds `directions_url` automatically as:
  ```
  https://www.google.com/maps/dir/?api=1&destination={lat},{lng}&travelmode=driving
  ```
  Falls back to `?api=1&query={name}+{postcode}` when lat/lng missing
- Sidebar entry "Amenities" with `MapPin` icon under Property Knowledge group (super/senior/admin)
- Route added to `App.tsx`

### 4. Property Knowledge — Local Area tab (staff)

- `src/components/amenities/PropertyAmenitiesTab.tsx` mounted inside `PropertyKnowledgeDetail.tsx`
- Sortable table: ⭐ Featured, Name, Category badge, Distance ("2.3 km · 8 min drive"), Directions button (opens `directions_url` in new tab), Staff note (masked), Edit/Unlink
- **Tap-to-reveal staff notes**: reuse the same pattern already used for WiFi password / key safe code (eye icon toggle). Masked by default.
- "Link Amenity" → `LinkAmenityDialog.tsx` searchable combobox of existing amenities + form fields (distance_km, drive_time_mins, is_featured, staff_note)
- Sort: featured first → display_order → distance_km

### 5. Owner Portal — Local Area tab

- Add "Local Area" tab to the existing owner property view (locate the per-property view inside `src/pages/owner/`)
- Read-only version of the staff component: category badge, name, distance/drive time, Directions button
- **No staff_note shown to owners** (operational only) — just public-facing info
- Queries `v_property_amenities` filtered by listing_id, RLS scoped via `owner_owns_listing`

### 6. Isla placeholder route `/stay/:slug`

- `src/pages/GuestPortal.tsx` — no auth required
- Reads `:slug` from URL → fetches `listings.name + image_url + location_group` by slug
- Branded "Guest guide coming soon for {Property Name}" page (Escape Grids dark theme, amber accent, property image header)
- Future hook-in points stubbed (commented): "The Area" section will read from `v_property_amenities`
- Route added to `App.tsx` outside any `ProtectedRoute` wrapper

### 7. Orin enrichment verification + chip refresh

- Orin chips were already updated in an earlier loop — verify `OrinSuggestedChips.tsx` matches the four required strings
- `orin-chat` Edge Function enrichment was applied earlier (current_year, prior_year_same_period, yoy_variance, revenue_pacing, pipeline, location_breakdown, top/bottom properties, cleaning_today, cancellations, pagination fix). I'll re-read the current file and add anything still missing (e.g., owner_breakdown if absent) and confirm the system prompt covers all blocks.

### Files

```text
NEW   supabase/migrations/<ts>_amenities.sql
NEW   src/pages/Amenities.tsx
NEW   src/pages/GuestPortal.tsx
NEW   src/components/amenities/AmenityFormSheet.tsx
NEW   src/components/amenities/CategoryBadge.tsx
NEW   src/components/amenities/LinkAmenityDialog.tsx
NEW   src/components/amenities/PropertyAmenitiesTab.tsx
NEW   src/components/amenities/OwnerLocalAreaTab.tsx
NEW   src/hooks/useAmenities.ts
NEW   src/lib/amenityCategories.ts
EDIT  src/App.tsx                              (+/amenities, +/stay/:slug)
EDIT  src/components/layout/AppSidebar.tsx     (Amenities nav entry)
EDIT  src/pages/PropertyKnowledgeDetail.tsx    (mount Local Area tab)
EDIT  src/pages/owner/<owner property view>    (mount Owner Local Area tab)
EDIT  supabase/functions/orin-chat/index.ts    (only if gaps found vs spec)
EDIT  src/components/orin/OrinSuggestedChips.tsx (verify only)
```

### Approvals you'll see

1. **Migration**: enum, `amenities`, `property_amenities`, view, RLS, triggers, `listings.slug` + backfill
2. **Data insert**: 70 amenity seed rows + TouchStay UPDATE statements against `property_knowledge`

### Out of scope (explicit)

- Distance recalc Edge Function (Google Maps Distance Matrix API)
- Full Isla guest AI behind `/stay/:slug` (placeholder only)
- Orin amenity awareness (can add `nearby_amenities_summary` block in a follow-up)

