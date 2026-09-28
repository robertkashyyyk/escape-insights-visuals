ALTER TABLE public.clean_tasks
  ADD COLUMN IF NOT EXISTS overloaded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_assignment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS warning_reason text;

CREATE INDEX IF NOT EXISTS idx_clean_tasks_overloaded ON public.clean_tasks(overloaded) WHERE overloaded = true;
CREATE INDEX IF NOT EXISTS idx_clean_tasks_override ON public.clean_tasks(override_assignment) WHERE override_assignment = true;