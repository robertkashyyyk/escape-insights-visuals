-- Meeting spec item 2: Requests catalogue + per-booking requests + cleaner reminder
--
-- A catalogue of "Requests" (e.g. High Chair, Cot) that can be added to a booking
-- with quantities. The cleaner sees them on their job (icon-driven) and is reminded
-- of them at clean-completion before the standard "Are you sure?" confirm.

-- ===== Requests catalogue =====
CREATE TABLE IF NOT EXISTS public.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text,                                   -- lucide icon name or emoji
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.requests TO authenticated;
GRANT ALL ON public.requests TO service_role;

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- Catalogue is not sensitive — any signed-in user (incl. cleaners) can read it.
DROP POLICY IF EXISTS "Authenticated read requests" ON public.requests;
CREATE POLICY "Authenticated read requests" ON public.requests
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Super/Senior manage requests" ON public.requests;
CREATE POLICY "Super/Senior manage requests" ON public.requests
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role))
  WITH CHECK (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role));

DROP TRIGGER IF EXISTS trg_requests_updated_at ON public.requests;
CREATE TRIGGER trg_requests_updated_at
  BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ===== Per-booking requests =====
CREATE TABLE IF NOT EXISTS public.booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reservation_id, request_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_requests TO authenticated;
GRANT ALL ON public.booking_requests TO service_role;

CREATE INDEX IF NOT EXISTS idx_booking_requests_reservation ON public.booking_requests(reservation_id);

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage booking_requests" ON public.booking_requests;
CREATE POLICY "Staff manage booking_requests" ON public.booking_requests
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role));

-- A cleaner can read the requests for a reservation they are assigned to clean
-- (mirrors the "Cleaners can read task listings" pattern on listings).
DROP POLICY IF EXISTS "Cleaners read assigned booking_requests" ON public.booking_requests;
CREATE POLICY "Cleaners read assigned booking_requests" ON public.booking_requests
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clean_tasks ct
    JOIN public.cleaners c ON c.id = ct.assigned_cleaner_id
    WHERE ct.reservation_id = booking_requests.reservation_id
      AND c.user_id = auth.uid()
  ));

-- Seed a couple of common requests (idempotent by name).
INSERT INTO public.requests (name, icon, display_order)
SELECT v.name, v.icon, v.ord
FROM (VALUES ('High Chair','baby',0), ('Cot','crib',1), ('Travel Cot','crib',2), ('Extra Towels','bath',3)) AS v(name, icon, ord)
WHERE NOT EXISTS (SELECT 1 FROM public.requests r WHERE r.name = v.name);
