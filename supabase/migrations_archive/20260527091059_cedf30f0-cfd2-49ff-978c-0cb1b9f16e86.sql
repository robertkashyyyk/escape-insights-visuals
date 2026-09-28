-- Audit log for manual property cleaning state resets
CREATE TABLE public.clean_state_resets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid NOT NULL,
  previous_state text,
  new_state text NOT NULL CHECK (new_state IN ('clean','dirty')),
  reason text,
  note text,
  reset_by uuid,
  reset_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clean_state_resets_listing_id ON public.clean_state_resets(listing_id);
CREATE INDEX idx_clean_state_resets_reset_at ON public.clean_state_resets(reset_at DESC);

GRANT SELECT, INSERT ON public.clean_state_resets TO authenticated;
GRANT ALL ON public.clean_state_resets TO service_role;

ALTER TABLE public.clean_state_resets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read clean_state_resets"
  ON public.clean_state_resets FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'super'::app_role) OR
    has_role(auth.uid(), 'senior'::app_role) OR
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Staff can insert clean_state_resets"
  ON public.clean_state_resets FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      has_role(auth.uid(), 'super'::app_role) OR
      has_role(auth.uid(), 'senior'::app_role) OR
      has_role(auth.uid(), 'admin'::app_role)
    )
    AND reset_by = auth.uid()
  );