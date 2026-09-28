ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS min_stay_nights integer NOT NULL DEFAULT 2;

COMMENT ON COLUMN public.listings.min_stay_nights IS 'Minimum bookable stay length in nights. Used to detect Orphan Gaps in calendars (gaps shorter than this are unbookable stranded inventory).';