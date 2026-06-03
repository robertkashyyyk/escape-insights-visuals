-- Meeting spec items 3 + 4: Laundry per-region set rate + Consumables per-turnover (+communal)
--
-- A SET-RATE accrual model, distinct from the existing actual-cost expense tables
-- (expense_laundry_bills / expense_consumables remain for supplier reconciliation).
-- A flat charge accrues per turnover (a clean_task completing) for each property whose
-- region/group a rate covers. Communal consumables split across the group by ratio.

-- ========================= LAUNDRY =========================
CREATE TABLE IF NOT EXISTS public.laundry_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Laundry',
  amount numeric(10,2) NOT NULL,                 -- £ per turnover
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.laundry_rate_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_id uuid NOT NULL REFERENCES public.laundry_rates(id) ON DELETE CASCADE,
  region text NOT NULL,                          -- matches listings.location_group
  UNIQUE (rate_id, region)
);

-- Generated: one laundry charge per turnover (clean_task) for covered properties.
CREATE TABLE IF NOT EXISTS public.laundry_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  clean_task_id uuid NOT NULL REFERENCES public.clean_tasks(id) ON DELETE CASCADE,
  rate_id uuid REFERENCES public.laundry_rates(id) ON DELETE SET NULL,
  region text,
  amount numeric(10,2) NOT NULL,
  charge_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clean_task_id)                          -- one laundry charge per turnover
);

-- ========================= CONSUMABLES =========================
CREATE TABLE IF NOT EXISTS public.consumable_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  amount numeric(10,2) NOT NULL,                 -- £ per turnover
  type text NOT NULL CHECK (type IN ('direct_to_property','region','communal')),
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,        -- direct_to_property
  region text,                                                              -- region
  communal_group_id uuid REFERENCES public.communal_groups(id) ON DELETE CASCADE, -- communal
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consumable_rates_target_ck CHECK (
    (type = 'direct_to_property' AND listing_id IS NOT NULL) OR
    (type = 'region'             AND region IS NOT NULL) OR
    (type = 'communal'           AND communal_group_id IS NOT NULL)
  )
);

-- Generated: per-turnover consumable charges. Communal rates produce one row per
-- group member (amount * ratio%); direct/region produce a single row.
CREATE TABLE IF NOT EXISTS public.consumable_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  clean_task_id uuid NOT NULL REFERENCES public.clean_tasks(id) ON DELETE CASCADE,
  rate_id uuid REFERENCES public.consumable_rates(id) ON DELETE SET NULL,
  type text,
  amount numeric(10,2) NOT NULL,
  charge_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clean_task_id, rate_id, listing_id)
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.laundry_rates, public.laundry_rate_regions,
  public.laundry_charges, public.consumable_rates, public.consumable_charges TO authenticated;
GRANT ALL ON public.laundry_rates, public.laundry_rate_regions, public.laundry_charges,
  public.consumable_rates, public.consumable_charges TO service_role;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_laundry_rate_regions_region ON public.laundry_rate_regions(region);
CREATE INDEX IF NOT EXISTS idx_laundry_charges_listing ON public.laundry_charges(listing_id);
CREATE INDEX IF NOT EXISTS idx_laundry_charges_date ON public.laundry_charges(charge_date);
CREATE INDEX IF NOT EXISTS idx_consumable_charges_listing ON public.consumable_charges(listing_id);
CREATE INDEX IF NOT EXISTS idx_consumable_charges_date ON public.consumable_charges(charge_date);

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_laundry_rates_updated_at ON public.laundry_rates;
CREATE TRIGGER trg_laundry_rates_updated_at BEFORE UPDATE ON public.laundry_rates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
DROP TRIGGER IF EXISTS trg_consumable_rates_updated_at ON public.consumable_rates;
CREATE TRIGGER trg_consumable_rates_updated_at BEFORE UPDATE ON public.consumable_rates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ========================= RLS =========================
ALTER TABLE public.laundry_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laundry_rate_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laundry_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumable_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumable_charges ENABLE ROW LEVEL SECURITY;

