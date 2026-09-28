-- Re-point the token-bearing cron jobs at edge_auth_header() so the service_role key is
-- resolved from Database Vault at runtime — no token stored in the cron command.
SELECT cron.schedule('nightly-generate-cleaning-schedule','0 2 * * *',
  $$SELECT net.http_post(url:='https://pftqjrmdksrrpczhomln.supabase.co/functions/v1/generate-daily-cleaning-schedule', headers:=jsonb_build_object('Content-Type','application/json','Authorization', public.edge_auth_header()), body:='{"days_ahead": 30}'::jsonb);$$);
SELECT cron.schedule('morning-generate-cleaning-schedule','0 5 * * *',
  $$SELECT net.http_post(url:='https://pftqjrmdksrrpczhomln.supabase.co/functions/v1/generate-daily-cleaning-schedule', headers:=jsonb_build_object('Content-Type','application/json','Authorization', public.edge_auth_header()), body:='{"days_ahead": 7}'::jsonb);$$);
SELECT cron.schedule('orin-weekly-digest','0 9 * * 1',
  $$SELECT net.http_post(url:='https://pftqjrmdksrrpczhomln.supabase.co/functions/v1/send-owner-orin-digest', headers:=jsonb_build_object('Content-Type','application/json','Authorization', public.edge_auth_header()), body:=jsonb_build_object('owner_id', po.id, 'period', 'weekly')) FROM public.property_owners po JOIN public.owner_notification_prefs p ON p.owner_id = po.id WHERE p.notify_orin = true AND p.orin_frequency IN ('weekly','both');$$);
SELECT cron.schedule('orin-monthly-digest','0 10 1 * *',
  $$SELECT net.http_post(url:='https://pftqjrmdksrrpczhomln.supabase.co/functions/v1/send-owner-orin-digest', headers:=jsonb_build_object('Content-Type','application/json','Authorization', public.edge_auth_header()), body:=jsonb_build_object('owner_id', po.id, 'period', 'monthly')) FROM public.property_owners po JOIN public.owner_notification_prefs p ON p.owner_id = po.id WHERE p.notify_orin = true AND p.orin_frequency IN ('monthly','both');$$);
SELECT cron.schedule('hostaway-auto-sync','0 * * * *',
  $$SELECT net.http_post(url:='https://pftqjrmdksrrpczhomln.supabase.co/functions/v1/hostaway-sync', headers:=jsonb_build_object('Content-Type','application/json','Authorization', public.edge_auth_header()), body:='{}'::jsonb) as request_id;$$);
