-- Add check-in / check-out time columns to reservations (local property time)
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS check_in_time time,
  ADD COLUMN IF NOT EXISTS check_out_time time;

-- Add default check-in/out times to listings (used as fallback when reservation doesn't carry them)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS default_check_in_time time DEFAULT '15:00'::time,
  ADD COLUMN IF NOT EXISTS default_check_out_time time DEFAULT '10:00'::time;