CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('nightly-generate-cleaning-schedule');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'nightly-generate-cleaning-schedule',
  '0 2 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://pftqjrmdksrrpczhomln.supabase.co/functions/v1/generate-daily-cleaning-schedule',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmdHFqcm1ka3NycnBjemhvbWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTYyMzAsImV4cCI6MjA5MDI3MjIzMH0.pnIOzWvQOxPLUsf3srx4Qqdc73xUAOa8aenokDABMOA"}'::jsonb,
    body := '{"days_ahead": 30}'::jsonb
  );
  $cron$
);