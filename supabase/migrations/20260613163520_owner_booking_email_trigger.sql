-- Fire the owner booking email (edge function) on a new confirmed booking or a
-- cancellation. Async via pg_net + exception-wrapped so it can NEVER block the sync.
-- The edge function itself checks the owner's opt-in (off by default), so this is a
-- no-op until an owner enables booking notifications.
CREATE OR REPLACE FUNCTION public.tg_notify_owner_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event text;
  v_anon  text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmdHFqcm1ka3NycnBjemhvbWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTYyMzAsImV4cCI6MjA5MDI3MjIzMH0.pnIOzWvQOxPLUsf3srx4Qqdc73xUAOa8aenokDABMOA';
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
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_anon),
      body := jsonb_build_object('reservation_id', NEW.id, 'event', v_event)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'owner booking notify failed for reservation %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_owner_booking ON public.reservations;
CREATE TRIGGER trg_notify_owner_booking
  AFTER INSERT OR UPDATE OF status ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_owner_booking();
