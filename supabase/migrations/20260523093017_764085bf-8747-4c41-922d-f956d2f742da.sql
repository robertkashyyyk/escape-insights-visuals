
-- Part 2: Notify on cleaner assignment
CREATE OR REPLACE FUNCTION public.notify_cleaner_on_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.assigned_cleaner_id IS NULL AND NEW.assigned_cleaner_id IS NOT NULL) THEN
    PERFORM net.http_post(
      url := 'https://pftqjrmdksrrpczhomln.supabase.co/functions/v1/notify-cleaner-schedule-update',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmdHFqcm1ka3NycnBjemhvbWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTYyMzAsImV4cCI6MjA5MDI3MjIzMH0.pnIOzWvQOxPLUsf3srx4Qqdc73xUAOa8aenokDABMOA'
      ),
      body := jsonb_build_object('taskId', NEW.id::text)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_cleaner_assigned ON public.clean_tasks;
CREATE TRIGGER on_cleaner_assigned
  AFTER UPDATE ON public.clean_tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_cleaner_on_assignment();

-- Part 3: Reactive same-day allocation
CREATE OR REPLACE FUNCTION public.trigger_today_task_allocation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fire boolean := false;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.status = 'unassigned'
       AND NEW.scheduled_date = (now() AT TIME ZONE 'Europe/London')::date
       AND NEW.assigned_cleaner_id IS NULL THEN
      v_fire := true;
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.status = 'unassigned'
       AND NEW.assigned_cleaner_id IS NULL
       AND NEW.scheduled_date = (now() AT TIME ZONE 'Europe/London')::date
       AND (OLD.scheduled_date IS DISTINCT FROM NEW.scheduled_date) THEN
      v_fire := true;
    END IF;
  END IF;

  IF v_fire THEN
    PERFORM net.http_post(
      url := 'https://pftqjrmdksrrpczhomln.supabase.co/functions/v1/generate-daily-cleaning-schedule',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmdHFqcm1ka3NycnBjemhvbWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTYyMzAsImV4cCI6MjA5MDI3MjIzMH0.pnIOzWvQOxPLUsf3srx4Qqdc73xUAOa8aenokDABMOA'
      ),
      body := jsonb_build_object('date', NEW.scheduled_date::text, 'days_ahead', 1)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_today_task_created ON public.clean_tasks;
CREATE TRIGGER on_today_task_created
  AFTER INSERT OR UPDATE ON public.clean_tasks
  FOR EACH ROW EXECUTE FUNCTION public.trigger_today_task_allocation();
