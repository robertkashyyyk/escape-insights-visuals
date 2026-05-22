
-- Structured cleaning priority levels (P0–P3)
-- 0 = Arrival-Risk Orphan Carryover (highest)
-- 1 = Same-Day Turnaround (STO)
-- 2 = Standard Checkout
-- 3 = Orphan Gap Fill (lowest, opportunistic)

ALTER TABLE public.clean_tasks
  ADD COLUMN IF NOT EXISTS priority_level smallint NOT NULL DEFAULT 2;

-- Backfill from existing data:
--  - is_same_day_turnaround → P1
--  - everything else → P2 (already the default)
UPDATE public.clean_tasks
   SET priority_level = 1
 WHERE is_same_day_turnaround = true
   AND priority_level = 2;

-- Helpful index for sorting / filtering by urgency
CREATE INDEX IF NOT EXISTS idx_clean_tasks_priority_level
  ON public.clean_tasks (scheduled_date, priority_level);

COMMENT ON COLUMN public.clean_tasks.priority_level IS
  '0=P0 arrival-risk orphan carryover, 1=P1 same-day turnaround, 2=P2 standard checkout, 3=P3 orphan-gap fill';
