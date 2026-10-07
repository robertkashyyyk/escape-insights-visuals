-- Job 2: store the raw Hostaway reservation status so mapping decisions are visible
-- and auditable. hostaway-sync populates it on every sync; a one-off backfill set it
-- for existing rows. Nullable text (no constraint) — it holds Hostaway's exact value
-- (e.g. 'new','modified','ownerStay','expired','inquiryPreapproved', …).
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS hostaway_status text;

COMMENT ON COLUMN public.reservations.hostaway_status IS
  'Raw Hostaway reservation status as last synced. public.status is our mapped value (see _shared/hostawayStatus.ts).';
