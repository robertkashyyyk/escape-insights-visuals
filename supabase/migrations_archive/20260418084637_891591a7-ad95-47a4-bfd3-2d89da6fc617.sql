-- =============================================
-- PROPERTY KNOWLEDGE SYSTEM
-- =============================================

-- Main knowledge record per property
CREATE TABLE public.property_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL UNIQUE REFERENCES public.listings(id) ON DELETE CASCADE,

  -- Section 1: Overview
  property_type text,
  key_features text,
  general_notes text,

  -- Section 2: Access (sensitive codes!)
  key_safe_location text,
  key_safe_code text,
  lock_type text,
  spare_key_location text,
  gate_code text,
  alarm_code text,
  access_notes text,

  -- Section 3: Utilities
  boiler_make_model text,
  boiler_location text,
  boiler_reset_procedure text,
  stopcock_location text,
  fusebox_location text,
  electric_meter_location text,
  gas_meter_location text,
  water_pressure_notes text,
  utility_notes text,

  -- Section 4: Heating
  heating_system_type text,
  thermostat_location text,
  hot_water_cylinder_location text,
  immersion_heater_details text,
  oil_tank_location text,
  oil_supplier_contact text,
  heating_notes text,

  -- Section 5: Hot Tub
  has_hot_tub boolean NOT NULL DEFAULT false,
  hot_tub_make_model text,
  hot_tub_chemical_schedule text,
  hot_tub_target_temp numeric,
  hot_tub_filter_frequency text,
  hot_tub_error_codes jsonb DEFAULT '[]'::jsonb,
  hot_tub_supplier_contact text,
  hot_tub_last_service date,
  hot_tub_notes text,

  -- Section 7: WiFi (password is sensitive!)
  wifi_ssid text,
  wifi_password text,
  router_location text,
  router_reset_procedure text,
  backup_network text,
  wifi_notes text,

  -- Section 8: Cleaning
  cleaning_quirks text,
  cleaning_supplies_location text,
  cleaning_duration_hours numeric,
  linen_storage_location text,
  bin_location text,
  bin_collection_day text,
  recycling_notes text,
  cleaning_notes text,

  -- Metadata
  completion_score integer NOT NULL DEFAULT 0,
  last_updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_property_knowledge_listing ON public.property_knowledge(listing_id);

-- Appliances
CREATE TABLE public.property_appliances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text,
  model_number text,
  instructions text,
  common_issues text,
  manual_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_property_appliances_listing ON public.property_appliances(listing_id);

