-- Phase 1 step 3: offline-cleaner flag.
-- Some cleaners have no app login and never mark cleans complete, so their cleans
-- stay open, roll forward, and churn (carryover -> re-occupancy cancel -> re-insert).
-- An offline cleaner's cleans are auto-completed at end of day with
-- completion_source='assumed_offline', so they never carry over, and reporting/pay
-- can separate verified completions from assumed ones.
--
-- NOTE: default false; this migration does NOT enable it for anyone — that is Ryan's
-- call via the cleaner settings toggle.
ALTER TABLE public.cleaners   ADD COLUMN IF NOT EXISTS is_offline boolean NOT NULL DEFAULT false;
ALTER TABLE public.clean_tasks ADD COLUMN IF NOT EXISTS completion_source text;

-- End-of-day completion for offline cleaners' cleans (London day). Pure SQL, no HTTP.
CREATE OR REPLACE FUNCTION public.complete_offline_cleans_eod()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.clean_tasks ct
     SET status = 'completed',
         completion_source = 'assumed_offline',
         completed_at = COALESCE(ct.completed_at, now()),
         updated_at = now()
    FROM public.cleaners c
   WHERE ct.assigned_cleaner_id = c.id
     AND c.is_offline = true
     AND ct.scheduled_date = (now() AT TIME ZONE 'Europe/London')::date
     AND ct.status NOT IN ('completed','done','cancelled','canceled');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Schedule at 20:00 UTC daily (~21:00 London BST / 20:00 GMT — end of working day).
-- Unschedule first so re-applying the migration is idempotent.
DO $$
BEGIN
  PERFORM cron.unschedule('complete-offline-cleans-eod');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
SELECT cron.schedule('complete-offline-cleans-eod', '0 20 * * *', $$SELECT public.complete_offline_cleans_eod();$$);
