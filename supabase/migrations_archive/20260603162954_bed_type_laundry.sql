-- Laundry by BED TYPE (refinement to spec item 3).
--
-- Laundry cost is driven by each property's bed inventory: every bedroom has beds,
-- each bed has a type (King, Double, Single…), and each bed type has its own laundry
-- cost per turnover. A property's laundry charge per turnover = sum(bed_type.cost * qty).
-- This supersedes the flat per-region laundry rate for charge generation.

CREATE TABLE IF NOT EXISTS public.bed_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  laundry_cost numeric(10,2) NOT NULL DEFAULT 0,   -- £ per turnover for one bed of this type
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.property_beds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  bedroom_label text NOT NULL,                     -- e.g. "Bedroom 1"
  bed_type_id uuid NOT NULL REFERENCES public.bed_types(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bed_types, public.property_beds TO authenticated;
GRANT ALL ON public.bed_types, public.property_beds TO service_role;

CREATE INDEX IF NOT EXISTS idx_property_beds_listing ON public.property_beds(listing_id);

DROP TRIGGER IF EXISTS trg_bed_types_updated_at ON public.bed_types;
CREATE TRIGGER trg_bed_types_updated_at BEFORE UPDATE ON public.bed_types
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.bed_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_beds ENABLE ROW LEVEL SECURITY;

-- Bed-type catalogue: any signed-in user can read; super/senior manage.
DROP POLICY IF EXISTS "Authenticated read bed_types" ON public.bed_types;
CREATE POLICY "Authenticated read bed_types" ON public.bed_types
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Super/Senior manage bed_types" ON public.bed_types;
CREATE POLICY "Super/Senior manage bed_types" ON public.bed_types
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role))
  WITH CHECK (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role));

DROP POLICY IF EXISTS "Staff manage property_beds" ON public.property_beds;
CREATE POLICY "Staff manage property_beds" ON public.property_beds
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role));

-- Seed common bed types (laundry_cost starts at 0 — set per type in the UI).
INSERT INTO public.bed_types (name, display_order)
SELECT v.name, v.ord FROM (VALUES
  ('Super King',0),('King',1),('Double',2),('Single',3),('Twin',4),
  ('Bunk',5),('Sofa Bed',6),('Zip & Link',7),('Cot',8)
) AS v(name, ord)
WHERE NOT EXISTS (SELECT 1 FROM public.bed_types b WHERE b.name = v.name);

-- Switch laundry generation to bed-type costs.
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
  v_amt    numeric;
  r RECORD;
  m RECORD;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    BEGIN
      SELECT location_group, communal_group_id INTO v_region, v_group
      FROM public.listings WHERE id = NEW.listing_id;
      v_date := COALESCE(NEW.scheduled_date, CURRENT_DATE);

      -- Laundry = sum of the property's bed inventory priced by bed type.
      SELECT COALESCE(SUM(bt.laundry_cost * pb.quantity), 0) INTO v_amt
      FROM public.property_beds pb
      JOIN public.bed_types bt ON bt.id = pb.bed_type_id
      WHERE pb.listing_id = NEW.listing_id AND bt.active;

      IF v_amt > 0 THEN
        INSERT INTO public.laundry_charges (listing_id, clean_task_id, rate_id, region, amount, charge_date)
        VALUES (NEW.listing_id, NEW.id, NULL, v_region, v_amt, v_date)
        ON CONFLICT (clean_task_id) DO NOTHING;
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
      RAISE WARNING 'generate_turnover_charges failed for clean_task %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;
