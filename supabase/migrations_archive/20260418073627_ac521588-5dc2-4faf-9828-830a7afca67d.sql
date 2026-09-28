ALTER TABLE public.clean_tasks
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'hostaway',
  ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'clean',
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_clean_tasks_scheduled_date ON public.clean_tasks(scheduled_date);

ALTER PUBLICATION supabase_realtime ADD TABLE public.clean_tasks;
ALTER TABLE public.clean_tasks REPLICA IDENTITY FULL;