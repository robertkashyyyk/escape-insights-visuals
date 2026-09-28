CREATE TABLE app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_by uuid,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super can manage settings"
  ON app_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super'))
  WITH CHECK (has_role(auth.uid(), 'super'));