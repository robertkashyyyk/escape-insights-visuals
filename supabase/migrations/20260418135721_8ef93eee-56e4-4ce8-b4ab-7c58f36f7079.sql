-- Add TouchStay-imported sections to property_knowledge
ALTER TABLE public.property_knowledge
  ADD COLUMN IF NOT EXISTS local_area text,
  ADD COLUMN IF NOT EXISTS guest_info text,
  ADD COLUMN IF NOT EXISTS bins_recycling text,
  ADD COLUMN IF NOT EXISTS parking_info text,
  ADD COLUMN IF NOT EXISTS emergency_contacts text,
  ADD COLUMN IF NOT EXISTS checkout_instructions text,
  ADD COLUMN IF NOT EXISTS appliances_info text,
  ADD COLUMN IF NOT EXISTS wifi_info text;

-- Update completion score trigger to include new fields
CREATE OR REPLACE FUNCTION public.calc_property_knowledge_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  score integer := 0;
  access_filled int := 0; access_total int := 5;
  util_filled int := 0;   util_total int := 5;
  clean_filled int := 0;  clean_total int := 5;
  wifi_filled int := 0;   wifi_total int := 3;
  heat_filled int := 0;   heat_total int := 3;
  over_filled int := 0;   over_total int := 3;
  ht_filled int := 0;     ht_total int := 4;
  guest_filled int := 0;  guest_total int := 5;
BEGIN
  -- Access (22%)
  IF NEW.key_safe_location IS NOT NULL AND NEW.key_safe_location <> '' THEN access_filled := access_filled + 1; END IF;
  IF NEW.key_safe_code IS NOT NULL AND NEW.key_safe_code <> '' THEN access_filled := access_filled + 1; END IF;
  IF NEW.lock_type IS NOT NULL AND NEW.lock_type <> '' THEN access_filled := access_filled + 1; END IF;
  IF NEW.spare_key_location IS NOT NULL AND NEW.spare_key_location <> '' THEN access_filled := access_filled + 1; END IF;
  IF NEW.access_notes IS NOT NULL AND NEW.access_notes <> '' THEN access_filled := access_filled + 1; END IF;

  -- Utilities (18%)
  IF NEW.boiler_make_model IS NOT NULL AND NEW.boiler_make_model <> '' THEN util_filled := util_filled + 1; END IF;
  IF NEW.boiler_location IS NOT NULL AND NEW.boiler_location <> '' THEN util_filled := util_filled + 1; END IF;
  IF NEW.boiler_reset_procedure IS NOT NULL AND NEW.boiler_reset_procedure <> '' THEN util_filled := util_filled + 1; END IF;
  IF NEW.stopcock_location IS NOT NULL AND NEW.stopcock_location <> '' THEN util_filled := util_filled + 1; END IF;
  IF NEW.fusebox_location IS NOT NULL AND NEW.fusebox_location <> '' THEN util_filled := util_filled + 1; END IF;

  -- Cleaning (15%)
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

  -- Guest-facing (15%): local_area, guest_info, checkout_instructions, parking_info, emergency_contacts
  IF NEW.local_area IS NOT NULL AND NEW.local_area <> '' THEN guest_filled := guest_filled + 1; END IF;
  IF NEW.guest_info IS NOT NULL AND NEW.guest_info <> '' THEN guest_filled := guest_filled + 1; END IF;
  IF NEW.checkout_instructions IS NOT NULL AND NEW.checkout_instructions <> '' THEN guest_filled := guest_filled + 1; END IF;
  IF NEW.parking_info IS NOT NULL AND NEW.parking_info <> '' THEN guest_filled := guest_filled + 1; END IF;
  IF NEW.emergency_contacts IS NOT NULL AND NEW.emergency_contacts <> '' THEN guest_filled := guest_filled + 1; END IF;

  score := round(
    (access_filled::numeric / access_total) * 22 +
    (util_filled::numeric   / util_total)   * 18 +
    (clean_filled::numeric  / clean_total)  * 15 +
    (wifi_filled::numeric   / wifi_total)   * 10 +
    (heat_filled::numeric   / heat_total)   * 10 +
    (over_filled::numeric   / over_total)   * 10 +
    (guest_filled::numeric  / guest_total)  * 15
  );

  -- Hot tub bonus
  IF NEW.has_hot_tub THEN
    IF NEW.hot_tub_make_model IS NOT NULL AND NEW.hot_tub_make_model <> '' THEN ht_filled := ht_filled + 1; END IF;
    IF NEW.hot_tub_chemical_schedule IS NOT NULL AND NEW.hot_tub_chemical_schedule <> '' THEN ht_filled := ht_filled + 1; END IF;
    IF NEW.hot_tub_target_temp IS NOT NULL THEN ht_filled := ht_filled + 1; END IF;
    IF NEW.hot_tub_supplier_contact IS NOT NULL AND NEW.hot_tub_supplier_contact <> '' THEN ht_filled := ht_filled + 1; END IF;
    score := round(score * 0.95 + (ht_filled::numeric / ht_total) * 5);
  END IF;

  NEW.completion_score := LEAST(100, GREATEST(0, score));
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;