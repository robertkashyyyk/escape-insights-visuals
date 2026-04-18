-- Create clean_issues table
CREATE TABLE public.clean_issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  clean_task_id UUID REFERENCES public.clean_tasks(id) ON DELETE SET NULL,
  reported_by_cleaner_id UUID REFERENCES public.cleaners(id) ON DELETE SET NULL,
  reported_by_user_id UUID,
  issue_type TEXT NOT NULL,
  description TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  photo_paths TEXT[] DEFAULT '{}',
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clean_issues_urgency_check CHECK (urgency IN ('low','medium','urgent')),
  CONSTRAINT clean_issues_status_check CHECK (status IN ('open','acknowledged','resolved'))
);

CREATE INDEX idx_clean_issues_status ON public.clean_issues(status);
CREATE INDEX idx_clean_issues_listing ON public.clean_issues(listing_id);
CREATE INDEX idx_clean_issues_created ON public.clean_issues(created_at DESC);

ALTER TABLE public.clean_issues ENABLE ROW LEVEL SECURITY;

-- Cleaners can insert issues
CREATE POLICY "Cleaners can create issues"
ON public.clean_issues FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.cleaners c WHERE c.id = reported_by_cleaner_id AND c.user_id = auth.uid())
);

-- Cleaners can view their own issues
CREATE POLICY "Cleaners can view own issues"
ON public.clean_issues FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.cleaners c WHERE c.id = reported_by_cleaner_id AND c.user_id = auth.uid())
);

-- Super/Senior/Admin can view all issues
CREATE POLICY "Staff can view all issues"
ON public.clean_issues FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super'::app_role)
  OR has_role(auth.uid(), 'senior'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Super/Senior can manage all issues
CREATE POLICY "Super/Senior can manage issues"
ON public.clean_issues FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'super'::app_role) OR has_role(auth.uid(), 'senior'::app_role))
WITH CHECK (has_role(auth.uid(), 'super'::app_role) OR has_role(auth.uid(), 'senior'::app_role));

CREATE POLICY "Super can delete issues"
ON public.clean_issues FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'super'::app_role));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_clean_issues_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_clean_issues_updated_at
BEFORE UPDATE ON public.clean_issues
FOR EACH ROW EXECUTE FUNCTION public.update_clean_issues_updated_at();

-- Storage bucket for issue photos (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('clean-issue-photos', 'clean-issue-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Cleaners can upload photos to their own folder (folder = cleaner user_id)
CREATE POLICY "Cleaners upload issue photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'clean-issue-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Cleaners view own issue photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'clean-issue-photos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'super'::app_role)
    OR has_role(auth.uid(), 'senior'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Staff manage issue photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'clean-issue-photos'
  AND (has_role(auth.uid(), 'super'::app_role) OR has_role(auth.uid(), 'senior'::app_role))
);