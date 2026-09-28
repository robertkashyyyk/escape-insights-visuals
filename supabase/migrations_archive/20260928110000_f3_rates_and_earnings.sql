-- F3: cleaner pay rates + earnings. Rates are pay data — only staff (super/senior) may
-- read/write them; cleaners never read rates directly, only their OWN computed totals via
-- the SECURITY DEFINER my_earnings() RPC.
--
-- Override chain: cleaner×property (cleaner_property_rates) → property (property_clean_rates)
-- → cleaner default (cleaners.rate_per_clean).

CREATE TABLE IF NOT EXISTS public.property_clean_rates (
  listing_id uuid PRIMARY KEY REFERENCES public.listings(id) ON DELETE CASCADE,
  rate numeric NOT NULL CHECK (rate >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cleaner_property_rates (
  cleaner_id uuid NOT NULL REFERENCES public.cleaners(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  rate numeric NOT NULL CHECK (rate >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cleaner_id, listing_id)
);

ALTER TABLE public.property_clean_rates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaner_property_rates ENABLE ROW LEVEL SECURITY;

-- Super/senior only (pay data). Cleaners + admin get no direct access.
DROP POLICY IF EXISTS pcr_staff ON public.property_clean_rates;
CREATE POLICY pcr_staff ON public.property_clean_rates FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role))
  WITH CHECK (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role));
DROP POLICY IF EXISTS cpr_staff ON public.cleaner_property_rates;
CREATE POLICY cpr_staff ON public.cleaner_property_rates FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role))
  WITH CHECK (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role));

-- Calling cleaner's own earnings for a month. Returns only their totals; never exposes
-- rates. Counts at most one clean per (reservation, listing); excludes assumed_offline.
CREATE OR REPLACE FUNCTION public.my_earnings(p_month date DEFAULT ((now() AT TIME ZONE 'Europe/London')::date))
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cleaner uuid;
  v_default numeric;
  v_start date := date_trunc('month', p_month)::date;
  v_end   date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_result jsonb;
BEGIN
  SELECT id, rate_per_clean INTO v_cleaner, v_default FROM public.cleaners WHERE user_id = auth.uid();
  IF v_cleaner IS NULL THEN
    RETURN jsonb_build_object('has_rate', false, 'earned', 0, 'due', 0, 'by_member', '[]'::jsonb);
  END IF;

  WITH base AS (
    SELECT ct.id, ct.status, ct.completed_by_member,
           COALESCE(cpr.rate, pcr.rate, v_default) AS rate,
           row_number() OVER (
             PARTITION BY CASE WHEN ct.reservation_id IS NULL THEN ct.id::text
                               ELSE ct.reservation_id::text || ':' || ct.listing_id::text END
             ORDER BY (ct.status IN ('completed','done')) DESC, ct.completed_at DESC NULLS LAST
           ) AS rn
    FROM public.clean_tasks ct
    LEFT JOIN public.cleaner_property_rates cpr ON cpr.cleaner_id = v_cleaner AND cpr.listing_id = ct.listing_id
    LEFT JOIN public.property_clean_rates  pcr ON pcr.listing_id = ct.listing_id
    WHERE ct.assigned_cleaner_id = v_cleaner
      AND ct.scheduled_date >= v_start AND ct.scheduled_date < v_end
      AND ct.status NOT IN ('cancelled','canceled')
      AND COALESCE(ct.completion_source,'') <> 'assumed_offline'
  ), dedup AS (SELECT * FROM base WHERE rn = 1)
  SELECT jsonb_build_object(
    'has_rate', (COALESCE(v_default,0) > 0) OR EXISTS (SELECT 1 FROM dedup WHERE COALESCE(rate,0) > 0),
    'month',  to_char(v_start,'YYYY-MM'),
    'earned', COALESCE((SELECT sum(rate) FROM dedup WHERE status IN ('completed','done')), 0),
    'due',    COALESCE((SELECT sum(rate) FROM dedup WHERE status NOT IN ('completed','done')), 0),
    'by_member', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('member', COALESCE(completed_by_member,'—'), 'completed', c, 'earned', e) ORDER BY e DESC)
      FROM (SELECT completed_by_member, count(*) c, sum(rate) e FROM dedup WHERE status IN ('completed','done') GROUP BY completed_by_member) m
    ), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.my_earnings(date) FROM public;
GRANT EXECUTE ON FUNCTION public.my_earnings(date) TO authenticated;
