
-- 1) Auto-cancel clean tasks when their reservation is cancelled/declined/expired
CREATE OR REPLACE FUNCTION public.cancel_clean_on_reservation_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS NOT NULL
     AND lower(NEW.status) IN ('cancelled','canceled','declined','expired')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.clean_tasks
       SET status = 'cancelled', updated_at = now()
     WHERE reservation_id = NEW.id
       AND COALESCE(status,'') NOT IN ('completed','done','cancelled');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_clean_on_reservation_cancel ON public.reservations;
CREATE TRIGGER trg_cancel_clean_on_reservation_cancel
AFTER UPDATE OF status ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.cancel_clean_on_reservation_cancel();

-- 2) Backfill: cancel currently-open clean tasks tied to already-cancelled reservations
UPDATE public.clean_tasks ct
   SET status = 'cancelled', updated_at = now()
  FROM public.reservations r
 WHERE ct.reservation_id = r.id
   AND lower(COALESCE(r.status,'')) IN ('cancelled','canceled','declined','expired')
   AND COALESCE(ct.status,'') NOT IN ('completed','done','cancelled');
