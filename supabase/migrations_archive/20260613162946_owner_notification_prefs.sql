-- Owner notification preferences (self-serve, off by default).
-- Kept in a dedicated table so owners can toggle their own prefs WITHOUT update
-- access to sensitive property_owners fields (management rate, etc.).
--
-- notify_bookings : email on a new confirmed booking AND on a cancellation (one toggle).
-- notify_orin     : opt-in to Orin digest emails.
-- orin_frequency  : weekly (Mon 10am UK) / monthly (1st 11am UK) / both.

CREATE TABLE IF NOT EXISTS public.owner_notification_prefs (
  owner_id uuid PRIMARY KEY REFERENCES public.property_owners(id) ON DELETE CASCADE,
  notify_bookings boolean NOT NULL DEFAULT false,
  notify_orin boolean NOT NULL DEFAULT false,
  orin_frequency text NOT NULL DEFAULT 'weekly' CHECK (orin_frequency IN ('weekly','monthly','both')),
  -- guards so a digest is never double-sent in the same period
  last_weekly_sent date,
  last_monthly_sent date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_notification_prefs TO authenticated;
GRANT ALL ON public.owner_notification_prefs TO service_role;

DROP TRIGGER IF EXISTS trg_owner_notification_prefs_updated_at ON public.owner_notification_prefs;
CREATE TRIGGER trg_owner_notification_prefs_updated_at BEFORE UPDATE ON public.owner_notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.owner_notification_prefs ENABLE ROW LEVEL SECURITY;

-- The owner (client) may read + upsert their OWN prefs (matched via property_owners.user_id).
DROP POLICY IF EXISTS "Owner manages own prefs" ON public.owner_notification_prefs;
CREATE POLICY "Owner manages own prefs" ON public.owner_notification_prefs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.property_owners po WHERE po.id = owner_notification_prefs.owner_id AND po.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.property_owners po WHERE po.id = owner_notification_prefs.owner_id AND po.user_id = auth.uid()));

-- Staff can manage all (for support + the scheduled sender uses service_role anyway).
DROP POLICY IF EXISTS "Staff manage owner prefs" ON public.owner_notification_prefs;
CREATE POLICY "Staff manage owner prefs" ON public.owner_notification_prefs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role));
