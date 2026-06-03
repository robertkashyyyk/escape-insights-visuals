-- Meeting spec items 5 + 6: Communal Groups + per-property communal/fee fields
--
-- Communal Group: a named grouping of properties that share communal costs.
-- A property belongs to AT MOST ONE communal group (single FK on listings).
-- communal_ratio_pct is the property's fixed share of communal costs; across a
-- group the ratios must sum to exactly 100% (hard-blocked in the app on save).
-- Allocation: each property's share = bill_total * (communal_ratio_pct / 100).
--
-- NOTE: "region" in this codebase is listings.location_group (text -> location_groups).
-- Communal Group is a DISTINCT concept and does not touch regions.

-- ===== Communal Groups =====
CREATE TABLE IF NOT EXISTS public.communal_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.communal_groups TO authenticated;
GRANT ALL ON public.communal_groups TO service_role;

ALTER TABLE public.communal_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read communal_groups" ON public.communal_groups;
CREATE POLICY "Staff read communal_groups" ON public.communal_groups
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS "Super/Senior manage communal_groups" ON public.communal_groups;
CREATE POLICY "Super/Senior manage communal_groups" ON public.communal_groups
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role))
  WITH CHECK (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role));

DROP TRIGGER IF EXISTS trg_communal_groups_updated_at ON public.communal_groups;
CREATE TRIGGER trg_communal_groups_updated_at
  BEFORE UPDATE ON public.communal_groups
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ===== Per-property fields (item 5) =====
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS cleaning_fee numeric(10,2),
  ADD COLUMN IF NOT EXISTS deep_fee numeric(10,2),
  ADD COLUMN IF NOT EXISTS is_communal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS communal_ratio_pct numeric(6,3),
  ADD COLUMN IF NOT EXISTS communal_group_id uuid REFERENCES public.communal_groups(id) ON DELETE SET NULL;

-- ratio must be 0..100 when present
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_communal_ratio_pct_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_communal_ratio_pct_check
  CHECK (communal_ratio_pct IS NULL OR (communal_ratio_pct >= 0 AND communal_ratio_pct <= 100));

CREATE INDEX IF NOT EXISTS idx_listings_communal_group ON public.listings(communal_group_id);

-- Helper: sum of communal ratios for a group (for app-side validation / reporting).
-- Returns the total of communal_ratio_pct across communal properties in the group.
-- SECURITY INVOKER: respects the caller's RLS on listings (no need to bypass it),
-- and EXECUTE is revoked from anon so it is staff-only.
CREATE OR REPLACE FUNCTION public.communal_group_ratio_sum(p_group_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(communal_ratio_pct), 0)
  FROM public.listings
  WHERE communal_group_id = p_group_id AND is_communal = true;
$$;

REVOKE EXECUTE ON FUNCTION public.communal_group_ratio_sum(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.communal_group_ratio_sum(uuid) TO authenticated, service_role;
