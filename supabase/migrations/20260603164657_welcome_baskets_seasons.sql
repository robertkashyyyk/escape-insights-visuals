-- Meeting spec item 8: Settings → Welcome Baskets (Seasons)
--
-- Seasons are recurring month/day ranges that tile the year (no gaps / no overlaps,
-- validated as a 365-day loop in the UI). A NEW booking whose check-in falls in a season
-- AND whose revenue exceeds that season's spend threshold auto-creates a welcome_basket
-- maintenance task. Fires on INSERT only (new bookings) so historical reservations and
-- routine re-syncs never mass-create tasks. Idempotent per reservation.

CREATE TABLE IF NOT EXISTS public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_month integer NOT NULL CHECK (start_month BETWEEN 1 AND 12),
  start_day integer NOT NULL CHECK (start_day BETWEEN 1 AND 31),
  end_month integer NOT NULL CHECK (end_month BETWEEN 1 AND 12),
  end_day integer NOT NULL CHECK (end_day BETWEEN 1 AND 31),
  spend_threshold numeric(10,2) NOT NULL DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seasons TO authenticated;
GRANT ALL ON public.seasons TO service_role;

DROP TRIGGER IF EXISTS trg_seasons_updated_at ON public.seasons;
CREATE TRIGGER trg_seasons_updated_at BEFORE UPDATE ON public.seasons
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff manage seasons" ON public.seasons;
CREATE POLICY "Staff manage seasons" ON public.seasons
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role));

-- Seed defaults that tile the year (Jan 1 → Dec 31), thresholds 0 (set per season in UI).
INSERT INTO public.seasons (name, start_month, start_day, end_month, end_day, display_order)
SELECT * FROM (VALUES
  ('Winter',1,1,3,19,0),
  ('Spring',3,20,4,9,1),
  ('Easter',4,10,4,21,2),
  ('Early Summer',4,22,6,20,3),
  ('Summer',6,21,8,31,4),
  ('Autumn',9,1,11,30,5),
  ('Christmas',12,1,12,31,6)
) AS v(name, sm, sd, em, ed, ord)
WHERE NOT EXISTS (SELECT 1 FROM public.seasons);

-- Link welcome-basket tasks to their booking (idempotency).
ALTER TABLE public.maintenance_tasks
  ADD COLUMN IF NOT EXISTS reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_welcome_basket_per_reservation
  ON public.maintenance_tasks(reservation_id) WHERE source = 'welcome_basket';

-- Welcome-basket generator. Exception-wrapped so it can NEVER block reservation sync.
CREATE OR REPLACE FUNCTION public.tg_create_welcome_basket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mmdd int;
  v_threshold numeric;
  v_season text;
BEGIN
  IF NEW.check_in IS NULL OR NEW.total_amount IS NULL OR NEW.listing_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS NOT NULL AND lower(NEW.status) IN ('cancelled','canceled') THEN
    RETURN NEW;
  END IF;
  BEGIN
    v_mmdd := EXTRACT(MONTH FROM NEW.check_in)::int * 100 + EXTRACT(DAY FROM NEW.check_in)::int;
    SELECT name, spend_threshold INTO v_season, v_threshold
    FROM public.seasons
    WHERE CASE
      WHEN (start_month*100+start_day) <= (end_month*100+end_day)
        THEN v_mmdd BETWEEN (start_month*100+start_day) AND (end_month*100+end_day)
        ELSE v_mmdd >= (start_month*100+start_day) OR v_mmdd <= (end_month*100+end_day)
    END
    ORDER BY display_order
    LIMIT 1;

    IF FOUND AND NEW.total_amount > v_threshold THEN
      INSERT INTO public.maintenance_tasks (title, type, scope, status, listing_id, source, reservation_id)
      VALUES (
        'Welcome Basket — ' || COALESCE(NEW.guest_name, 'Guest') || ' (' || v_season || ')',
        'setup', 'property', 'pending', NEW.listing_id, 'welcome_basket', NEW.id
      )
      ON CONFLICT (reservation_id) WHERE source = 'welcome_basket' DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'welcome basket trigger failed for reservation %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_welcome_basket ON public.reservations;
CREATE TRIGGER trg_welcome_basket
  AFTER INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.tg_create_welcome_basket();
