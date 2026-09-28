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
    headers := '{"Content-Type":"application/json","Authorization":"Bearer REDACTED_USE_edge_auth_header"}'::jsonb,
    body := '{"days_ahead": 30}'::jsonb
  );
  $cron$
);