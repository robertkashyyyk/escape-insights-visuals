-- 1. Enum for amenity categories
CREATE TYPE public.amenity_category AS ENUM (
  'grocery','supermarket','petrol_station','ev_charging',
  'restaurant','bar_pub','fast_food','cafe',
  'golf_course','walkway_trail','park','castle_historic',
  'beach','activity_centre','pharmacy','hospital_medical',
  'atm_bank','tourist_attraction','accommodation','other'
);

-- 2. amenities master table
CREATE TABLE public.amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category public.amenity_category NOT NULL DEFAULT 'other',
  address text,
  postcode text,
  latitude numeric,
  longitude numeric,
  phone text,
  website text,
  google_place_id text,
  opening_hours text,
  notes text,
  price_range text,
  rating numeric,
  tags text[] DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_amenities_category ON public.amenities(category);
CREATE INDEX idx_amenities_active ON public.amenities(is_active);
CREATE INDEX idx_amenities_postcode ON public.amenities(postcode);

ALTER TABLE public.amenities ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER amenities_set_updated_at
BEFORE UPDATE ON public.amenities
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. property_amenities junction
CREATE TABLE public.property_amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  amenity_id uuid NOT NULL REFERENCES public.amenities(id) ON DELETE CASCADE,
  distance_km numeric,
  drive_time_mins integer,
  walk_time_mins integer,
  directions_url text,
  is_featured boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  staff_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, amenity_id)
);

CREATE INDEX idx_property_amenities_listing ON public.property_amenities(listing_id);
CREATE INDEX idx_property_amenities_amenity ON public.property_amenities(amenity_id);
CREATE INDEX idx_property_amenities_featured ON public.property_amenities(listing_id, is_featured DESC, display_order, distance_km);

ALTER TABLE public.property_amenities ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER property_amenities_set_updated_at
BEFORE UPDATE ON public.property_amenities
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4. View for efficient joined reads
CREATE OR REPLACE VIEW public.v_property_amenities AS
SELECT
  pa.id,
  pa.listing_id,
  pa.amenity_id,
  pa.distance_km,
  pa.drive_time_mins,
  pa.walk_time_mins,
  pa.directions_url,
  pa.is_featured,
  pa.display_order,
  pa.staff_note,
  pa.created_at,
  pa.updated_at,
  a.name,
  a.category,
  a.address,
  a.postcode,
  a.latitude,
  a.longitude,
  a.phone,
  a.website,
  a.opening_hours,
  a.price_range,
  a.rating,
  a.tags,
  a.is_active
FROM public.property_amenities pa
JOIN public.amenities a ON a.id = pa.amenity_id;

-- 5. RLS policies — amenities
CREATE POLICY "Staff manage amenities"
ON public.amenities FOR ALL TO authenticated
USING (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role))
WITH CHECK (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Owners read active amenities"
ON public.amenities FOR SELECT TO authenticated
USING (
  is_active = true AND EXISTS (
    SELECT 1 FROM public.property_amenities pa
    WHERE pa.amenity_id = amenities.id
      AND owner_owns_listing(auth.uid(), pa.listing_id)
  )
);

CREATE POLICY "Cleaners read active amenities"
ON public.amenities FOR SELECT TO authenticated
USING (
  is_active = true AND EXISTS (
    SELECT 1 FROM public.property_amenities pa
    WHERE pa.amenity_id = amenities.id
      AND cleaner_assigned_to_listing(auth.uid(), pa.listing_id)
  )
);

CREATE POLICY "Public read active amenities"
ON public.amenities FOR SELECT TO anon
USING (is_active = true);

-- 6. RLS policies — property_amenities
CREATE POLICY "Staff manage property_amenities"
ON public.property_amenities FOR ALL TO authenticated
USING (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role))
WITH CHECK (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Owners read own property_amenities"
ON public.property_amenities FOR SELECT TO authenticated
USING (owner_owns_listing(auth.uid(), listing_id));

CREATE POLICY "Cleaners read assigned property_amenities"
ON public.property_amenities FOR SELECT TO authenticated
USING (cleaner_assigned_to_listing(auth.uid(), listing_id));

CREATE POLICY "Public read property_amenities"
ON public.property_amenities FOR SELECT TO anon
USING (true);

-- 7. listings.slug for /stay/:slug routing
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS slug text;

-- Backfill slugs from name (lowercase, hyphenated, alphanumeric only)
UPDATE public.listings
SET slug = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Deduplicate any collisions by appending short id suffix
WITH dups AS (
  SELECT id, slug,
         row_number() OVER (PARTITION BY slug ORDER BY created_at) AS rn
  FROM public.listings
)
UPDATE public.listings l
SET slug = l.slug || '-' || substr(l.id::text, 1, 6)
FROM dups
WHERE l.id = dups.id AND dups.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS listings_slug_key ON public.listings(slug) WHERE slug IS NOT NULL;

-- Allow public/anon to read minimal listing info needed for /stay/:slug
CREATE POLICY "Public read listings by slug"
ON public.listings FOR SELECT TO anon
USING (slug IS NOT NULL);