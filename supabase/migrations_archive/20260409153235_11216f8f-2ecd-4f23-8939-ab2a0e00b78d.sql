
CREATE OR REPLACE FUNCTION public.manage_hostaway_cron(
  interval_hours int,
  supabase_url text DEFAULT NULL,
  anon_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _cron_expr text;
  _sql text;
BEGIN
  -- Remove existing job if any
  BEGIN
    PERFORM cron.unschedule('hostaway-auto-sync');
  EXCEPTION WHEN OTHERS THEN
    -- job doesn't exist, that's fine
  END;

  -- If interval is 0 or null, just disable
  IF interval_hours IS NULL OR interval_hours <= 0 THEN
    RETURN;
  END IF;

  -- Build cron expression
  CASE interval_hours
    WHEN 1  THEN _cron_expr := '0 * * * *';
    WHEN 3  THEN _cron_expr := '0 */3 * * *';
    WHEN 6  THEN _cron_expr := '0 */6 * * *';
    WHEN 12 THEN _cron_expr := '0 */12 * * *';
    WHEN 24 THEN _cron_expr := '0 4 * * *';
    ELSE _cron_expr := '0 */6 * * *';
  END CASE;

  _sql := format(
    'SELECT net.http_post(url:=%L, headers:=%L::jsonb, body:=%L::jsonb) as request_id',
    supabase_url || '/functions/v1/hostaway-sync',
    json_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || anon_key)::text,
    '{}'
  );

  PERFORM cron.schedule('hostaway-auto-sync', _cron_expr, _sql);
END;
$fn$;
