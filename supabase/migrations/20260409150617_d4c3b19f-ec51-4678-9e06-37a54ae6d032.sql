
CREATE TABLE public.sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL DEFAULT 'full',
  status text NOT NULL DEFAULT 'running',
  listings_synced integer DEFAULT 0,
  reservations_synced integer DEFAULT 0,
  reservations_skipped integer DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  triggered_by uuid
);

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super/Senior can manage sync_logs"
  ON public.sync_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super'::app_role) OR has_role(auth.uid(), 'senior'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super'::app_role) OR has_role(auth.uid(), 'senior'::app_role));

CREATE POLICY "Admin can read sync_logs"
  ON public.sync_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add unique constraint on hostaway_reservation_id for upsert dedup
CREATE UNIQUE INDEX IF NOT EXISTS uq_reservations_hostaway_id
  ON public.reservations (hostaway_reservation_id)
  WHERE hostaway_reservation_id IS NOT NULL;
