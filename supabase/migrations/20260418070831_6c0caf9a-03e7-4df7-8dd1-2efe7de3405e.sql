-- Add detailed financial breakdown columns to reservations to enable net (management) revenue calculation
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS cleaning_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS channel_commission numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS host_payout numeric;

-- Backfill host_payout from existing owner_payout where it differs from total_amount (i.e. a real host payout was synced)
UPDATE public.reservations
SET host_payout = owner_payout
WHERE host_payout IS NULL
  AND owner_payout IS NOT NULL
  AND owner_payout <> total_amount;

COMMENT ON COLUMN public.reservations.cleaning_fee IS 'Cleaning fee charged to the guest (from Hostaway)';
COMMENT ON COLUMN public.reservations.channel_commission IS 'Commission taken by booking channel (Airbnb, Booking.com, etc.)';
COMMENT ON COLUMN public.reservations.tax_amount IS 'Tax amount included in total_amount';
COMMENT ON COLUMN public.reservations.host_payout IS 'Net amount paid to host by channel (true net revenue). When NULL, calculate as total_amount - cleaning_fee - channel_commission - tax_amount';
