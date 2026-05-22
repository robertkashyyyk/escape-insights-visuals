
CREATE TABLE public.cleaner_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cleaner_id UUID NOT NULL REFERENCES public.cleaners(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL DEFAULT 'Holiday',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cleaner_holidays_dates_valid CHECK (end_date >= start_date)
);

CREATE INDEX idx_cleaner_holidays_cleaner ON public.cleaner_holidays(cleaner_id);
CREATE INDEX idx_cleaner_holidays_dates ON public.cleaner_holidays(start_date, end_date);

ALTER TABLE public.cleaner_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super/Senior manage cleaner_holidays"
ON public.cleaner_holidays
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super'::app_role) OR public.has_role(auth.uid(), 'senior'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super'::app_role) OR public.has_role(auth.uid(), 'senior'::app_role));

CREATE POLICY "Admin can read cleaner_holidays"
ON public.cleaner_holidays
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Cleaners can read own holidays"
ON public.cleaner_holidays
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.cleaners c WHERE c.id = cleaner_holidays.cleaner_id AND c.user_id = auth.uid()));

CREATE TRIGGER tg_cleaner_holidays_updated_at
BEFORE UPDATE ON public.cleaner_holidays
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
