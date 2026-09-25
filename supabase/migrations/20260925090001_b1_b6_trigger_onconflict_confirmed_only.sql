-- B1 + B6: fix and harden the auto-create-clean trigger.
--
-- B1 (critical hotfix): the INSERT's ON CONFLICT predicate must match the partial
-- index clean_tasks_unique_listing_date_nonmanual EXACTLY. The index gained a status
-- predicate (~7 Sep, see 20260925090000) but the trigger's ON CONFLICT still said only
-- `WHERE source <> 'manual'`, so every trigger INSERT raised 42P10 ("no unique or
-- exclusion constraint matching the ON CONFLICT specification") from 8 Sep onward:
-- zero source='auto' cleans, and the reservation upsert aborted in 50-row chunks,
-- silently dropping cancellations / date changes / property moves each sync.
-- The clean-creation body is also wrapped in BEGIN … EXCEPTION WHEN OTHERS THEN
-- RAISE WARNING … END so a cleaning-side failure can never again roll back the
-- reservation write.
--
-- B6: only CONFIRMED reservations create a clean (previously inquiry rows could).
-- When a reservation transitions inquiry → confirmed, the AFTER UPDATE firing with
-- status='confirmed' creates the clean via the normal path.
CREATE OR REPLACE FUNCTION public.auto_create_clean_from_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_clean boolean;
  v_co_time time;
  v_is_bundle boolean;
  v_is_archived boolean;
  v_status text;
  v_is_sto boolean;
  v_priority smallint;
  v_existing uuid;
BEGIN
  -- B6: only confirmed reservations get a clean.
  IF lower(COALESCE(NEW.status, '')) <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  IF NEW.check_out IS NULL OR NEW.listing_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(is_clean, true),
         COALESCE(default_check_out_time, '10:00:00'::time),
         COALESCE(is_bundle, false),
         COALESCE(is_archived, false),
         status
    INTO v_is_clean, v_co_time, v_is_bundle, v_is_archived, v_status
    FROM public.listings
   WHERE id = NEW.listing_id;

  -- Never create a clean on a bundle listing (fans out to components via the scheduler).
  IF COALESCE(v_is_bundle, false) THEN
    RETURN NEW;
  END IF;

  -- Never create a clean for an archived / inactive (de-listed) property.
  IF COALESCE(v_is_archived, false) OR lower(COALESCE(v_status, 'active')) = 'inactive' THEN
    RETURN NEW;
  END IF;

  IF NOT COALESCE(v_is_clean, true) THEN
    RETURN NEW;
  END IF;

  -- B1: a cleaning-side failure must NEVER roll back the reservation write.
  BEGIN
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
    -- B1: predicate matches clean_tasks_unique_listing_date_nonmanual EXACTLY.
    ON CONFLICT (listing_id, scheduled_date)
      WHERE source <> 'manual' AND status <> ALL (ARRAY['cancelled'::text, 'canceled'::text])
      DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_create_clean_from_reservation failed for reservation %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;
