-- Record in the repo the ~7 Sep production change that added a status predicate to
-- clean_tasks_unique_listing_date_nonmanual (applied to prod via untracked raw SQL,
-- to stop cancelled cleans holding the (listing_id, scheduled_date) slot). Committing
-- it here so the repo matches production and a fresh replay ends in the same state.
--
-- NOTE: this predicate is what the auto-clean trigger's ON CONFLICT must match — see
-- migration 20260925090001. Kept in sync deliberately.
DROP INDEX IF EXISTS clean_tasks_unique_listing_date_nonmanual;
CREATE UNIQUE INDEX clean_tasks_unique_listing_date_nonmanual
  ON public.clean_tasks (listing_id, scheduled_date)
  WHERE ((source <> 'manual'::text) AND (status <> ALL (ARRAY['cancelled'::text, 'canceled'::text])));