-- Maintenance log
CREATE TABLE public.property_maintenance_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  issue_description text NOT NULL,
  action_taken text,
  resolved_by text,
  cost numeric,
  status text NOT NULL DEFAULT 'resolved' CHECK (status IN ('resolved','ongoing','monitoring')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX idx_property_maintenance_listing_date ON public.property_maintenance_log(listing_id, date DESC);

-- Known issues / watchlist
CREATE TABLE public.property_known_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'monitoring' CHECK (status IN ('monitoring','scheduled','waiting','resolved')),
  priority text NOT NULL DEFAULT 'low' CHECK (priority IN ('low','medium','high','urgent')),
  assigned_to uuid,
  next_action text,
  next_action_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_property_known_issues_listing ON public.property_known_issues(listing_id);

-- Contacts
CREATE TABLE public.property_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  phone text,
  email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_property_contacts_listing ON public.property_contacts(listing_id);

-- Documents
CREATE TABLE public.property_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'link' CHECK (type IN ('document','link')),
  url text,
  expiry_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_property_documents_listing ON public.property_documents(listing_id);

-- =============================================
-- COMPLETION SCORE TRIGGER
-- Weights: Access 25, Utilities 20, Cleaning 20, WiFi 10, Heating 10, Overview 10, HotTub 5 (when applicable)
-- =============================================
CREATE OR REPLACE FUNCTION public.calc_property_knowledge_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  score integer := 0;
  access_filled int := 0; access_total int := 5;
  util_filled int := 0;   util_total int := 5;
  clean_filled int := 0;  clean_total int := 5;
  wifi_filled int := 0;   wifi_total int := 3;
  heat_filled int := 0;   heat_total int := 3;
  over_filled int := 0;   over_total int := 3;
  ht_filled int := 0;     ht_total int := 4;
BEGIN
  -- Access (25%)
  IF NEW.key_safe_location IS NOT NULL AND NEW.key_safe_location <> '' THEN access_filled := access_filled + 1; END IF;
  IF NEW.key_safe_code IS NOT NULL AND NEW.key_safe_code <> '' THEN access_filled := access_filled + 1; END IF;
  IF NEW.lock_type IS NOT NULL AND NEW.lock_type <> '' THEN access_filled := access_filled + 1; END IF;
  IF NEW.spare_key_location IS NOT NULL AND NEW.spare_key_location <> '' THEN access_filled := access_filled + 1; END IF;
  IF NEW.access_notes IS NOT NULL AND NEW.access_notes <> '' THEN access_filled := access_filled + 1; END IF;

  -- Utilities (20%)
  IF NEW.boiler_make_model IS NOT NULL AND NEW.boiler_make_model <> '' THEN util_filled := util_filled + 1; END IF;
  IF NEW.boiler_location IS NOT NULL AND NEW.boiler_location <> '' THEN util_filled := util_filled + 1; END IF;
  IF NEW.boiler_reset_procedure IS NOT NULL AND NEW.boiler_reset_procedure <> '' THEN util_filled := util_filled + 1; END IF;
  IF NEW.stopcock_location IS NOT NULL AND NEW.stopcock_location <> '' THEN util_filled := util_filled + 1; END IF;
  IF NEW.fusebox_location IS NOT NULL AND NEW.fusebox_location <> '' THEN util_filled := util_filled + 1; END IF;

  -- Cleaning (20%)
  IF NEW.cleaning_quirks IS NOT NULL AND NEW.cleaning_quirks <> '' THEN clean_filled := clean_filled + 1; END IF;
  IF NEW.cleaning_supplies_location IS NOT NULL AND NEW.cleaning_supplies_location <> '' THEN clean_filled := clean_filled + 1; END IF;
  IF NEW.linen_storage_location IS NOT NULL AND NEW.linen_storage_location <> '' THEN clean_filled := clean_filled + 1; END IF;
  IF NEW.bin_collection_day IS NOT NULL AND NEW.bin_collection_day <> '' THEN clean_filled := clean_filled + 1; END IF;
  IF NEW.cleaning_duration_hours IS NOT NULL THEN clean_filled := clean_filled + 1; END IF;

  -- WiFi (10%)
  IF NEW.wifi_ssid IS NOT NULL AND NEW.wifi_ssid <> '' THEN wifi_filled := wifi_filled + 1; END IF;
  IF NEW.wifi_password IS NOT NULL AND NEW.wifi_password <> '' THEN wifi_filled := wifi_filled + 1; END IF;
  IF NEW.router_location IS NOT NULL AND NEW.router_location <> '' THEN wifi_filled := wifi_filled + 1; END IF;

  -- Heating (10%)
  IF NEW.heating_system_type IS NOT NULL AND NEW.heating_system_type <> '' THEN heat_filled := heat_filled + 1; END IF;
  IF NEW.thermostat_location IS NOT NULL AND NEW.thermostat_location <> '' THEN heat_filled := heat_filled + 1; END IF;
  IF NEW.heating_notes IS NOT NULL AND NEW.heating_notes <> '' THEN heat_filled := heat_filled + 1; END IF;

  -- Overview (10%)
  IF NEW.property_type IS NOT NULL AND NEW.property_type <> '' THEN over_filled := over_filled + 1; END IF;
  IF NEW.key_features IS NOT NULL AND NEW.key_features <> '' THEN over_filled := over_filled + 1; END IF;
  IF NEW.general_notes IS NOT NULL AND NEW.general_notes <> '' THEN over_filled := over_filled + 1; END IF;

  score := round(
    (access_filled::numeric / access_total) * 25 +
    (util_filled::numeric   / util_total)   * 20 +
    (clean_filled::numeric  / clean_total)  * 20 +
    (wifi_filled::numeric   / wifi_total)   * 10 +
    (heat_filled::numeric   / heat_total)   * 10 +
    (over_filled::numeric   / over_total)   * 10
  );

  -- Hot tub bonus (only if applicable)
  IF NEW.has_hot_tub THEN
    IF NEW.hot_tub_make_model IS NOT NULL AND NEW.hot_tub_make_model <> '' THEN ht_filled := ht_filled + 1; END IF;
    IF NEW.hot_tub_chemical_schedule IS NOT NULL AND NEW.hot_tub_chemical_schedule <> '' THEN ht_filled := ht_filled + 1; END IF;
    IF NEW.hot_tub_target_temp IS NOT NULL THEN ht_filled := ht_filled + 1; END IF;
    IF NEW.hot_tub_supplier_contact IS NOT NULL AND NEW.hot_tub_supplier_contact <> '' THEN ht_filled := ht_filled + 1; END IF;
    -- Replace 5 of base score with hot tub weighting
    score := round(score * 0.95 + (ht_filled::numeric / ht_total) * 5);
  END IF;

  NEW.completion_score := LEAST(100, GREATEST(0, score));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_property_knowledge_completion
BEFORE INSERT OR UPDATE ON public.property_knowledge
FOR EACH ROW EXECUTE FUNCTION public.calc_property_knowledge_completion();

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_appliances_updated_at BEFORE UPDATE ON public.property_appliances
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_known_issues_updated_at BEFORE UPDATE ON public.property_known_issues
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =============================================
-- HELPER: cleaner is assigned to a listing
-- =============================================
CREATE OR REPLACE FUNCTION public.cleaner_assigned_to_listing(_user_id uuid, _listing_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clean_tasks ct
    JOIN public.cleaners c ON c.id = ct.assigned_cleaner_id
    WHERE ct.listing_id = _listing_id AND c.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.owner_owns_listing(_user_id uuid, _listing_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.listings l
    JOIN public.property_owners po ON po.id = l.owner_id
    WHERE l.id = _listing_id AND po.user_id = _user_id
  );
$$;

-- =============================================
-- RLS: property_knowledge
-- Base table: only super/senior/admin can read directly (sensitive codes!)
-- Cleaners + owners use the safe view below.
-- =============================================
ALTER TABLE public.property_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read property_knowledge" ON public.property_knowledge
FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'super'::app_role) OR
  has_role(auth.uid(),'senior'::app_role) OR
  has_role(auth.uid(),'admin'::app_role)
);

