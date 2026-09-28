-- Extend the auto-create-clean trigger to skip archived / inactive listings, in
-- addition to bundles. A de-listed property should never generate cleans.
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
  IF NEW.status IS NOT NULL AND lower(NEW.status) IN ('cancelled','canceled','declined','expired') THEN
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

  -- Never create a clean on a bundle listing: it has no matrix row and can never
  -- be completed. The edge scheduler fans the booking out to component listings.
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

-- One-time cleanup: retire any live clean currently on an archived / inactive listing.
UPDATE public.clean_tasks ct
   SET status = 'cancelled', updated_at = now()
  FROM public.listings l
 WHERE ct.listing_id = l.id
   AND (COALESCE(l.is_archived,false) = true OR lower(coalesce(l.status,'active')) = 'inactive')
   AND ct.source <> 'manual'
   AND ct.status NOT IN ('cancelled','canceled','completed','done');
