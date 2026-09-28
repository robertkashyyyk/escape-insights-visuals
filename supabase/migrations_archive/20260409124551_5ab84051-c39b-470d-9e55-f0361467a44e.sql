ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS primary_cleaner text,
  ADD COLUMN IF NOT EXISTS management_rate_override numeric,
  ADD COLUMN IF NOT EXISTS operational_notes text,
  ADD COLUMN IF NOT EXISTS troubleshooting_notes text,
  ADD COLUMN IF NOT EXISTS access_details text;