CREATE POLICY "Super/Senior can insert property_knowledge" ON public.property_knowledge
FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role)
);

CREATE POLICY "Super/Senior/Admin can update property_knowledge" ON public.property_knowledge
FOR UPDATE TO authenticated USING (
  has_role(auth.uid(),'super'::app_role) OR
  has_role(auth.uid(),'senior'::app_role) OR
  has_role(auth.uid(),'admin'::app_role)
);

CREATE POLICY "Super can delete property_knowledge" ON public.property_knowledge
FOR DELETE TO authenticated USING (has_role(auth.uid(),'super'::app_role));

-- Cleaner-safe view: excludes ALL sensitive codes & full access notes
CREATE OR REPLACE VIEW public.property_knowledge_cleaner
WITH (security_invoker = on) AS
SELECT
  id, listing_id,
  property_type, key_features,
  key_safe_location, lock_type, spare_key_location, access_notes,
  boiler_location, stopcock_location, fusebox_location,
  cleaning_quirks, cleaning_supplies_location, cleaning_duration_hours,
  linen_storage_location, bin_location, bin_collection_day, recycling_notes, cleaning_notes,
  wifi_ssid, router_location,
  has_hot_tub, hot_tub_chemical_schedule, hot_tub_target_temp, hot_tub_filter_frequency,
  completion_score, updated_at
