-- A manual hold on a reservation's status that the Hostaway sync (or any writer) must
-- not clobber. Needed because the sync now correctly maps expired/inquiry statuses, so a
-- row we deliberately want to leave as-is (e.g. the two Harbour Heights bookings held for
-- Ryan) would otherwise be re-corrected on the next sync. BEFORE UPDATE, locked rows keep
-- their status + hostaway_status; everything else (dates, guest, amounts) still updates.
-- To release a hold: set status_locked=false (that change itself is allowed), then correct.
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS status_locked boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.freeze_locked_reservation_status()
 RETURNS trigger LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD.status_locked THEN
    NEW.status := OLD.status;
    NEW.hostaway_status := OLD.hostaway_status;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_freeze_locked_reservation_status ON public.reservations;
CREATE TRIGGER trg_freeze_locked_reservation_status
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.freeze_locked_reservation_status();
