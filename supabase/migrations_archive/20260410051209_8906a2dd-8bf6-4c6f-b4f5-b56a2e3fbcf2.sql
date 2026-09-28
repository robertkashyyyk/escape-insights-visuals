CREATE TABLE public.orin_briefs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_type text NOT NULL CHECK (period_type IN ('monthly', 'quarterly')),
  period_label text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  content jsonb,
  status text NOT NULL DEFAULT 'generating' CHECK (status IN ('generated', 'generating', 'failed')),
  generated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (period_type, period_label)
);

ALTER TABLE public.orin_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super/Senior/Admin can read orin_briefs"
ON public.orin_briefs FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super'::app_role)
  OR has_role(auth.uid(), 'senior'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Super/Senior can manage orin_briefs"
ON public.orin_briefs FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'super'::app_role)
  OR has_role(auth.uid(), 'senior'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super'::app_role)
  OR has_role(auth.uid(), 'senior'::app_role)
);