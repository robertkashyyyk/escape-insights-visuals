SELECT cron.schedule(
  'morning-generate-cleaning-schedule',
  '0 5 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://pftqjrmdksrrpczhomln.supabase.co/functions/v1/generate-daily-cleaning-schedule',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer REDACTED_USE_edge_auth_header"}'::jsonb,
    body := '{"days_ahead": 7}'::jsonb
   );
  $cron$
);