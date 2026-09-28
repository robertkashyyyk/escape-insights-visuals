-- Step 4 DB guard: reject a non-manual clean INSERT whose scheduled_date is AFTER the
-- reservation's check_out, unless a live clean already exists for that booking (a
-- legitimate replace). Legit paths insert scheduled_date == check_out, so this only
-- blocks stray future-dated inserts. Rejections are logged to automation_logs.
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
    IF EXISTS (
      SELECT 1 FROM public.clean_tasks
       WHERE reservation_id = NEW.reservation_id
         AND status NOT IN ('cancelled','canceled')
    ) THEN
      RETURN NEW;
    END IF;
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

DROP TRIGGER IF EXISTS trg_guard_clean_task_insert ON public.clean_tasks;
CREATE TRIGGER trg_guard_clean_task_insert
  BEFORE INSERT ON public.clean_tasks
  FOR EACH ROW EXECUTE FUNCTION public.guard_clean_task_insert();
