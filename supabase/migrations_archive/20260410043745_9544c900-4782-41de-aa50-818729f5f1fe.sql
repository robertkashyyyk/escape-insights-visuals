
ALTER TABLE public.cleaners DROP COLUMN max_cleans_per_day;
ALTER TABLE public.cleaners ADD COLUMN daily_working_hours numeric NOT NULL DEFAULT 8;
