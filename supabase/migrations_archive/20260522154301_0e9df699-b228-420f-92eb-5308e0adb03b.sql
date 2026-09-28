
-- 1. Dedupe existing rows: keep the best one per (listing_id, scheduled_date) among non-manual rows.
WITH ranked AS (
  SELECT
    id,
    listing_id,
    scheduled_date,
    ROW_NUMBER() OVER (
      PARTITION BY listing_id, scheduled_date
      ORDER BY
        CASE status
          WHEN 'completed' THEN 0
          WHEN 'done' THEN 0
          WHEN 'in_progress' THEN 1
          WHEN 'assigned' THEN 2
          WHEN 'scheduled' THEN 3
          WHEN 'unassigned' THEN 4
          ELSE 5
        END,
        CASE WHEN assigned_cleaner_id IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN override_assignment THEN 0 ELSE 1 END,
        created_at ASC
    ) AS rn
  FROM public.clean_tasks
  WHERE source <> 'manual'
)
DELETE FROM public.clean_tasks ct
USING ranked r
WHERE ct.id = r.id
  AND r.rn > 1;

-- 2. Prevent future duplicates among non-manual rows.
CREATE UNIQUE INDEX IF NOT EXISTS clean_tasks_unique_listing_date_nonmanual
  ON public.clean_tasks (listing_id, scheduled_date)
  WHERE source <> 'manual';
