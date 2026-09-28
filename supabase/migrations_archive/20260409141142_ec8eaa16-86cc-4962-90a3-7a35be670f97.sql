CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_hostaway_listing_id
  ON public.listings (hostaway_listing_id)
  WHERE hostaway_listing_id IS NOT NULL;