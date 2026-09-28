ALTER TABLE public.cleaners
  ADD COLUMN home_postcode text,
  ADD COLUMN home_latitude numeric,
  ADD COLUMN home_longitude numeric;