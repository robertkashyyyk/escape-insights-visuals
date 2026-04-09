
-- Drop partial indexes and create a proper non-partial unique constraint
DROP INDEX IF EXISTS public.idx_reservations_hostaway_id;
DROP INDEX IF EXISTS public.uq_reservations_hostaway_id;
ALTER TABLE public.reservations ADD CONSTRAINT uq_reservations_hostaway_res_id UNIQUE (hostaway_reservation_id);
