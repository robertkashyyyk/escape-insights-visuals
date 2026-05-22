
CREATE OR REPLACE FUNCTION public.auto_create_clean_from_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_clean boolean;
  v_co_time time;
  v_is_sto boolean;
  v_priority smallint;
  v_existing_id uuid;
  v_existing_date date;
  v_existing_level smallint;
BEGIN
  IF NEW.status IS NOT NULL AND lower(NEW.status) IN ('cancelled','canceled','declined','expired') THEN
    RETURN NEW;
  END IF;

  IF NEW.check_out IS NULL OR NEW.listing_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(is_clean, true),
         COALESCE(default_check_out_time, '10:00:00'::time)
    INTO v_is_clean, v_co_time
    FROM public.listings
   WHERE id = NEW.listing_id;

  IF NOT COALESCE(v_is_clean, true) THEN
    RETURN NEW;
  END IF;

  SELECT id, scheduled_date, priority_level
    INTO v_existing_id, v_existing_date, v_existing_level
    FROM public.clean_tasks
   WHERE reservation_id = NEW.id
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- ONLY sync the date forward for a future, untouched clean.
    -- Never revert a P0-promoted clean (priority_level = 0), a manually-overridden one,
    -- a completed one, or one whose date is already in the past (it's been promoted or done).
    UPDATE public.clean_tasks
       SET scheduled_date = NEW.check_out,
           checkout_time  = v_co_time,
           updated_at     = now()
     WHERE id = v_existing_id
       AND override_assignment IS NOT TRUE
       AND status NOT IN ('completed','done','cancelled')
       AND priority_level <> 0
       AND scheduled_date >= CURRENT_DATE
       AND scheduled_date <> NEW.check_out;
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.reservations r2
     WHERE r2.listing_id = NEW.listing_id
       AND r2.check_in   = NEW.check_out
       AND r2.id <> NEW.id
       AND (r2.status IS NULL OR lower(r2.status) NOT IN ('cancelled','canceled','declined','expired'))
  ) INTO v_is_sto;

  v_priority := CASE WHEN v_is_sto THEN 1 ELSE 2 END;

  -- Don't create if any non-manual task already covers this listing/date.
  IF EXISTS (
    SELECT 1 FROM public.clean_tasks
     WHERE listing_id = NEW.listing_id
       AND scheduled_date = NEW.check_out
       AND source <> 'manual'
  ) THEN
    UPDATE public.clean_tasks
       SET reservation_id = NEW.id,
           is_same_day_turnaround = v_is_sto,
           priority_level = LEAST(priority_level, v_priority),
           updated_at = now()
     WHERE listing_id = NEW.listing_id
       AND scheduled_date = NEW.check_out
       AND source <> 'manual'
       AND reservation_id IS NULL;
    RETURN NEW;
  END IF;

  INSERT INTO public.clean_tasks (
    listing_id, reservation_id, scheduled_date, status, source,
    is_same_day_turnaround, priority_level, checkout_time, task_type, priority
  ) VALUES (
    NEW.listing_id, NEW.id, NEW.check_out, 'unassigned', 'auto',
    v_is_sto, v_priority, v_co_time, 'checkout_clean',
    CASE WHEN v_is_sto THEN 'STO' ELSE 'STANDARD' END
  );

  RETURN NEW;
END;
$$;

-- Clean up any rows that the buggy trigger split: where the same reservation now has
-- both an original-date row AND a promoted/today row, delete the older non-promoted one.
DELETE FROM public.clean_tasks a
USING public.clean_tasks b
WHERE a.reservation_id IS NOT NULL
  AND a.reservation_id = b.reservation_id
  AND a.id <> b.id
  AND a.priority_level <> 0
  AND b.priority_level = 0
  AND a.status NOT IN ('completed','done')
  AND a.override_assignment IS NOT TRUE;
