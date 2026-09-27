-- Close the guard hole: a later-dated insert alongside an existing live/completed clean
-- IS the duplicate (inserts never "replace" — carryover is an UPDATE). Remove the
-- "unless a live row exists" exemption: ANY non-manual INSERT with scheduled_date >
-- reservation.check_out is rejected and logged, no exceptions.
CREATE OR REPLACE FUNCTION public.guard_clean_task_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_checkout date;
BEGIN
  IF NEW.source = 'manual' OR NEW.reservation_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT check_out INTO v_checkout FROM public.reservations WHERE id = NEW.reservation_id;

  IF v_checkout IS NOT NULL AND NEW.scheduled_date > v_checkout THEN
    INSERT INTO public.automation_logs (status, error_message, triggered_by)
    VALUES ('rejected_insert',
            format('Rejected non-manual clean insert: listing=%s reservation=%s scheduled_date=%s > check_out=%s',
                   NEW.listing_id, NEW.reservation_id, NEW.scheduled_date, v_checkout),
            'clean_insert_guard');
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;
