ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS has_hot_tub boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_ev_charger boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pet_friendly boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS self_check_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS amenities jsonb NOT NULL DEFAULT '[]'::jsonb;