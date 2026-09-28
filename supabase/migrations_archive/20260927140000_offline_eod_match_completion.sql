-- Item B: make the offline EOD job (a) complete cleans dated on/before today bounded
-- to the last 7 days (so a missed run can't leak an old open clean into carryover),
-- and (b) apply the same side-effects a normal app completion applies.
--
-- A normal completion (CleanerPortal.handleMarkComplete) does:
--   1. clean_tasks: status='completed', completed_at, completed_by_member
--   2. listings.is_clean = true
--   3. (automatic) trg_generate_turnover_charges fires AFTER UPDATE OF status
-- The EOD job matches 1 (completed_by_member stays NULL — it's assumed, distinguished
-- by completion_source='assumed_offline'), 2, and 3 (fires via the status update).
CREATE OR REPLACE FUNCTION public.complete_offline_cleans_eod()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_listings uuid[];
BEGIN
  WITH done AS (
    UPDATE public.clean_tasks ct
       SET status = 'completed',
           completion_source = 'assumed_offline',
           completed_at = COALESCE(ct.completed_at, now()),
           updated_at = now()
      FROM public.cleaners c
     WHERE ct.assigned_cleaner_id = c.id
       AND c.is_offline = true
       AND ct.scheduled_date <= (now() AT TIME ZONE 'Europe/London')::date
       AND ct.scheduled_date >= (now() AT TIME ZONE 'Europe/London')::date - 7
       AND ct.status NOT IN ('completed','done','cancelled','canceled')
     RETURNING ct.listing_id
  )
  SELECT count(*), array_agg(DISTINCT listing_id) INTO v_count, v_listings FROM done;

  IF v_listings IS NOT NULL THEN
    UPDATE public.listings SET is_clean = true WHERE id = ANY(v_listings);
  END IF;

  RETURN v_count;
END;
$$;
