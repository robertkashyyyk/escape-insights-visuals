
-- Add Hostaway reservation ID and derived fields
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS hostaway_reservation_id bigint,
  ADD COLUMN IF NOT EXISTS booking_lead_days integer,
  ADD COLUMN IF NOT EXISTS day_of_week smallint,
  ADD COLUMN IF NOT EXISTS week_number smallint,
  ADD COLUMN IF NOT EXISTS month smallint,
  ADD COLUMN IF NOT EXISTS quarter smallint,
  ADD COLUMN IF NOT EXISTS year smallint;

-- Unique index for deduplication on Hostaway ID
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_hostaway_id
  ON public.reservations (hostaway_reservation_id)
  WHERE hostaway_reservation_id IS NOT NULL;

-- Backfill derived fields for existing rows
UPDATE public.reservations SET
  booking_lead_days = CASE
    WHEN reservation_date IS NOT NULL THEN GREATEST(0, check_in - reservation_date)
    ELSE NULL
  END,
  day_of_week = EXTRACT(DOW FROM check_in)::smallint,
  week_number = EXTRACT(WEEK FROM check_in)::smallint,
  month = EXTRACT(MONTH FROM check_in)::smallint,
  quarter = EXTRACT(QUARTER FROM check_in)::smallint,
  year = EXTRACT(YEAR FROM check_in)::smallint
WHERE booking_lead_days IS NULL;
