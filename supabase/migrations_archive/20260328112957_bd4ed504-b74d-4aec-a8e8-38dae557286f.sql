-- Add missing columns to property_owners
ALTER TABLE public.property_owners ADD COLUMN IF NOT EXISTS management_rate_pct numeric;

-- Add missing columns to listings
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS hostaway_listing_id integer;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS postcode text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS longitude numeric;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS tags text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS location_group text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS min_rate numeric;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS base_rate numeric;