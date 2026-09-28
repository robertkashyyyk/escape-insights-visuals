
CREATE TABLE IF NOT EXISTS public.location_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_order integer NOT NULL DEFAULT 0,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.location_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read location_groups"
ON public.location_groups FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super'::app_role)
  OR has_role(auth.uid(), 'senior'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Super/Senior manage location_groups"
ON public.location_groups FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super'::app_role) OR has_role(auth.uid(), 'senior'::app_role))
WITH CHECK (has_role(auth.uid(), 'super'::app_role) OR has_role(auth.uid(), 'senior'::app_role));

CREATE TRIGGER trg_location_groups_updated_at
BEFORE UPDATE ON public.location_groups
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed with the location groups currently in use on listings
INSERT INTO public.location_groups (name, display_order)
SELECT DISTINCT location_group,
       row_number() OVER (ORDER BY location_group)
FROM public.listings
WHERE location_group IS NOT NULL AND location_group <> ''
ON CONFLICT (name) DO NOTHING;
