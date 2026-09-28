-- Refactor the 5 token-bearing functions to read the service_role key from Database
-- Vault via public.edge_auth_header() instead of a hardcoded/passed token. No token
-- appears in this migration or the repo.

CREATE OR REPLACE FUNCTION public.notify_cleaner_on_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
BEGIN
  IF (OLD.assigned_cleaner_id IS NULL AND NEW.assigned_cleaner_id IS NOT NULL) THEN
    PERFORM net.http_post(
      url := 'https://pftqjrmdksrrpczhomln.supabase.co/functions/v1/notify-cleaner-schedule-update',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', public.edge_auth_header()),
      body := jsonb_build_object('taskId', NEW.id::text)
    );
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.notify_new_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_enabled boolean; v_secret text;
BEGIN
  SELECT booking_push_enabled, dispatch_secret INTO v_enabled, v_secret
    FROM public.notification_settings WHERE id = 1;
  IF v_enabled IS DISTINCT FROM true THEN RETURN NEW; END IF;
  IF NEW.notified_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.check_in IS NULL OR NEW.check_in < (now() AT TIME ZONE 'Europe/London')::date THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_at IS NULL OR now() - NEW.created_at > interval '10 minutes' THEN RETURN NEW; END IF;
  END IF;
  PERFORM net.http_post(
    url := 'https://pftqjrmdksrrpczhomln.supabase.co/functions/v1/send-booking-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', public.edge_auth_header(),
      'x-notify-secret', COALESCE(v_secret, '')
    ),
    body := jsonb_build_object('reservation_id', NEW.id)
  );
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.tg_notify_owner_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_event text;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'confirmed') THEN
    v_event := 'new';
  ELSIF (TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled') THEN
    v_event := 'cancelled';
  ELSE
    RETURN NEW;
  END IF;
  BEGIN
    PERFORM net.http_post(
      url := 'https://pftqjrmdksrrpczhomln.supabase.co/functions/v1/send-owner-booking-email',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', public.edge_auth_header()),
      body := jsonb_build_object('reservation_id', NEW.id, 'event', v_event)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'owner booking notify failed for reservation %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.trigger_today_task_allocation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_fire boolean := false;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.status = 'unassigned' AND NEW.scheduled_date = (now() AT TIME ZONE 'Europe/London')::date AND NEW.assigned_cleaner_id IS NULL THEN
      v_fire := true;
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.status = 'unassigned' AND NEW.assigned_cleaner_id IS NULL AND NEW.scheduled_date = (now() AT TIME ZONE 'Europe/London')::date AND (OLD.scheduled_date IS DISTINCT FROM NEW.scheduled_date) THEN
      v_fire := true;
    END IF;
  END IF;
  IF v_fire THEN
    PERFORM net.http_post(
      url := 'https://pftqjrmdksrrpczhomln.supabase.co/functions/v1/generate-daily-cleaning-schedule',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', public.edge_auth_header()),
      body := jsonb_build_object('date', NEW.scheduled_date::text, 'days_ahead', 1, 'source', 'reactive-today-allocation')
    );
  END IF;
  RETURN NEW;
END;
$fn$;

-- manage_hostaway_cron: schedule a command that resolves the auth header at RUNTIME via
-- edge_auth_header() (no token baked into the stored cron command). anon_key param kept
-- for call-site compatibility but ignored.
CREATE OR REPLACE FUNCTION public.manage_hostaway_cron(interval_hours integer, supabase_url text DEFAULT NULL::text, anon_key text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE _cron_expr text; _sql text;
BEGIN
  BEGIN PERFORM cron.unschedule('hostaway-auto-sync'); EXCEPTION WHEN OTHERS THEN NULL; END;
  IF interval_hours IS NULL OR interval_hours <= 0 THEN RETURN; END IF;
  CASE interval_hours
    WHEN 1  THEN _cron_expr := '0 * * * *';
    WHEN 3  THEN _cron_expr := '0 */3 * * *';
    WHEN 6  THEN _cron_expr := '0 */6 * * *';
    WHEN 12 THEN _cron_expr := '0 */12 * * *';
    WHEN 24 THEN _cron_expr := '0 4 * * *';
    ELSE _cron_expr := '0 */6 * * *';
  END CASE;
  _sql := format(
    'SELECT net.http_post(url:=%L, headers:=jsonb_build_object(''Content-Type'',''application/json'',''Authorization'', public.edge_auth_header()), body:=''{}''::jsonb) as request_id',
    supabase_url || '/functions/v1/hostaway-sync'
  );
  PERFORM cron.schedule('hostaway-auto-sync', _cron_expr, _sql);
END;
$fn$;
