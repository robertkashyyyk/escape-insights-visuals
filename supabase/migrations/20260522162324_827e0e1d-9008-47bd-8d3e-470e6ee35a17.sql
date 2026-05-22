-- Fix duplicate cleaning days caused by stale future P0 rows and restore orphan-gap visibility.

-- 1) Ensure reservations that only have an off-checkout P0 row get a proper checkout-day clean first.
WITH moved_only AS (
  SELECT DISTINCT
    ct.reservation_id,
    ct.listing_id,
    r.check_out,
    COALESCE(l.default_check_out_time, '10:00:00'::time) AS checkout_time,
    EXISTS (
      SELECT 1
      FROM public.reservations r2
      WHERE r2.listing_id = ct.listing_id
        AND r2.check_in = r.check_out
        AND r2.id <> r.id
        AND (r2.status IS NULL OR lower(r2.status) NOT IN ('cancelled','canceled','declined','expired'))
    ) AS is_sto
  FROM public.clean_tasks ct
  JOIN public.reservations r ON r.id = ct.reservation_id
  JOIN public.listings l ON l.id = ct.listing_id
  WHERE ct.reservation_id IS NOT NULL
    AND ct.priority_level = 0
    AND ct.scheduled_date <> CURRENT_DATE
    AND ct.scheduled_date <> r.check_out
    AND ct.source <> 'manual'
    AND COALESCE(ct.status, '') NOT IN ('completed','done','cancelled')
    AND NOT EXISTS (
      SELECT 1
      FROM public.clean_tasks existing
      WHERE existing.reservation_id = ct.reservation_id
        AND existing.scheduled_date = r.check_out
        AND existing.source <> 'manual'
        AND COALESCE(existing.status, '') <> 'cancelled'
    )
)
INSERT INTO public.clean_tasks (
  listing_id,
  reservation_id,
  scheduled_date,
  status,
  source,
  is_same_day_turnaround,
  priority_level,
  checkout_time,
  task_type,
  priority
)
SELECT
  listing_id,
  reservation_id,
  check_out,
  'unassigned',
  'auto',
  is_sto,
  CASE WHEN is_sto THEN 1 ELSE 2 END,
  checkout_time,
  'checkout_clean',
  CASE WHEN is_sto THEN 'same_day_turnaround' ELSE 'standard' END
FROM moved_only
ON CONFLICT DO NOTHING;

-- 2) Remove stale non-manual duplicate rows for the same reservation once a checkout-day task exists.
DELETE FROM public.clean_tasks stale
USING public.reservations r
WHERE stale.reservation_id = r.id
  AND stale.source <> 'manual'
  AND stale.priority_level = 0
  AND stale.scheduled_date <> CURRENT_DATE
  AND stale.scheduled_date <> r.check_out
  AND COALESCE(stale.status, '') NOT IN ('completed','done','cancelled')
  AND EXISTS (
    SELECT 1
    FROM public.clean_tasks checkout_task
    WHERE checkout_task.reservation_id = stale.reservation_id
      AND checkout_task.id <> stale.id
      AND checkout_task.scheduled_date = r.check_out
      AND checkout_task.source <> 'manual'
      AND COALESCE(checkout_task.status, '') <> 'cancelled'
  );

-- 3) Collapse any remaining duplicate non-manual rows per reservation, keeping completed rows first,
-- then checkout-day rows, then the most recently updated/created row.
WITH ranked AS (
  SELECT
    ct.id,
    ROW_NUMBER() OVER (
      PARTITION BY ct.reservation_id
      ORDER BY
        CASE WHEN ct.status IN ('completed','done') THEN 0 ELSE 1 END,
        CASE WHEN ct.scheduled_date = r.check_out THEN 0 ELSE 1 END,
        ct.updated_at DESC NULLS LAST,
        ct.created_at DESC NULLS LAST,
        ct.id
    ) AS keep_rank
  FROM public.clean_tasks ct
  JOIN public.reservations r ON r.id = ct.reservation_id
  WHERE ct.reservation_id IS NOT NULL
    AND ct.source <> 'manual'
    AND COALESCE(ct.status, '') <> 'cancelled'
)
DELETE FROM public.clean_tasks ct
USING ranked
WHERE ct.id = ranked.id
  AND ranked.keep_rank > 1
  AND COALESCE(ct.status, '') NOT IN ('completed','done');

