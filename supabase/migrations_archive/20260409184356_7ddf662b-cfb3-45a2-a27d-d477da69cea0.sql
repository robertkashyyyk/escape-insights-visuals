
-- Fix 1: Add location_groups array and Fix 2: Add workload_share JSON to cleaners
ALTER TABLE public.cleaners
  ADD COLUMN IF NOT EXISTS location_groups text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS workload_share jsonb DEFAULT '{}'::jsonb;

-- Migrate existing region data into location_groups
UPDATE public.cleaners
SET location_groups = ARRAY[region]
WHERE region IS NOT NULL AND region != 'Other' AND (location_groups IS NULL OR location_groups = '{}'::text[]);

-- Fix 3: Add cleaning_duration_minutes to listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS cleaning_duration_minutes integer;

-- Set default cleaning durations based on bedrooms
UPDATE public.listings
SET cleaning_duration_minutes = CASE
  WHEN bedrooms = 1 THEN 60
  WHEN bedrooms = 2 THEN 90
  WHEN bedrooms = 3 THEN 120
  WHEN bedrooms >= 4 THEN 150
  ELSE 90
END
WHERE cleaning_duration_minutes IS NULL;
