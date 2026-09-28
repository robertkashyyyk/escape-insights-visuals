ALTER TABLE public.listings
  ADD COLUMN is_bundle boolean NOT NULL DEFAULT false,
  ADD COLUMN bundle_components jsonb DEFAULT NULL;