-- Staff (super/senior/admin) manage everything; owners can read charges for their listings.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['laundry_rates','laundry_rate_regions','laundry_charges','consumable_rates','consumable_charges'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Staff manage %1$s" ON public.%1$s', t);
    EXECUTE format($f$CREATE POLICY "Staff manage %1$s" ON public.%1$s FOR ALL TO authenticated
      USING (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role))
      WITH CHECK (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role))$f$, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Owners read laundry_charges" ON public.laundry_charges;
CREATE POLICY "Owners read laundry_charges" ON public.laundry_charges
  FOR SELECT TO authenticated USING (owner_owns_listing(auth.uid(), listing_id));
DROP POLICY IF EXISTS "Owners read consumable_charges" ON public.consumable_charges;
CREATE POLICY "Owners read consumable_charges" ON public.consumable_charges
  FOR SELECT TO authenticated USING (owner_owns_listing(auth.uid(), listing_id));

-- ========================= GENERATION TRIGGER =========================
-- Fires when a clean_task transitions to 'completed'. Generates laundry + consumable
-- charges for that turnover. Wrapped so a generation failure can NEVER block the core
-- clean completion (cleaners must always be able to finish a job).
CREATE OR REPLACE FUNCTION public.generate_turnover_charges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_region text;
  v_group  uuid;
  v_date   date;
  r RECORD;
  m RECORD;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    BEGIN
      SELECT location_group, communal_group_id INTO v_region, v_group
      FROM public.listings WHERE id = NEW.listing_id;
      v_date := COALESCE(NEW.scheduled_date, CURRENT_DATE);

      -- Laundry: first active rate covering the property's region (one rate per region by policy).
      IF v_region IS NOT NULL THEN
        SELECT lr.id, lr.amount INTO r
        FROM public.laundry_rates lr
        JOIN public.laundry_rate_regions lrr ON lrr.rate_id = lr.id
        WHERE lr.active AND lrr.region = v_region
        LIMIT 1;
        IF FOUND THEN
          INSERT INTO public.laundry_charges (listing_id, clean_task_id, rate_id, region, amount, charge_date)
          VALUES (NEW.listing_id, NEW.id, r.id, v_region, r.amount, v_date)
          ON CONFLICT (clean_task_id) DO NOTHING;
        END IF;
      END IF;

      -- Consumables: every active rate that targets this property.
      FOR r IN SELECT * FROM public.consumable_rates WHERE active LOOP
        IF r.type = 'direct_to_property' AND r.listing_id = NEW.listing_id THEN
          INSERT INTO public.consumable_charges (listing_id, clean_task_id, rate_id, type, amount, charge_date)
          VALUES (NEW.listing_id, NEW.id, r.id, r.type, r.amount, v_date)
          ON CONFLICT (clean_task_id, rate_id, listing_id) DO NOTHING;
        ELSIF r.type = 'region' AND r.region IS NOT DISTINCT FROM v_region THEN
          INSERT INTO public.consumable_charges (listing_id, clean_task_id, rate_id, type, amount, charge_date)
          VALUES (NEW.listing_id, NEW.id, r.id, r.type, r.amount, v_date)
          ON CONFLICT (clean_task_id, rate_id, listing_id) DO NOTHING;
        ELSIF r.type = 'communal' AND v_group IS NOT NULL AND r.communal_group_id = v_group THEN
          FOR m IN
            SELECT id, COALESCE(communal_ratio_pct,0) AS pct
            FROM public.listings WHERE communal_group_id = v_group AND is_communal
          LOOP
            INSERT INTO public.consumable_charges (listing_id, clean_task_id, rate_id, type, amount, charge_date)
            VALUES (m.id, NEW.id, r.id, r.type, ROUND(r.amount * m.pct / 100.0, 2), v_date)
            ON CONFLICT (clean_task_id, rate_id, listing_id) DO NOTHING;
          END LOOP;
        END IF;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      -- Never block clean completion on a billing-accrual error.
      RAISE WARNING 'generate_turnover_charges failed for clean_task %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_turnover_charges ON public.clean_tasks;
CREATE TRIGGER trg_generate_turnover_charges
  AFTER UPDATE OF status ON public.clean_tasks
  FOR EACH ROW EXECUTE FUNCTION public.generate_turnover_charges();
