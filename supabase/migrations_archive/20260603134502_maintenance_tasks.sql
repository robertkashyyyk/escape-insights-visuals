-- Meeting spec items 7 + 9: Maintenance task list (+ Setup type, + scope, + manual add)
--
-- Proactive maintenance/setup TASKS with an accept/done/postpone lifecycle and a
-- billable/non-billable outcome set on completion. Distinct from clean_issues
-- (reactive issues reported during cleans) and property_maintenance_log (history log).
--
-- - type:   maintenance | setup            (setup follows the exact same flow)
-- - scope:  property | communal            (property -> listing_id, communal -> communal_group_id)
-- - status: pending -> accepted -> done    (or -> postponed)
-- - billable: set on completion; billable tasks feed the owner report.
--   Communal billable tasks allocate cost across the group by Communal Ratio %.
-- - source: manual | welcome_basket        (welcome_basket auto-created by item 8)

CREATE TABLE IF NOT EXISTS public.maintenance_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'maintenance' CHECK (type IN ('maintenance','setup')),
  scope text NOT NULL DEFAULT 'property' CHECK (scope IN ('property','communal')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','done','postponed')),
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  communal_group_id uuid REFERENCES public.communal_groups(id) ON DELETE SET NULL,
  billable boolean,
  cost numeric(10,2),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','welcome_basket')),
  postpone_reason text,
  postponed_until date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- A property task needs a listing; a communal task needs a communal group.
  CONSTRAINT maintenance_tasks_scope_ck CHECK (
    (scope = 'property'  AND listing_id IS NOT NULL) OR
    (scope = 'communal'  AND communal_group_id IS NOT NULL)
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_tasks TO authenticated;
GRANT ALL ON public.maintenance_tasks TO service_role;

CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_status ON public.maintenance_tasks(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_listing ON public.maintenance_tasks(listing_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_group ON public.maintenance_tasks(communal_group_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_source ON public.maintenance_tasks(source);

ALTER TABLE public.maintenance_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage maintenance_tasks" ON public.maintenance_tasks;
CREATE POLICY "Staff manage maintenance_tasks" ON public.maintenance_tasks
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role));

DROP TRIGGER IF EXISTS trg_maintenance_tasks_updated_at ON public.maintenance_tasks;
CREATE TRIGGER trg_maintenance_tasks_updated_at
  BEFORE UPDATE ON public.maintenance_tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
