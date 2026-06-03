-- Meeting spec item 1: Hostnote / Guestnote / Custom Fields on a booking.
-- Populated by the hostaway-sync edge function (includeResources=1).
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS host_note text,
  ADD COLUMN IF NOT EXISTS guest_note text,
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '[]'::jsonb;
