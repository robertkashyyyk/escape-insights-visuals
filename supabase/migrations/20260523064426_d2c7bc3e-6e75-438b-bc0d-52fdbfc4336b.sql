-- 1) Update trigger to skip inquiry status
CREATE OR REPLACE FUNCTION public.auto_create_clean_from_reservation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_co_time time;
  v_is_sto boolean;
  v_priority smallint;
  v_existing_id uuid;
BEGIN
  IF NEW.status IS NOT NULL AND lower(NEW.status) IN ('cancelled','canceled','declined','expired','inquiry') THEN
    RETURN NEW;
  END IF;

  IF NEW.check_out IS NULL OR NEW.listing_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(default_check_out_time, '10:00:00'::time)
    INTO v_co_time FROM public.listings WHERE id = NEW.listing_id;

  SELECT EXISTS (
    SELECT 1 FROM public.reservations r2
     WHERE r2.listing_id = NEW.listing_id
       AND r2.check_in   = NEW.check_out
       AND r2.id <> NEW.id
       AND (r2.status IS NULL OR lower(r2.status) NOT IN ('cancelled','canceled','declined','expired','inquiry'))
  ) INTO v_is_sto;

  v_priority := CASE WHEN v_is_sto THEN 1 ELSE 2 END;

  SELECT id INTO v_existing_id FROM public.clean_tasks
   WHERE reservation_id = NEW.id
     AND source <> 'manual'
     AND COALESCE(status, '') NOT IN ('completed','done','cancelled')
   ORDER BY CASE WHEN scheduled_date = NEW.check_out THEN 0 ELSE 1 END,
            priority_level NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.clean_tasks
       SET listing_id = NEW.listing_id, scheduled_date = NEW.check_out,
           checkout_time = v_co_time, is_same_day_turnaround = v_is_sto,
           priority_level = v_priority,
           priority = CASE WHEN v_is_sto THEN 'same_day_turnaround' ELSE 'standard' END,
           updated_at = now()
     WHERE id = v_existing_id
       AND override_assignment IS NOT TRUE
       AND status NOT IN ('completed','done','cancelled')
       AND scheduled_date >= CURRENT_DATE;

    DELETE FROM public.clean_tasks
     WHERE reservation_id = NEW.id AND id <> v_existing_id
       AND source <> 'manual'
       AND COALESCE(status, '') NOT IN ('completed','done','cancelled');
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.clean_tasks
     WHERE listing_id = NEW.listing_id AND scheduled_date = NEW.check_out
       AND source <> 'manual' AND COALESCE(status, '') <> 'cancelled'
  ) THEN
    UPDATE public.clean_tasks
       SET reservation_id = NEW.id,
           is_same_day_turnaround = v_is_sto,
           priority_level = LEAST(priority_level, v_priority),
           priority = CASE WHEN LEAST(priority_level, v_priority) = 1 THEN 'same_day_turnaround' ELSE priority END,
           updated_at = now()
     WHERE listing_id = NEW.listing_id AND scheduled_date = NEW.check_out
       AND source <> 'manual'
       AND (
         reservation_id IS NULL
         OR EXISTS (
           SELECT 1 FROM public.reservations r3
            WHERE r3.id = public.clean_tasks.reservation_id
              AND lower(COALESCE(r3.status,'')) IN ('inquiry','cancelled','canceled','declined','expired')
         )
       );
    RETURN NEW;
  END IF;

  INSERT INTO public.clean_tasks (
    listing_id, reservation_id, scheduled_date, status, source,
    is_same_day_turnaround, priority_level, checkout_time, task_type, priority
  ) VALUES (
    NEW.listing_id, NEW.id, NEW.check_out, 'unassigned', 'auto',
    v_is_sto, v_priority, v_co_time, 'checkout_clean',
    CASE WHEN v_is_sto THEN 'same_day_turnaround' ELSE 'standard' END
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 2) Backfill: re-point cleans currently linked to inquiry/cancelled reservations
-- to the confirmed sibling on the same listing+date when one exists.
UPDATE public.clean_tasks ct
   SET reservation_id = sub.confirmed_id, updated_at = now()
  FROM (
    SELECT ct2.id AS clean_id,
           (SELECT r2.id FROM public.reservations r2
             WHERE r2.listing_id = ct2.listing_id
               AND r2.check_out = ct2.scheduled_date
               AND lower(COALESCE(r2.status,'')) NOT IN ('inquiry','cancelled','canceled','declined','expired')
             ORDER BY r2.created_at ASC LIMIT 1) AS confirmed_id
      FROM public.clean_tasks ct2
      JOIN public.reservations r ON r.id = ct2.reservation_id
     WHERE ct2.source <> 'manual'
       AND COALESCE(ct2.status,'') NOT IN ('completed','done','cancelled')
       AND ct2.scheduled_date >= CURRENT_DATE
       AND lower(COALESCE(r.status,'')) IN ('inquiry','cancelled','canceled','declined','expired')
  ) sub
 WHERE ct.id = sub.clean_id AND sub.confirmed_id IS NOT NULL;

-- 3) Delete non-manual cleans still linked to inquiries with no confirmed sibling
DELETE FROM public.clean_tasks ct
 USING public.reservations r
 WHERE ct.reservation_id = r.id
   AND ct.source <> 'manual'
   AND COALESCE(ct.status,'') NOT IN ('completed','done','cancelled')
   AND ct.scheduled_date >= CURRENT_DATE
   AND lower(COALESCE(r.status,'')) = 'inquiry';