
-- Create cleaners table
CREATE TABLE public.cleaners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  region text NOT NULL DEFAULT 'Other',
  non_working_days text[] DEFAULT '{}',
  max_cleans_per_day integer DEFAULT 3,
  rate_per_clean numeric DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cleaners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super/Senior can manage cleaners" ON public.cleaners
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super') OR has_role(auth.uid(), 'senior'))
  WITH CHECK (has_role(auth.uid(), 'super') OR has_role(auth.uid(), 'senior'));

CREATE POLICY "Admin can read cleaners" ON public.cleaners
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));
