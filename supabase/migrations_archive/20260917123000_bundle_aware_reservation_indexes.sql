-- Make the reservation-level unique indexes bundle-aware by adding listing_id.
-- A bundle booking fans out to N component listings, so "one live clean per
-- reservation" was impossible to satisfy: the second component always collided
-- with the unique index and was dropped (Ernie's Den created, Lily's Pad lost).
-- Keying on (reservation_id, listing_id) is unchanged for normal single-listing
-- bookings (still one clean per booking) but lets each bundle component carry its
-- own clean — and an already-clean component simply never gets one.

DROP INDEX IF EXISTS uq_clean_tasks_one_live_auto_per_reservation;
CREATE UNIQUE INDEX uq_clean_tasks_one_live_auto_per_reservation
  ON public.clean_tasks (reservation_id, listing_id)
  WHERE ((reservation_id IS NOT NULL) AND (source <> 'manual'::text)
         AND (status <> ALL (ARRAY['cancelled'::text, 'completed'::text, 'done'::text])));

DROP INDEX IF EXISTS clean_tasks_reservation_id_scheduled_date_key;
CREATE UNIQUE INDEX clean_tasks_reservation_id_scheduled_date_key
  ON public.clean_tasks (reservation_id, listing_id, scheduled_date)
  WHERE (status <> ALL (ARRAY['cancelled'::text, 'canceled'::text]));
