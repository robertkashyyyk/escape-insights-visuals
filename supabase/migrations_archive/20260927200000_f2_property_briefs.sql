-- F2: ops briefs (photos + instructions) for the next clean of a property. An ops user
-- adds a brief from the property page; the cleaner sees it pinned before and during the
-- clean and acknowledges ("Understood"), which attaches it to that clean. Resolved
-- briefs stay on the property history. Reuses the clean-issue-photos storage bucket.
CREATE TABLE IF NOT EXISTS public.property_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_by uuid,
  body text NOT NULL,
  photo_paths text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_by_clean_task_id uuid REFERENCES public.clean_tasks(id) ON DELETE SET NULL,
  consumed_at timestamptz,
  consumed_by_member text,
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_property_briefs_listing_open
  ON public.property_briefs(listing_id) WHERE resolved_at IS NULL;

ALTER TABLE public.property_briefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS property_briefs_rw ON public.property_briefs;
CREATE POLICY property_briefs_rw ON public.property_briefs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