FROM public.property_knowledge;

-- Owner-safe view: non-sensitive read for property they own
CREATE OR REPLACE VIEW public.property_knowledge_owner
WITH (security_invoker = on) AS
SELECT
  id, listing_id,
  property_type, key_features, general_notes,
  wifi_ssid, router_location, wifi_notes,
  has_hot_tub, hot_tub_make_model,
  completion_score, updated_at
FROM public.property_knowledge;

-- =============================================
-- RLS: appliances
-- =============================================
ALTER TABLE public.property_appliances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage appliances" ON public.property_appliances
FOR ALL TO authenticated
USING (
  has_role(auth.uid(),'super'::app_role) OR
  has_role(auth.uid(),'senior'::app_role) OR
  has_role(auth.uid(),'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(),'super'::app_role) OR
  has_role(auth.uid(),'senior'::app_role) OR
  has_role(auth.uid(),'admin'::app_role)
);

CREATE POLICY "Cleaners read appliances for assigned listings" ON public.property_appliances
FOR SELECT TO authenticated USING (
  cleaner_assigned_to_listing(auth.uid(), listing_id)
);

CREATE POLICY "Owners read appliances for own listings" ON public.property_appliances
FOR SELECT TO authenticated USING (
  owner_owns_listing(auth.uid(), listing_id)
);

-- =============================================
-- RLS: maintenance log (staff only — operational/cost data)
-- =============================================
ALTER TABLE public.property_maintenance_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage maintenance_log" ON public.property_maintenance_log
FOR ALL TO authenticated
USING (
  has_role(auth.uid(),'super'::app_role) OR
  has_role(auth.uid(),'senior'::app_role) OR
  has_role(auth.uid(),'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(),'super'::app_role) OR
  has_role(auth.uid(),'senior'::app_role) OR
  has_role(auth.uid(),'admin'::app_role)
);

-- =============================================
-- RLS: known issues
-- =============================================
ALTER TABLE public.property_known_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage known_issues" ON public.property_known_issues
FOR ALL TO authenticated
USING (
  has_role(auth.uid(),'super'::app_role) OR
  has_role(auth.uid(),'senior'::app_role) OR
  has_role(auth.uid(),'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(),'super'::app_role) OR
  has_role(auth.uid(),'senior'::app_role) OR
  has_role(auth.uid(),'admin'::app_role)
);

-- =============================================
-- RLS: contacts (staff only — phone numbers)
-- =============================================
ALTER TABLE public.property_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage contacts" ON public.property_contacts
FOR ALL TO authenticated
USING (
  has_role(auth.uid(),'super'::app_role) OR
  has_role(auth.uid(),'senior'::app_role) OR
  has_role(auth.uid(),'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(),'super'::app_role) OR
  has_role(auth.uid(),'senior'::app_role) OR
  has_role(auth.uid(),'admin'::app_role)
);

-- =============================================
-- RLS: documents
-- =============================================
ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage documents" ON public.property_documents
FOR ALL TO authenticated
USING (
  has_role(auth.uid(),'super'::app_role) OR
  has_role(auth.uid(),'senior'::app_role) OR
  has_role(auth.uid(),'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(),'super'::app_role) OR
  has_role(auth.uid(),'senior'::app_role) OR
  has_role(auth.uid(),'admin'::app_role)
);

CREATE POLICY "Owners read documents for own listings" ON public.property_documents
FOR SELECT TO authenticated USING (
  owner_owns_listing(auth.uid(), listing_id)
);

-- =============================================
-- SEED: empty knowledge record for every existing listing
-- =============================================
INSERT INTO public.property_knowledge (listing_id)
SELECT id FROM public.listings
ON CONFLICT (listing_id) DO NOTHING;