-- 4) Harden the trigger so a reservation keeps exactly one non-manual clean unless manually handled.
CREATE OR REPLACE FUNCTION public.auto_create_clean_from_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_co_time time;
  v_is_sto boolean;
  v_priority smallint;
  v_existing_id uuid;
BEGIN
  IF NEW.status IS NOT NULL AND lower(NEW.status) IN ('cancelled','canceled','declined','expired') THEN
    RETURN NEW;
  END IF;

  IF NEW.check_out IS NULL OR NEW.listing_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(default_check_out_time, '10:00:00'::time)
    INTO v_co_time
    FROM public.listings
   WHERE id = NEW.listing_id;

  SELECT EXISTS (
    SELECT 1 FROM public.reservations r2
     WHERE r2.listing_id = NEW.listing_id
       AND r2.check_in   = NEW.check_out
       AND r2.id <> NEW.id
       AND (r2.status IS NULL OR lower(r2.status) NOT IN ('cancelled','canceled','declined','expired'))
  ) INTO v_is_sto;

  v_priority := CASE WHEN v_is_sto THEN 1 ELSE 2 END;

  SELECT id
    INTO v_existing_id
    FROM public.clean_tasks
   WHERE reservation_id = NEW.id
     AND source <> 'manual'
     AND COALESCE(status, '') NOT IN ('completed','done','cancelled')
   ORDER BY
     CASE WHEN scheduled_date = NEW.check_out THEN 0 ELSE 1 END,
     priority_level NULLS LAST,
     updated_at DESC NULLS LAST,
     created_at DESC NULLS LAST
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.clean_tasks
       SET listing_id = NEW.listing_id,
           scheduled_date = NEW.check_out,
           checkout_time = v_co_time,
           is_same_day_turnaround = v_is_sto,
           priority_level = v_priority,
           priority = CASE WHEN v_is_sto THEN 'same_day_turnaround' ELSE 'standard' END,
           updated_at = now()
     WHERE id = v_existing_id
       AND override_assignment IS NOT TRUE
       AND status NOT IN ('completed','done','cancelled')
       AND scheduled_date >= CURRENT_DATE;

    DELETE FROM public.clean_tasks
     WHERE reservation_id = NEW.id
       AND id <> v_existing_id
       AND source <> 'manual'
       AND COALESCE(status, '') NOT IN ('completed','done','cancelled');

    RETURN NEW;
  END IF;

  -- Don't create if any non-manual task already covers this listing/date.
  IF EXISTS (
    SELECT 1 FROM public.clean_tasks
     WHERE listing_id = NEW.listing_id
       AND scheduled_date = NEW.check_out
       AND source <> 'manual'
       AND COALESCE(status, '') <> 'cancelled'
  ) THEN
    UPDATE public.clean_tasks
       SET reservation_id = COALESCE(reservation_id, NEW.id),
           is_same_day_turnaround = v_is_sto,
           priority_level = LEAST(priority_level, v_priority),
           priority = CASE WHEN LEAST(priority_level, v_priority) = 1 THEN 'same_day_turnaround' ELSE priority END,
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
    CASE WHEN v_is_sto THEN 'same_day_turnaround' ELSE 'standard' END
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- 5) Enforce one live non-manual cleaning task per reservation going forward.
CREATE UNIQUE INDEX IF NOT EXISTS uq_clean_tasks_one_live_auto_per_reservation
  ON public.clean_tasks (reservation_id)
  WHERE reservation_id IS NOT NULL
    AND source <> 'manual'
    AND status NOT IN ('cancelled','completed','done');