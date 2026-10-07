-- Job 5 (occupancy): owner stays must still get a cleaning job. A reservation whose
-- Hostaway status is 'ownerStay' is now stored as status='ownerStay' (not 'confirmed'),
-- so the trigger's confirmed-only guard would stop creating its clean. Widen the guard
-- to treat 'confirmed' AND 'ownerStay' as live (occupancy). Revenue/report code elsewhere
-- counts only 'confirmed', so owner stays are cleaned but earn £0. All other logic
-- (incl. the not_required suppression) is unchanged from 20261007120000.
CREATE OR REPLACE FUNCTION public.auto_create_clean_from_reservation()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_co_time time; v_is_bundle boolean; v_is_archived boolean; v_status text;
  v_is_sto boolean; v_priority smallint; v_existing uuid; v_existing_listing uuid;
  v_existing_cleaner uuid; v_old_name text; v_new_group text; v_keep_cleaner boolean;
BEGIN
  IF lower(COALESCE(NEW.status, '')) NOT IN ('confirmed','ownerstay') THEN RETURN NEW; END IF;
  IF NEW.check_out IS NULL OR NEW.listing_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.check_out < (now() AT TIME ZONE 'Europe/London')::date THEN RETURN NEW; END IF;

  SELECT COALESCE(default_check_out_time, '10:00:00'::time), COALESCE(is_bundle, false),
         COALESCE(is_archived, false), status
    INTO v_co_time, v_is_bundle, v_is_archived, v_status
    FROM public.listings WHERE id = NEW.listing_id;

  IF COALESCE(v_is_bundle, false) THEN RETURN NEW; END IF;
  IF COALESCE(v_is_archived, false) OR lower(COALESCE(v_status, 'active')) = 'inactive' THEN RETURN NEW; END IF;

  BEGIN
    -- "Not required" suppression (mirrors the scheduler's step 4b). A manager-marked
    -- "not required" clean is stored cancelled + not_required=true. If one exists for
    -- this stay (same scheduled_date and same reservation OR same listing), do nothing.
    -- A plain cancelled row that is NOT not_required falls through, so a reinstated
    -- booking still gets a fresh live clean below.
    IF EXISTS (
      SELECT 1 FROM public.clean_tasks
       WHERE scheduled_date = NEW.check_out
         AND COALESCE(not_required, false) = true
         AND (reservation_id = NEW.id OR listing_id = NEW.listing_id)
    ) THEN
      RETURN NEW;
    END IF;

    SELECT id, listing_id, assigned_cleaner_id
      INTO v_existing, v_existing_listing, v_existing_cleaner
      FROM public.clean_tasks
     WHERE reservation_id = NEW.id AND status NOT IN ('cancelled','canceled')
     ORDER BY (status IN ('completed','done')) DESC, scheduled_date DESC LIMIT 1;

    IF v_existing IS NOT NULL THEN
      IF v_existing_listing IS DISTINCT FROM NEW.listing_id THEN
        SELECT internal_name INTO v_old_name FROM public.listings WHERE id = v_existing_listing;
        SELECT location_group INTO v_new_group FROM public.listings WHERE id = NEW.listing_id;
        v_keep_cleaner := v_existing_cleaner IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.cleaners c WHERE c.id = v_existing_cleaner AND v_new_group = ANY(c.location_groups));
        UPDATE public.clean_tasks
           SET listing_id = NEW.listing_id, scheduled_date = NEW.check_out, checkout_time = v_co_time,
               assigned_cleaner_id = CASE WHEN v_keep_cleaner THEN assigned_cleaner_id ELSE NULL END,
               status = CASE WHEN v_keep_cleaner THEN status ELSE 'unassigned' END,
               warning_reason = 'Booking moved from ' || COALESCE(v_old_name, 'another property'), updated_at = now()
         WHERE id = v_existing AND override_assignment IS NOT TRUE AND status NOT IN ('completed','done');
        RETURN NEW;
      ELSE
        UPDATE public.clean_tasks
           SET scheduled_date = NEW.check_out, checkout_time = v_co_time, updated_at = now()
         WHERE id = v_existing AND override_assignment IS NOT TRUE AND status NOT IN ('completed','done');
        RETURN NEW;
      END IF;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.reservations r2
       WHERE r2.listing_id = NEW.listing_id AND r2.check_in = NEW.check_out AND r2.id <> NEW.id
         AND (r2.status IS NULL OR lower(r2.status) NOT IN ('cancelled','canceled','declined','expired'))
    ) INTO v_is_sto;
    v_priority := CASE WHEN v_is_sto THEN 1 ELSE 2 END;

    IF EXISTS (
      SELECT 1 FROM public.clean_tasks
       WHERE listing_id = NEW.listing_id AND scheduled_date = NEW.check_out
         AND source <> 'manual' AND status NOT IN ('cancelled','canceled')
    ) THEN
      UPDATE public.clean_tasks
         SET reservation_id = NEW.id, is_same_day_turnaround = v_is_sto,
             priority_level = LEAST(priority_level, v_priority), updated_at = now()
       WHERE listing_id = NEW.listing_id AND scheduled_date = NEW.check_out
         AND source <> 'manual' AND status NOT IN ('cancelled','canceled') AND reservation_id IS NULL;
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
    ON CONFLICT (listing_id, scheduled_date)
      WHERE source <> 'manual' AND status <> ALL (ARRAY['cancelled'::text, 'canceled'::text]) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_create_clean_from_reservation failed for reservation %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;
