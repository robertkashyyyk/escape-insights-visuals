-- Fix: the auto-create-clean trigger could throw a duplicate-key error on the
-- partial unique index clean_tasks_unique_listing_date_nonmanual when two
-- reservations in the same sync batch share a (listing_id, check_out). That
-- aborted the whole 50-row reservation upsert, silently dropping bookings and
-- leaving cleans (e.g. late same-day arrivals) missing.
--
-- Make the trigger's INSERT idempotent with ON CONFLICT ... DO NOTHING so a
-- collision harmlessly skips the redundant clean instead of failing the batch.
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
  v_existing uuid;
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

  SELECT id INTO v_existing
    FROM public.clean_tasks
   WHERE reservation_id = NEW.id
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE public.clean_tasks
       SET scheduled_date = NEW.check_out,
           checkout_time  = v_co_time,
           updated_at     = now()
     WHERE id = v_existing
       AND override_assignment IS NOT TRUE
       AND status NOT IN ('completed','done');
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
  )
  ON CONFLICT (listing_id, scheduled_date) WHERE source <> 'manual' DO NOTHING;

  RETURN NEW;
END;
$$;
