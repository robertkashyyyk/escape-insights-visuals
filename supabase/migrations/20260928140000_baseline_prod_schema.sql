-- Baseline: current production public schema + app storage policies.
-- Generated from prod_public_schema.sql (schema-only). Branch-safe:
-- no OWNER TO, no CREATE SCHEMA, no Supabase-managed storage objects.
-- This file is recorded as already-applied on prod (never executed there).

SET check_function_bodies = false;

CREATE TYPE "public"."adjustment_target" AS ENUM (
    'revenue',
    'cost_line',
    'settlement'
);

CREATE TYPE "public"."amenity_category" AS ENUM (
    'grocery',
    'supermarket',
    'petrol_station',
    'ev_charging',
    'restaurant',
    'bar_pub',
    'fast_food',
    'cafe',
    'golf_course',
    'walkway_trail',
    'park',
    'castle_historic',
    'beach',
    'activity_centre',
    'pharmacy',
    'hospital_medical',
    'atm_bank',
    'tourist_attraction',
    'accommodation',
    'other'
);

CREATE TYPE "public"."app_role" AS ENUM (
    'super',
    'senior',
    'admin',
    'client',
    'cleaner',
    'maintenance'
);

CREATE TYPE "public"."management_fee_method" AS ENUM (
    'percent_per_property',
    'flat_per_property',
    'flat_per_portfolio'
);

CREATE TYPE "public"."ota_attribution_outcome" AS ENUM (
    'management_report',
    'company_retention'
);

CREATE TYPE "public"."ota_batch_status" AS ENUM (
    'parsed',
    'reconciled',
    'partial'
);

CREATE TYPE "public"."ota_collection_model" AS ENUM (
    'channel',
    'host'
);

CREATE TYPE "public"."ota_match_method" AS ENUM (
    'code',
    'composite',
    'manual',
    'none'
);

CREATE TYPE "public"."ota_platform" AS ENUM (
    'airbnb',
    'bookingcom',
    'stripe',
    'vrbo'
);

CREATE TYPE "public"."ota_recon_status" AS ENUM (
    'auto_matched',
    'needs_recon',
    'matched',
    'unmatched',
    'excluded'
);

CREATE TYPE "public"."ota_txn_type" AS ENUM (
    'reservation',
    'payout',
    'resolution',
    'adjustment'
);

CREATE TYPE "public"."report_booking_channel" AS ENUM (
    'bookingcom',
    'airbnb',
    'direct'
);

CREATE TYPE "public"."report_source_category" AS ENUM (
    'integration',
    'platform_engine',
    'derived',
    'manual'
);

CREATE TYPE "public"."report_status" AS ENUM (
    'draft',
    'finalised'
);

CREATE TYPE "public"."revenue_recognition" AS ENUM (
    'prorate_by_nights',
    'whole_in_attributed_month'
);

CREATE TYPE "public"."settlement_method" AS ENUM (
    'pay_on_generation',
    'weekly_draw'
);

CREATE OR REPLACE FUNCTION "public"."acknowledge_brief"("p_brief_id" "uuid", "p_clean_task_id" "uuid", "p_member" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clean_tasks ct
      JOIN public.cleaners c ON c.id = ct.assigned_cleaner_id
      JOIN public.property_briefs b ON b.id = p_brief_id
    WHERE ct.id = p_clean_task_id AND c.user_id = auth.uid()
      AND ct.listing_id = b.listing_id
      AND ct.status NOT IN ('cancelled','canceled','completed','done')
  ) THEN
    RAISE EXCEPTION 'not authorised to acknowledge this brief';
  END IF;
  UPDATE public.property_briefs
     SET consumed_by_clean_task_id = p_clean_task_id, consumed_at = now(), consumed_by_member = p_member
   WHERE id = p_brief_id AND resolved_at IS NULL;
END $$;

CREATE OR REPLACE FUNCTION "public"."auto_create_clean_from_reservation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_co_time time;
  v_is_bundle boolean;
  v_is_archived boolean;
  v_status text;
  v_is_sto boolean;
  v_priority smallint;
  v_existing uuid;
  v_existing_listing uuid;
  v_existing_cleaner uuid;
  v_old_name text;
  v_new_group text;
  v_keep_cleaner boolean;
BEGIN
  IF lower(COALESCE(NEW.status, '')) <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  IF NEW.check_out IS NULL OR NEW.listing_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.check_out < (now() AT TIME ZONE 'Europe/London')::date THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(default_check_out_time, '10:00:00'::time),
         COALESCE(is_bundle, false),
         COALESCE(is_archived, false),
         status
    INTO v_co_time, v_is_bundle, v_is_archived, v_status
    FROM public.listings
   WHERE id = NEW.listing_id;

  IF COALESCE(v_is_bundle, false) THEN
    RETURN NEW;
  END IF;

  IF COALESCE(v_is_archived, false) OR lower(COALESCE(v_status, 'active')) = 'inactive' THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT id, listing_id, assigned_cleaner_id
      INTO v_existing, v_existing_listing, v_existing_cleaner
      FROM public.clean_tasks
     WHERE reservation_id = NEW.id
       AND status NOT IN ('cancelled','canceled')
     ORDER BY (status IN ('completed','done')) DESC, scheduled_date DESC
     LIMIT 1;

    IF v_existing IS NOT NULL THEN
      IF v_existing_listing IS DISTINCT FROM NEW.listing_id THEN
        SELECT internal_name INTO v_old_name FROM public.listings WHERE id = v_existing_listing;
        SELECT location_group INTO v_new_group FROM public.listings WHERE id = NEW.listing_id;
        v_keep_cleaner := v_existing_cleaner IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.cleaners c
           WHERE c.id = v_existing_cleaner AND v_new_group = ANY(c.location_groups)
        );
        UPDATE public.clean_tasks
           SET listing_id = NEW.listing_id,
               scheduled_date = NEW.check_out,
               checkout_time = v_co_time,
               assigned_cleaner_id = CASE WHEN v_keep_cleaner THEN assigned_cleaner_id ELSE NULL END,
               status = CASE WHEN v_keep_cleaner THEN status ELSE 'unassigned' END,
               warning_reason = 'Booking moved from ' || COALESCE(v_old_name, 'another property'),
               updated_at = now()
         WHERE id = v_existing
           AND override_assignment IS NOT TRUE
           AND status NOT IN ('completed','done');
        RETURN NEW;
      ELSE
        UPDATE public.clean_tasks
           SET scheduled_date = NEW.check_out,
               checkout_time  = v_co_time,
               updated_at     = now()
         WHERE id = v_existing
           AND override_assignment IS NOT TRUE
           AND status NOT IN ('completed','done');
        RETURN NEW;
      END IF;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.reservations r2
       WHERE r2.listing_id = NEW.listing_id
         AND r2.check_in   = NEW.check_out
         AND r2.id <> NEW.id
         AND (r2.status IS NULL OR lower(r2.status) NOT IN ('cancelled','canceled','declined','expired'))
    ) INTO v_is_sto;

    v_priority := CASE WHEN v_is_sto THEN 1 ELSE 2 END;

    IF EXISTS (
      SELECT 1 FROM public.clean_tasks
       WHERE listing_id = NEW.listing_id
         AND scheduled_date = NEW.check_out
         AND source <> 'manual'
         AND status NOT IN ('cancelled','canceled')
    ) THEN
      UPDATE public.clean_tasks
         SET reservation_id = NEW.id,
             is_same_day_turnaround = v_is_sto,
             priority_level = LEAST(priority_level, v_priority),
             updated_at = now()
       WHERE listing_id = NEW.listing_id
         AND scheduled_date = NEW.check_out
         AND source <> 'manual'
         AND status NOT IN ('cancelled','canceled')
         AND reservation_id IS NULL;
      RETURN NEW;
    END IF;

    INSERT INTO public.clean_tasks (
      listing_id, reservation_id, scheduled_date, status, source,
      is_same_day_turnaround, priority_level, checkout_time, task_type, priority
    ) VALUES (
      NEW.listing_id, NEW.id, NEW.check_out, 'unassigned', 'auto',
      v_is_sto, v_priority, v_co_time, 'checkout_clean',
      CASE WHEN v_is_sto THEN 'STO' ELSE 'STANDARD' END
    )
    ON CONFLICT (listing_id, scheduled_date)
      WHERE source <> 'manual' AND status <> ALL (ARRAY['cancelled'::text, 'canceled'::text])
      DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_create_clean_from_reservation failed for reservation %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."calc_property_knowledge_completion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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
$$;

CREATE OR REPLACE FUNCTION "public"."cancel_clean_on_reservation_cancel"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.status IS NOT NULL
     AND lower(NEW.status) IN ('cancelled','canceled','declined','expired')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.clean_tasks
       SET status = 'cancelled', updated_at = now()
     WHERE reservation_id = NEW.id
       AND COALESCE(status,'') NOT IN ('completed','done','cancelled');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."cleaner_assigned_to_listing"("_user_id" "uuid", "_listing_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clean_tasks ct
    JOIN public.cleaners c ON c.id = ct.assigned_cleaner_id
    WHERE ct.listing_id = _listing_id AND c.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION "public"."cleanup_phantom_instrumentation"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if (now() at time zone 'Europe/London')::date < date '2026-10-07' then return; end if;
  drop table if exists public.phantom_trace;
  begin perform cron.unschedule('verify-no-future-dated'); exception when others then null; end;
  begin perform cron.unschedule('cleanup-phantom-instrumentation'); exception when others then null; end;
end $$;

CREATE OR REPLACE FUNCTION "public"."communal_group_ratio_sum"("p_group_id" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(SUM(communal_ratio_pct), 0)
  FROM public.listings
  WHERE communal_group_id = p_group_id AND is_communal = true;
$$;

CREATE OR REPLACE FUNCTION "public"."complete_offline_cleans_eod"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count integer;
  v_listings uuid[];
BEGIN
  WITH done AS (
    UPDATE public.clean_tasks ct
       SET status = 'completed',
           completion_source = 'assumed_offline',
           completed_at = COALESCE(ct.completed_at, now()),
           updated_at = now()
      FROM public.cleaners c
     WHERE ct.assigned_cleaner_id = c.id
       AND c.is_offline = true
       AND ct.scheduled_date <= (now() AT TIME ZONE 'Europe/London')::date
       AND ct.scheduled_date >= (now() AT TIME ZONE 'Europe/London')::date - 7
       AND ct.status NOT IN ('completed','done','cancelled','canceled')
     RETURNING ct.listing_id
  )
  SELECT count(*), array_agg(DISTINCT listing_id) INTO v_count, v_listings FROM done;

  IF v_listings IS NOT NULL THEN
    UPDATE public.listings SET is_clean = true WHERE id = ANY(v_listings);
  END IF;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."edge_auth_header"() RETURNS "text"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select 'Bearer ' || decrypted_secret
  from vault.decrypted_secrets
  where name = 'edge_service_role_key'
  limit 1;
$$;

CREATE OR REPLACE FUNCTION "public"."generate_turnover_charges"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
      SELECT COALESCE(SUM(bt.laundry_cost * pb.quantity), 0) INTO v_amt
      FROM public.property_beds pb
      JOIN public.bed_types bt ON bt.id = pb.bed_type_id
      WHERE pb.listing_id = NEW.listing_id AND bt.active;
      IF v_amt > 0 THEN
        INSERT INTO public.laundry_charges (listing_id, clean_task_id, rate_id, region, amount, charge_date)
        VALUES (NEW.listing_id, NEW.id, NULL, v_region, v_amt, v_date)
        ON CONFLICT (clean_task_id) DO NOTHING;
      END IF;
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

CREATE OR REPLACE FUNCTION "public"."guard_clean_task_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_checkout date;
BEGIN
  IF NEW.source = 'manual' OR NEW.reservation_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT check_out INTO v_checkout FROM public.reservations WHERE id = NEW.reservation_id;

  IF v_checkout IS NOT NULL AND NEW.scheduled_date > v_checkout THEN
    INSERT INTO public.automation_logs (status, error_message, triggered_by)
    VALUES ('rejected_insert',
            format('Rejected non-manual clean insert: listing=%s reservation=%s scheduled_date=%s > check_out=%s',
                   NEW.listing_id, NEW.reservation_id, NEW.scheduled_date, v_checkout),
            'clean_insert_guard');
    RETURN NULL;  -- skip this row, no exceptions
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION "public"."manage_hostaway_cron"("interval_hours" integer, "supabase_url" "text" DEFAULT NULL::"text", "anon_key" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE _cron_expr text; _sql text;
BEGIN
  BEGIN PERFORM cron.unschedule('hostaway-auto-sync'); EXCEPTION WHEN OTHERS THEN NULL; END;
  IF interval_hours IS NULL OR interval_hours <= 0 THEN RETURN; END IF;
  CASE interval_hours
    WHEN 1  THEN _cron_expr := '0 * * * *';
    WHEN 3  THEN _cron_expr := '0 */3 * * *';
    WHEN 6  THEN _cron_expr := '0 */6 * * *';
    WHEN 12 THEN _cron_expr := '0 */12 * * *';
    WHEN 24 THEN _cron_expr := '0 4 * * *';
    ELSE _cron_expr := '0 */6 * * *';
  END CASE;
  _sql := format(
    'SELECT net.http_post(url:=%L, headers:=jsonb_build_object(''Content-Type'',''application/json'',''Authorization'', public.edge_auth_header()), body:=''{}''::jsonb) as request_id',
    supabase_url || '/functions/v1/hostaway-sync'
  );
  PERFORM cron.schedule('hostaway-auto-sync', _cron_expr, _sql);
END;
$$;

CREATE OR REPLACE FUNCTION "public"."my_earnings"("p_month" "date" DEFAULT (("now"() AT TIME ZONE 'Europe/London'::"text"))::"date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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

CREATE OR REPLACE FUNCTION "public"."notify_cleaner_on_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF (OLD.assigned_cleaner_id IS NULL AND NEW.assigned_cleaner_id IS NOT NULL) THEN
    PERFORM net.http_post(
      url := 'https://pftqjrmdksrrpczhomln.supabase.co/functions/v1/notify-cleaner-schedule-update',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', public.edge_auth_header()),
      body := jsonb_build_object('taskId', NEW.id::text)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."notify_new_booking"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_enabled boolean; v_secret text;
BEGIN
  SELECT booking_push_enabled, dispatch_secret INTO v_enabled, v_secret
    FROM public.notification_settings WHERE id = 1;
  IF v_enabled IS DISTINCT FROM true THEN RETURN NEW; END IF;
  IF NEW.notified_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.check_in IS NULL OR NEW.check_in < (now() AT TIME ZONE 'Europe/London')::date THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_at IS NULL OR now() - NEW.created_at > interval '10 minutes' THEN RETURN NEW; END IF;
  END IF;
  PERFORM net.http_post(
    url := 'https://pftqjrmdksrrpczhomln.supabase.co/functions/v1/send-booking-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', public.edge_auth_header(),
      'x-notify-secret', COALESCE(v_secret, '')
    ),
    body := jsonb_build_object('reservation_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."owner_owns_listing"("_user_id" "uuid", "_listing_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.listings l
    JOIN public.property_owners po ON po.id = l.owner_id
    WHERE l.id = _listing_id AND po.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION "public"."propagate_clean_duration"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.cleaning_duration_minutes is not null
     and new.cleaning_duration_minutes is distinct from old.cleaning_duration_minutes then
    update public.clean_tasks
       set cleaning_duration_minutes = new.cleaning_duration_minutes
     where listing_id = new.id
       and scheduled_date >= (now() at time zone 'Europe/London')::date
       and status not in ('completed','done','cancelled','canceled')
       and cleaning_duration_minutes is distinct from new.cleaning_duration_minutes;
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."tg_bill_rules_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end $$;

CREATE OR REPLACE FUNCTION "public"."tg_cleaner_delete_unassign"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.clean_tasks
     set assigned_cleaner_id = null, status = 'unassigned'
   where assigned_cleaner_id = old.id
     and status not in ('cancelled','canceled','completed','done');
  return old;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."tg_create_welcome_basket"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_mmdd int;
  v_threshold numeric;
  v_season text;
BEGIN
  IF NEW.check_in IS NULL OR NEW.total_amount IS NULL OR NEW.listing_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS NOT NULL AND lower(NEW.status) IN ('cancelled','canceled') THEN
    RETURN NEW;
  END IF;
  BEGIN
    v_mmdd := EXTRACT(MONTH FROM NEW.check_in)::int * 100 + EXTRACT(DAY FROM NEW.check_in)::int;
    SELECT name, spend_threshold INTO v_season, v_threshold
    FROM public.seasons
    WHERE CASE
      WHEN (start_month*100+start_day) <= (end_month*100+end_day)
        THEN v_mmdd BETWEEN (start_month*100+start_day) AND (end_month*100+end_day)
        ELSE v_mmdd >= (start_month*100+start_day) OR v_mmdd <= (end_month*100+end_day)
    END
    ORDER BY display_order
    LIMIT 1;
    IF FOUND AND NEW.total_amount > v_threshold THEN
      INSERT INTO public.maintenance_tasks (title, type, scope, status, listing_id, source, reservation_id)
      VALUES (
        'Welcome Basket — ' || COALESCE(NEW.guest_name, 'Guest') || ' (' || v_season || ')',
        'setup', 'property', 'pending', NEW.listing_id, 'welcome_basket', NEW.id
      )
      ON CONFLICT (reservation_id) WHERE source = 'welcome_basket' DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'welcome basket trigger failed for reservation %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."tg_notify_owner_booking"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_event text;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'confirmed') THEN
    v_event := 'new';
  ELSIF (TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled') THEN
    v_event := 'cancelled';
  ELSE
    RETURN NEW;
  END IF;
  BEGIN
    PERFORM net.http_post(
      url := 'https://pftqjrmdksrrpczhomln.supabase.co/functions/v1/send-owner-booking-email',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', public.edge_auth_header()),
      body := jsonb_build_object('reservation_id', NEW.id, 'event', v_event)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'owner booking notify failed for reservation %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."tg_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION "public"."trigger_today_task_allocation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_fire boolean := false;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.status = 'unassigned' AND NEW.scheduled_date = (now() AT TIME ZONE 'Europe/London')::date AND NEW.assigned_cleaner_id IS NULL THEN
      v_fire := true;
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.status = 'unassigned' AND NEW.assigned_cleaner_id IS NULL AND NEW.scheduled_date = (now() AT TIME ZONE 'Europe/London')::date AND (OLD.scheduled_date IS DISTINCT FROM NEW.scheduled_date) THEN
      v_fire := true;
    END IF;
  END IF;
  IF v_fire THEN
    PERFORM net.http_post(
      url := 'https://pftqjrmdksrrpczhomln.supabase.co/functions/v1/generate-daily-cleaning-schedule',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', public.edge_auth_header()),
      body := jsonb_build_object('date', NEW.scheduled_date::text, 'days_ahead', 1, 'source', 'reactive-today-allocation')
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."update_clean_issues_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION "public"."verify_no_future_dated_cleans"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_count integer;
begin
  -- Count future-dated non-manual cleans created AFTER all fixes were live
  -- (2026-09-27 14:40 UTC). Steady state must be 0; pre-fix rows are excluded.
  select count(*) into v_count
  from public.clean_tasks ct join public.reservations r on r.id = ct.reservation_id
  where ct.source <> 'manual' and ct.scheduled_date > r.check_out
    and ct.created_at >= timestamptz '2026-09-27 14:40:00+00';
  insert into public.automation_logs (status, error_message, triggered_by)
  values (case when v_count = 0 then 'verify_ok' else 'verify_FAIL' end,
          format('future_dated_nonmanual_since_fix=%s', v_count),
          'verify_future_dated');
end $$;

CREATE TABLE IF NOT EXISTS "public"."amenities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "category" "public"."amenity_category" DEFAULT 'other'::"public"."amenity_category" NOT NULL,
    "address" "text",
    "postcode" "text",
    "latitude" numeric,
    "longitude" numeric,
    "phone" "text",
    "website" "text",
    "google_place_id" "text",
    "opening_hours" "text",
    "notes" "text",
    "price_range" "text",
    "rating" numeric,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true NOT NULL,
    "added_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."automation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tasks_created" integer DEFAULT 0 NOT NULL,
    "tasks_unassigned" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'success'::"text" NOT NULL,
    "error_message" "text",
    "triggered_by" "text" DEFAULT 'scheduled'::"text"
);

CREATE TABLE IF NOT EXISTS "public"."bank_statement_imports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bank" "text" DEFAULT 'wise'::"text" NOT NULL,
    "file_name" "text",
    "period_start" "date",
    "period_end" "date",
    "row_count" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'review'::"text" NOT NULL,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bank_statement_imports_status_check" CHECK (("status" = ANY (ARRAY['review'::"text", 'done'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."bank_statement_txns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "import_id" "uuid",
    "external_id" "text",
    "txn_date" "date",
    "amount" numeric NOT NULL,
    "direction" "text",
    "details_type" "text",
    "payer_name" "text",
    "payee_name" "text",
    "reference" "text",
    "description" "text",
    "classification" "text" DEFAULT 'pending'::"text" NOT NULL,
    "matched_owner_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "bill_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bank_statement_txns_classification_check" CHECK (("classification" = ANY (ARRAY['pending'::"text", 'income'::"text", 'owner_settlement'::"text", 'internal'::"text", 'candidate'::"text", 'bill'::"text", 'ignored'::"text"]))),
    CONSTRAINT "bank_statement_txns_direction_check" CHECK (("direction" = ANY (ARRAY['credit'::"text", 'debit'::"text"]))),
    CONSTRAINT "bank_statement_txns_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'ignored'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."bed_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "laundry_cost" numeric(10,2) DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."bill_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bill_id" "uuid" NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "ratio_pct" numeric,
    "amount" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."bill_payee_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payee_key" "text" NOT NULL,
    "sample_payee" "text",
    "action" "text" NOT NULL,
    "cost_line_type_id" "uuid",
    "target_type" "text",
    "target_listing_id" "uuid",
    "target_communal_group_id" "uuid",
    "target_region" "text",
    "default_description" "text",
    "hit_count" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bill_payee_rules_action_check" CHECK (("action" = ANY (ARRAY['income'::"text", 'owner_settlement'::"text", 'internal'::"text", 'bill'::"text", 'ignore'::"text"]))),
    CONSTRAINT "bill_payee_rules_target_type_check" CHECK (("target_type" = ANY (ARRAY['property'::"text", 'communal'::"text", 'region'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."bills_on_behalf" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "txn_id" "uuid",
    "import_id" "uuid",
    "payee_name" "text",
    "bill_date" "date" NOT NULL,
    "amount" numeric NOT NULL,
    "cost_line_type_id" "uuid" NOT NULL,
    "description" "text",
    "target_type" "text" NOT NULL,
    "target_communal_group_id" "uuid",
    "target_region" "text",
    "receipt_url" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bills_on_behalf_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "bills_on_behalf_target_type_check" CHECK (("target_type" = ANY (ARRAY['property'::"text", 'communal'::"text", 'region'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."booking_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reservation_id" "uuid" NOT NULL,
    "request_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "booking_requests_quantity_check" CHECK (("quantity" > 0))
);

CREATE TABLE IF NOT EXISTS "public"."clean_checklist_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clean_task_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "room_type" "text",
    "room_index" integer,
    "label" "text" NOT NULL,
    "ref_id" "uuid",
    "checked" boolean DEFAULT false NOT NULL,
    "checked_at" timestamp with time zone,
    "checked_by" "uuid",
    "check_all" boolean DEFAULT false NOT NULL,
    "photo_url" "text",
    "flagged" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "requires_photo" boolean DEFAULT true NOT NULL,
    "checked_by_member" "text",
    "min_photos" smallint DEFAULT 1 NOT NULL,
    CONSTRAINT "clean_checklist_items_category_check" CHECK (("category" = ANY (ARRAY['request'::"text", 'consumable'::"text", 'equipment'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."clean_checklist_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "checklist_item_id" "uuid" NOT NULL,
    "photo_path" "text" NOT NULL,
    "taken_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "taken_by_member" "text"
);

CREATE TABLE IF NOT EXISTS "public"."clean_issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "clean_task_id" "uuid",
    "reported_by_cleaner_id" "uuid",
    "reported_by_user_id" "uuid",
    "issue_type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "urgency" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "photo_paths" "text"[] DEFAULT '{}'::"text"[],
    "acknowledged_at" timestamp with time zone,
    "acknowledged_by" "uuid",
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "resolution_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "claimed_by" "uuid",
    "claimed_at" timestamp with time zone,
    "maintenance_stage" "text" DEFAULT 'reported'::"text" NOT NULL,
    "handoff_to" "uuid",
    "handoff_note" "text",
    "handoff_at" timestamp with time zone,
    "completion_note" "text",
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    CONSTRAINT "clean_issues_maintenance_stage_check" CHECK (("maintenance_stage" = ANY (ARRAY['reported'::"text", 'claimed'::"text", 'in_progress'::"text", 'pending_parts'::"text", 'handoff'::"text", 'complete'::"text"]))),
    CONSTRAINT "clean_issues_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'acknowledged'::"text", 'in_progress'::"text", 'resolved'::"text", 'complete'::"text"]))),
    CONSTRAINT "clean_issues_urgency_check" CHECK (("urgency" = ANY (ARRAY['low'::"text", 'medium'::"text", 'urgent'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."clean_state_resets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "previous_state" "text",
    "new_state" "text" NOT NULL,
    "reason" "text",
    "note" "text",
    "reset_by" "uuid",
    "reset_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "clean_state_resets_new_state_check" CHECK (("new_state" = ANY (ARRAY['clean'::"text", 'dirty'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."clean_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "reservation_id" "uuid",
    "scheduled_date" "date" NOT NULL,
    "assigned_cleaner_id" "uuid",
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "priority" "text" DEFAULT 'standard'::"text" NOT NULL,
    "estimated_start_time" time without time zone,
    "cleaning_duration_minutes" integer DEFAULT 90 NOT NULL,
    "travel_time_from_previous_minutes" integer DEFAULT 0,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "route_order" integer DEFAULT 0,
    "is_same_day_turnaround" boolean DEFAULT false,
    "checkout_time" time without time zone,
    "checkin_time" time without time zone,
    "source" "text" DEFAULT 'hostaway'::"text" NOT NULL,
    "task_type" "text" DEFAULT 'clean'::"text" NOT NULL,
    "notes" "text",
    "overloaded" boolean DEFAULT false NOT NULL,
    "override_assignment" boolean DEFAULT false NOT NULL,
    "warning_reason" "text",
    "priority_level" smallint DEFAULT 2 NOT NULL,
    "started_at" timestamp with time zone,
    "started_by_member" "text",
    "completed_by_member" "text",
    "not_required" boolean DEFAULT false NOT NULL,
    "completion_source" "text"
);

ALTER TABLE ONLY "public"."clean_tasks" REPLICA IDENTITY FULL;

COMMENT ON COLUMN "public"."clean_tasks"."priority_level" IS '0=P0 arrival-risk orphan carryover, 1=P1 same-day turnaround, 2=P2 standard checkout, 3=P3 orphan-gap fill';

CREATE TABLE IF NOT EXISTS "public"."cleaner_holidays" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "reason" "text" DEFAULT 'Holiday'::"text" NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cleaner_holidays_dates_valid" CHECK (("end_date" >= "start_date"))
);

CREATE TABLE IF NOT EXISTS "public"."cleaner_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."cleaner_property_rates" (
    "cleaner_id" "uuid" NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "rate" numeric NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cleaner_property_rates_rate_check" CHECK (("rate" >= (0)::numeric))
);

CREATE TABLE IF NOT EXISTS "public"."cleaner_working_exceptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cleaner_id" "uuid" NOT NULL,
    "work_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."cleaners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "region" "text" DEFAULT 'Other'::"text" NOT NULL,
    "non_working_days" "text"[] DEFAULT '{}'::"text"[],
    "rate_per_clean" numeric DEFAULT 0,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "location_groups" "text"[] DEFAULT '{}'::"text"[],
    "workload_share" "jsonb" DEFAULT '{}'::"jsonb",
    "daily_working_hours" numeric DEFAULT 8 NOT NULL,
    "notify_email" boolean DEFAULT false NOT NULL,
    "notify_whatsapp" boolean DEFAULT false NOT NULL,
    "home_postcode" "text",
    "home_latitude" numeric,
    "home_longitude" numeric,
    "user_id" "uuid",
    "color" "text",
    "is_team" boolean DEFAULT false NOT NULL,
    "is_offline" boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."communal_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."consumable_charges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "clean_task_id" "uuid" NOT NULL,
    "rate_id" "uuid",
    "type" "text",
    "amount" numeric(10,2) NOT NULL,
    "charge_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."consumable_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "type" "text" NOT NULL,
    "listing_id" "uuid",
    "region" "text",
    "communal_group_id" "uuid",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "consumable_rates_target_ck" CHECK (((("type" = 'direct_to_property'::"text") AND ("listing_id" IS NOT NULL)) OR (("type" = 'region'::"text") AND ("region" IS NOT NULL)) OR (("type" = 'communal'::"text") AND ("communal_group_id" IS NOT NULL)))),
    CONSTRAINT "consumable_rates_type_check" CHECK (("type" = ANY (ARRAY['direct_to_property'::"text", 'region'::"text", 'communal'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."consumables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid",
    "name" "text" NOT NULL,
    "room_type" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "consumables_room_type_check" CHECK (("room_type" = ANY (ARRAY['kitchen'::"text", 'bathroom'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."cost_line_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "source_category" "public"."report_source_category" NOT NULL,
    "default_target_pct" numeric(6,4),
    "is_settlement_cost" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."expense_consumables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchased_by_user_id" "uuid",
    "purchased_by_name" "text",
    "purchase_date" "date" NOT NULL,
    "supplier" "text" NOT NULL,
    "receipt_value" numeric(10,2) NOT NULL,
    "payer" "text" NOT NULL,
    "reimbursed" boolean DEFAULT false NOT NULL,
    "reimbursed_at" timestamp with time zone,
    "allocation_type" "text" NOT NULL,
    "listing_id" "uuid",
    "region" "text",
    "notes" "text",
    "receipt_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "expense_consumables_allocation_type_check" CHECK (("allocation_type" = ANY (ARRAY['property'::"text", 'region'::"text"]))),
    CONSTRAINT "expense_consumables_payer_check" CHECK (("payer" = ANY (ARRAY['company'::"text", 'cleaner'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."expense_laundry_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bill_id" "uuid" NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "listing_name" "text" NOT NULL,
    "bookings_in_period" integer DEFAULT 0 NOT NULL,
    "bedrooms" integer DEFAULT 0 NOT NULL,
    "rooms_let" integer DEFAULT 0 NOT NULL,
    "allocation_pct" numeric(6,4) DEFAULT 0 NOT NULL,
    "allocated_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."expense_laundry_bills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bill_date" "date" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "supplier" "text" DEFAULT 'Laundry Service'::"text" NOT NULL,
    "total_amount" numeric(10,2) NOT NULL,
    "notes" "text",
    "receipt_path" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."laundry_charges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "clean_task_id" "uuid" NOT NULL,
    "rate_id" "uuid",
    "region" "text",
    "amount" numeric(10,2) NOT NULL,
    "charge_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."laundry_rate_regions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rate_id" "uuid" NOT NULL,
    "region" "text" NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."laundry_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" DEFAULT 'Laundry'::"text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."line_adjustments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_period_id" "uuid" NOT NULL,
    "listing_id" "uuid",
    "target" "public"."adjustment_target" NOT NULL,
    "cost_line_type_id" "uuid",
    "amount" numeric(12,2) NOT NULL,
    "reason" "text" NOT NULL,
    "adjusted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cost_line_ref_consistency" CHECK (((("target" = 'cost_line'::"public"."adjustment_target") AND ("cost_line_type_id" IS NOT NULL)) OR (("target" <> 'cost_line'::"public"."adjustment_target") AND ("cost_line_type_id" IS NULL))))
);

CREATE TABLE IF NOT EXISTS "public"."listing_aliases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "platform" "public"."ota_platform" NOT NULL,
    "raw_name" "text" NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid",
    "name" "text" NOT NULL,
    "address" "text",
    "city" "text",
    "country" "text",
    "property_type" "text",
    "bedrooms" integer,
    "bathrooms" integer,
    "max_guests" integer,
    "nightly_rate" numeric(10,2),
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hostaway_listing_id" integer,
    "postcode" "text",
    "latitude" numeric,
    "longitude" numeric,
    "tags" "text",
    "location_group" "text",
    "min_rate" numeric,
    "base_rate" numeric,
    "primary_cleaner" "text",
    "management_rate_override" numeric,
    "operational_notes" "text",
    "troubleshooting_notes" "text",
    "access_details" "text",
    "google_place_id" "text",
    "cleaning_duration_minutes" integer,
    "is_clean" boolean DEFAULT true NOT NULL,
    "is_bundle" boolean DEFAULT false NOT NULL,
    "bundle_components" "jsonb",
    "default_check_in_time" time without time zone DEFAULT '15:00:00'::time without time zone,
    "default_check_out_time" time without time zone DEFAULT '10:00:00'::time without time zone,
    "has_hot_tub" boolean DEFAULT false NOT NULL,
    "has_ev_charger" boolean DEFAULT false NOT NULL,
    "pet_friendly" boolean DEFAULT false NOT NULL,
    "self_check_in" boolean DEFAULT false NOT NULL,
    "amenities" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "slug" "text",
    "min_stay_nights" integer DEFAULT 2 NOT NULL,
    "cleaning_fee" numeric(10,2),
    "deep_fee" numeric(10,2),
    "is_communal" boolean DEFAULT false NOT NULL,
    "communal_ratio_pct" numeric(6,3),
    "communal_group_id" "uuid",
    "management_flat_fee" numeric(12,2),
    "internal_name" "text",
    "kitchens" integer DEFAULT 1 NOT NULL,
    "is_suspended" boolean DEFAULT false NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    "archived_at" timestamp with time zone,
    CONSTRAINT "listings_communal_ratio_pct_check" CHECK ((("communal_ratio_pct" IS NULL) OR (("communal_ratio_pct" >= (0)::numeric) AND ("communal_ratio_pct" <= (100)::numeric))))
);

COMMENT ON COLUMN "public"."listings"."min_stay_nights" IS 'Minimum bookable stay length in nights. Used to detect Orphan Gaps in calendars (gaps shorter than this are unbookable stranded inventory).';

CREATE TABLE IF NOT EXISTS "public"."location_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."maintenance_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "type" "text" DEFAULT 'maintenance'::"text" NOT NULL,
    "scope" "text" DEFAULT 'property'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "listing_id" "uuid",
    "communal_group_id" "uuid",
    "billable" boolean,
    "cost" numeric(10,2),
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "postpone_reason" "text",
    "postponed_until" "date",
    "created_by" "uuid",
    "accepted_by" "uuid",
    "accepted_at" timestamp with time zone,
    "completed_by" "uuid",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reservation_id" "uuid",
    CONSTRAINT "maintenance_tasks_scope_check" CHECK (("scope" = ANY (ARRAY['property'::"text", 'communal'::"text"]))),
    CONSTRAINT "maintenance_tasks_scope_ck" CHECK (((("scope" = 'property'::"text") AND ("listing_id" IS NOT NULL)) OR (("scope" = 'communal'::"text") AND ("communal_group_id" IS NOT NULL)))),
    CONSTRAINT "maintenance_tasks_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'welcome_basket'::"text"]))),
    CONSTRAINT "maintenance_tasks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'done'::"text", 'postponed'::"text"]))),
    CONSTRAINT "maintenance_tasks_type_check" CHECK (("type" = ANY (ARRAY['maintenance'::"text", 'setup'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."notification_settings" (
    "id" integer DEFAULT 1 NOT NULL,
    "booking_push_enabled" boolean DEFAULT true NOT NULL,
    "dispatch_secret" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notification_settings_id_check" CHECK (("id" = 1))
);

CREATE TABLE IF NOT EXISTS "public"."orin_briefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "period_type" "text" NOT NULL,
    "period_label" "text" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "content" "jsonb",
    "status" "text" DEFAULT 'generating'::"text" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "orin_briefs_period_type_check" CHECK (("period_type" = ANY (ARRAY['monthly'::"text", 'quarterly'::"text"]))),
    CONSTRAINT "orin_briefs_status_check" CHECK (("status" = ANY (ARRAY['generated'::"text", 'generating'::"text", 'failed'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."orin_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "current_page" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "orin_conversations_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."ota_attribution_decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ota_transaction_id" "uuid" NOT NULL,
    "outcome" "public"."ota_attribution_outcome" NOT NULL,
    "allocated_listing_id" "uuid",
    "reason" "text",
    "decided_by" "uuid",
    "decided_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "allocation_consistency" CHECK (((("outcome" = 'management_report'::"public"."ota_attribution_outcome") AND ("allocated_listing_id" IS NOT NULL)) OR (("outcome" = 'company_retention'::"public"."ota_attribution_outcome") AND ("allocated_listing_id" IS NULL))))
);

CREATE TABLE IF NOT EXISTS "public"."ota_import_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "platform" "public"."ota_platform" NOT NULL,
    "source_filename" "text" NOT NULL,
    "inferred_period_start" "date",
    "inferred_period_end" "date",
    "row_count" integer DEFAULT 0 NOT NULL,
    "status" "public"."ota_batch_status" DEFAULT 'parsed'::"public"."ota_batch_status" NOT NULL,
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."ota_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "platform" "public"."ota_platform" NOT NULL,
    "txn_type" "public"."ota_txn_type" NOT NULL,
    "confirmation_code" "text",
    "reference_number" "text",
    "statement_descriptor" "text",
    "bookingcom_property_id" "text",
    "property_name_raw" "text",
    "guest_name" "text",
    "check_in" "date",
    "check_out" "date",
    "nights" integer,
    "currency" "text" DEFAULT 'GBP'::"text" NOT NULL,
    "gross_amount" numeric(12,2),
    "commission_amount" numeric(12,2),
    "commission_pct" numeric(7,4),
    "payment_fee_amount" numeric(12,2),
    "vat" numeric(12,2),
    "tax" numeric(12,2),
    "net_amount" numeric(12,2),
    "collection_model" "public"."ota_collection_model",
    "is_revenue" boolean DEFAULT false NOT NULL,
    "resolved_listing_id" "uuid",
    "matched_reservation_id" "uuid",
    "match_confidence" numeric(4,3),
    "match_method" "public"."ota_match_method" DEFAULT 'none'::"public"."ota_match_method" NOT NULL,
    "recon_status" "public"."ota_recon_status" DEFAULT 'needs_recon'::"public"."ota_recon_status" NOT NULL,
    "raw_row" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "external_txn_id" "text"
);

CREATE TABLE IF NOT EXISTS "public"."owner_notification_prefs" (
    "owner_id" "uuid" NOT NULL,
    "notify_bookings" boolean DEFAULT false NOT NULL,
    "notify_orin" boolean DEFAULT false NOT NULL,
    "orin_frequency" "text" DEFAULT 'weekly'::"text" NOT NULL,
    "last_weekly_sent" "date",
    "last_monthly_sent" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "owner_notification_prefs_orin_frequency_check" CHECK (("orin_frequency" = ANY (ARRAY['weekly'::"text", 'monthly'::"text", 'both'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."phantom_trace" (
    "id" bigint NOT NULL,
    "ts" timestamp with time zone DEFAULT "now"() NOT NULL,
    "path" "text",
    "caller" "text",
    "target_date" "date",
    "scheduled_date" "date",
    "reservation_id" "uuid",
    "src_checkout" "date",
    "clean_source" "text"
);

CREATE SEQUENCE IF NOT EXISTS "public"."phantom_trace_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."phantom_trace_id_seq" OWNED BY "public"."phantom_trace"."id";

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."property_amenities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "amenity_id" "uuid" NOT NULL,
    "distance_km" numeric,
    "drive_time_mins" integer,
    "walk_time_mins" integer,
    "directions_url" "text",
    "is_featured" boolean DEFAULT false NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "staff_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."property_appliances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "location" "text",
    "model_number" "text",
    "instructions" "text",
    "common_issues" "text",
    "manual_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."property_beds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "bedroom_label" "text" NOT NULL,
    "bed_type_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "property_beds_quantity_check" CHECK (("quantity" > 0))
);

CREATE TABLE IF NOT EXISTS "public"."property_booking_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_period_id" "uuid" NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "channel" "public"."report_booking_channel" NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."property_briefs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "body" "text" NOT NULL,
    "photo_paths" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "consumed_by_clean_task_id" "uuid",
    "consumed_at" timestamp with time zone,
    "consumed_by_member" "text",
    "resolved_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "public"."property_clean_rates" (
    "listing_id" "uuid" NOT NULL,
    "rate" numeric NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "property_clean_rates_rate_check" CHECK (("rate" >= (0)::numeric))
);

CREATE TABLE IF NOT EXISTS "public"."property_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "role" "text",
    "phone" "text",
    "email" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."property_cost_benchmarks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "cost_line_type_id" "uuid" NOT NULL,
    "effective_from" "date" NOT NULL,
    "target_pct" numeric(6,4) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."property_costs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_period_id" "uuid" NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "cost_line_type_id" "uuid" NOT NULL,
    "actual_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "source" "public"."report_source_category" DEFAULT 'manual'::"public"."report_source_category" NOT NULL,
    "source_ref" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."property_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "type" "text" DEFAULT 'link'::"text" NOT NULL,
    "url" "text",
    "expiry_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "property_documents_type_check" CHECK (("type" = ANY (ARRAY['document'::"text", 'link'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."property_equipment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "requires_photo" boolean DEFAULT true NOT NULL,
    "min_photos" smallint DEFAULT 1 NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."property_knowledge" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "property_type" "text",
    "key_features" "text",
    "general_notes" "text",
    "key_safe_location" "text",
    "key_safe_code" "text",
    "lock_type" "text",
    "spare_key_location" "text",
    "gate_code" "text",
    "alarm_code" "text",
    "access_notes" "text",
    "boiler_make_model" "text",
    "boiler_location" "text",
    "boiler_reset_procedure" "text",
    "stopcock_location" "text",
    "fusebox_location" "text",
    "electric_meter_location" "text",
    "gas_meter_location" "text",
    "water_pressure_notes" "text",
    "utility_notes" "text",
    "heating_system_type" "text",
    "thermostat_location" "text",
    "hot_water_cylinder_location" "text",
    "immersion_heater_details" "text",
    "oil_tank_location" "text",
    "oil_supplier_contact" "text",
    "heating_notes" "text",
    "has_hot_tub" boolean DEFAULT false NOT NULL,
    "hot_tub_make_model" "text",
    "hot_tub_chemical_schedule" "text",
    "hot_tub_target_temp" numeric,
    "hot_tub_filter_frequency" "text",
    "hot_tub_error_codes" "jsonb" DEFAULT '[]'::"jsonb",
    "hot_tub_supplier_contact" "text",
    "hot_tub_last_service" "date",
    "hot_tub_notes" "text",
    "wifi_ssid" "text",
    "wifi_password" "text",
    "router_location" "text",
    "router_reset_procedure" "text",
    "backup_network" "text",
    "wifi_notes" "text",
    "cleaning_quirks" "text",
    "cleaning_supplies_location" "text",
    "cleaning_duration_hours" numeric,
    "linen_storage_location" "text",
    "bin_location" "text",
    "bin_collection_day" "text",
    "recycling_notes" "text",
    "cleaning_notes" "text",
    "completion_score" integer DEFAULT 0 NOT NULL,
    "last_updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "local_area" "text",
    "guest_info" "text",
    "bins_recycling" "text",
    "parking_info" "text",
    "emergency_contacts" "text",
    "checkout_instructions" "text",
    "appliances_info" "text",
    "wifi_info" "text"
);

CREATE OR REPLACE VIEW "public"."property_knowledge_cleaner" WITH ("security_invoker"='on') AS
 SELECT "id",
    "listing_id",
    "property_type",
    "key_features",
    "key_safe_location",
    "lock_type",
    "spare_key_location",
    "access_notes",
    "boiler_location",
    "stopcock_location",
    "fusebox_location",
    "cleaning_quirks",
    "cleaning_supplies_location",
    "cleaning_duration_hours",
    "linen_storage_location",
    "bin_location",
    "bin_collection_day",
    "recycling_notes",
    "cleaning_notes",
    "wifi_ssid",
    "router_location",
    "has_hot_tub",
    "hot_tub_chemical_schedule",
    "hot_tub_target_temp",
    "hot_tub_filter_frequency",
    "completion_score",
    "updated_at"
   FROM "public"."property_knowledge";

CREATE OR REPLACE VIEW "public"."property_knowledge_owner" WITH ("security_invoker"='on') AS
 SELECT "id",
    "listing_id",
    "property_type",
    "key_features",
    "general_notes",
    "wifi_ssid",
    "router_location",
    "wifi_notes",
    "has_hot_tub",
    "hot_tub_make_model",
    "completion_score",
    "updated_at"
   FROM "public"."property_knowledge";

CREATE TABLE IF NOT EXISTS "public"."property_known_issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'monitoring'::"text" NOT NULL,
    "priority" "text" DEFAULT 'low'::"text" NOT NULL,
    "assigned_to" "uuid",
    "next_action" "text",
    "next_action_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "property_known_issues_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "property_known_issues_status_check" CHECK (("status" = ANY (ARRAY['monitoring'::"text", 'scheduled'::"text", 'waiting'::"text", 'resolved'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."property_maintenance_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "issue_description" "text" NOT NULL,
    "action_taken" "text",
    "resolved_by" "text",
    "cost" numeric,
    "status" "text" DEFAULT 'resolved'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "property_maintenance_log_status_check" CHECK (("status" = ANY (ARRAY['resolved'::"text", 'ongoing'::"text", 'monitoring'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."property_owners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "company" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "management_rate_pct" numeric,
    "vat_inclusive" boolean DEFAULT false NOT NULL,
    "management_fee_method" "public"."management_fee_method" DEFAULT 'percent_per_property'::"public"."management_fee_method" NOT NULL,
    "settlement_method" "public"."settlement_method" DEFAULT 'pay_on_generation'::"public"."settlement_method" NOT NULL,
    "weekly_rr_amount" numeric(12,2),
    "flat_portfolio_fee" numeric(12,2),
    "opening_balance" numeric(12,2) DEFAULT 0 NOT NULL,
    "revenue_recognition" "public"."revenue_recognition" DEFAULT 'prorate_by_nights'::"public"."revenue_recognition" NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."property_targets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "effective_from" "date" NOT NULL,
    "target_revenue" numeric(12,2),
    "target_occupancy_pct" numeric(6,4),
    "target_adr" numeric(12,2),
    "target_length_of_stay" numeric(6,2),
    "target_bookingcom_max_pct" numeric(6,4),
    "target_airbnb_max_pct" numeric(6,4),
    "target_direct_min_pct" numeric(6,4),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_used_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "public"."report_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "status" "public"."report_status" DEFAULT 'draft'::"public"."report_status" NOT NULL,
    "opening_balance" numeric(12,2) DEFAULT 0 NOT NULL,
    "weekly_rr_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "revenue_total" numeric(12,2),
    "cost_total" numeric(12,2),
    "net_total" numeric(12,2),
    "settlement_due" numeric(12,2),
    "net_settlement_balance" numeric(12,2),
    "generated_at" timestamp with time zone,
    "finalised_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "icon" "text",
    "active" boolean DEFAULT true NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "guest_name" "text" NOT NULL,
    "check_in" "date" NOT NULL,
    "check_out" "date" NOT NULL,
    "total_amount" numeric(10,2),
    "platform" "text",
    "status" "text" DEFAULT 'confirmed'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "owner_payout" numeric,
    "guest_fees" numeric,
    "reservation_date" "date",
    "hostaway_reservation_id" bigint,
    "booking_lead_days" integer,
    "day_of_week" smallint,
    "week_number" smallint,
    "month" smallint,
    "quarter" smallint,
    "year" smallint,
    "check_in_time" time without time zone,
    "check_out_time" time without time zone,
    "cleaning_fee" numeric DEFAULT 0,
    "channel_commission" numeric DEFAULT 0,
    "tax_amount" numeric DEFAULT 0,
    "host_payout" numeric,
    "channel_reservation_code" "text",
    "host_note" "text",
    "guest_note" "text",
    "custom_fields" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "notified_at" timestamp with time zone
);

COMMENT ON COLUMN "public"."reservations"."cleaning_fee" IS 'Cleaning fee charged to the guest (from Hostaway)';

COMMENT ON COLUMN "public"."reservations"."channel_commission" IS 'Commission taken by booking channel (Airbnb, Booking.com, etc.)';

COMMENT ON COLUMN "public"."reservations"."tax_amount" IS 'Tax amount included in total_amount';

COMMENT ON COLUMN "public"."reservations"."host_payout" IS 'Net amount paid to host by channel (true net revenue). When NULL, calculate as total_amount - cleaning_fee - channel_commission - tax_amount';

CREATE TABLE IF NOT EXISTS "public"."seasons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "start_month" integer NOT NULL,
    "start_day" integer NOT NULL,
    "end_month" integer NOT NULL,
    "end_day" integer NOT NULL,
    "spend_threshold" numeric(10,2) DEFAULT 0 NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "seasons_end_day_check" CHECK ((("end_day" >= 1) AND ("end_day" <= 31))),
    CONSTRAINT "seasons_end_month_check" CHECK ((("end_month" >= 1) AND ("end_month" <= 12))),
    CONSTRAINT "seasons_start_day_check" CHECK ((("start_day" >= 1) AND ("start_day" <= 31))),
    CONSTRAINT "seasons_start_month_check" CHECK ((("start_month" >= 1) AND ("start_month" <= 12)))
);

CREATE TABLE IF NOT EXISTS "public"."sync_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sync_type" "text" DEFAULT 'full'::"text" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "listings_synced" integer DEFAULT 0,
    "reservations_synced" integer DEFAULT 0,
    "reservations_skipped" integer DEFAULT 0,
    "errors" "jsonb" DEFAULT '[]'::"jsonb",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "triggered_by" "uuid"
);

CREATE TABLE IF NOT EXISTS "public"."upload_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "uploaded_by" "uuid",
    "file_name" "text" NOT NULL,
    "row_count" integer DEFAULT 0,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."user_area_permissions" (
    "user_id" "uuid" NOT NULL,
    "area_key" "text" NOT NULL,
    "level" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_area_permissions_level_check" CHECK (("level" = ANY (ARRAY['none'::"text", 'view'::"text", 'edit'::"text", 'manage'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."utility_expense_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "utility_expense_id" "uuid" NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "attribution_pct" numeric(6,3) NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "expense_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."utility_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "expense_date" "date" NOT NULL,
    "value" numeric(10,2) NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE OR REPLACE VIEW "public"."v_property_amenities" AS
 SELECT "pa"."id",
    "pa"."listing_id",
    "pa"."amenity_id",
    "pa"."distance_km",
    "pa"."drive_time_mins",
    "pa"."walk_time_mins",
    "pa"."directions_url",
    "pa"."is_featured",
    "pa"."display_order",
    "pa"."staff_note",
    "pa"."created_at",
    "pa"."updated_at",
    "a"."name",
    "a"."category",
    "a"."address",
    "a"."postcode",
    "a"."latitude",
    "a"."longitude",
    "a"."phone",
    "a"."website",
    "a"."opening_hours",
    "a"."price_range",
    "a"."rating",
    "a"."tags",
    "a"."is_active"
   FROM ("public"."property_amenities" "pa"
     JOIN "public"."amenities" "a" ON (("a"."id" = "pa"."amenity_id")));

ALTER TABLE ONLY "public"."phantom_trace" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."phantom_trace_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."amenities"
    ADD CONSTRAINT "amenities_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_key_key" UNIQUE ("key");

ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."automation_logs"
    ADD CONSTRAINT "automation_logs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."bank_statement_imports"
    ADD CONSTRAINT "bank_statement_imports_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."bank_statement_txns"
    ADD CONSTRAINT "bank_statement_txns_external_id_key" UNIQUE ("external_id");

ALTER TABLE ONLY "public"."bank_statement_txns"
    ADD CONSTRAINT "bank_statement_txns_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."bed_types"
    ADD CONSTRAINT "bed_types_name_key" UNIQUE ("name");

ALTER TABLE ONLY "public"."bed_types"
    ADD CONSTRAINT "bed_types_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."bill_allocations"
    ADD CONSTRAINT "bill_allocations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."bill_payee_rules"
    ADD CONSTRAINT "bill_payee_rules_payee_key_key" UNIQUE ("payee_key");

ALTER TABLE ONLY "public"."bill_payee_rules"
    ADD CONSTRAINT "bill_payee_rules_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."bills_on_behalf"
    ADD CONSTRAINT "bills_on_behalf_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."booking_requests"
    ADD CONSTRAINT "booking_requests_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."booking_requests"
    ADD CONSTRAINT "booking_requests_reservation_id_request_id_key" UNIQUE ("reservation_id", "request_id");

ALTER TABLE ONLY "public"."clean_checklist_items"
    ADD CONSTRAINT "clean_checklist_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."clean_checklist_photos"
    ADD CONSTRAINT "clean_checklist_photos_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."clean_issues"
    ADD CONSTRAINT "clean_issues_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."clean_state_resets"
    ADD CONSTRAINT "clean_state_resets_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."clean_tasks"
    ADD CONSTRAINT "clean_tasks_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."cleaner_holidays"
    ADD CONSTRAINT "cleaner_holidays_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."cleaner_members"
    ADD CONSTRAINT "cleaner_members_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."cleaner_property_rates"
    ADD CONSTRAINT "cleaner_property_rates_pkey" PRIMARY KEY ("cleaner_id", "listing_id");

ALTER TABLE ONLY "public"."cleaner_working_exceptions"
    ADD CONSTRAINT "cleaner_working_exceptions_cleaner_id_work_date_key" UNIQUE ("cleaner_id", "work_date");

ALTER TABLE ONLY "public"."cleaner_working_exceptions"
    ADD CONSTRAINT "cleaner_working_exceptions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."cleaners"
    ADD CONSTRAINT "cleaners_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."communal_groups"
    ADD CONSTRAINT "communal_groups_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."consumable_charges"
    ADD CONSTRAINT "consumable_charges_clean_task_id_rate_id_listing_id_key" UNIQUE ("clean_task_id", "rate_id", "listing_id");

ALTER TABLE ONLY "public"."consumable_charges"
    ADD CONSTRAINT "consumable_charges_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."consumable_rates"
    ADD CONSTRAINT "consumable_rates_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."consumables"
    ADD CONSTRAINT "consumables_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."cost_line_types"
    ADD CONSTRAINT "cost_line_types_code_key" UNIQUE ("code");

ALTER TABLE ONLY "public"."cost_line_types"
    ADD CONSTRAINT "cost_line_types_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."expense_consumables"
    ADD CONSTRAINT "expense_consumables_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."expense_laundry_allocations"
    ADD CONSTRAINT "expense_laundry_allocations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."expense_laundry_bills"
    ADD CONSTRAINT "expense_laundry_bills_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."laundry_charges"
    ADD CONSTRAINT "laundry_charges_clean_task_id_key" UNIQUE ("clean_task_id");

ALTER TABLE ONLY "public"."laundry_charges"
    ADD CONSTRAINT "laundry_charges_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."laundry_rate_regions"
    ADD CONSTRAINT "laundry_rate_regions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."laundry_rate_regions"
    ADD CONSTRAINT "laundry_rate_regions_rate_id_region_key" UNIQUE ("rate_id", "region");

ALTER TABLE ONLY "public"."laundry_rates"
    ADD CONSTRAINT "laundry_rates_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."line_adjustments"
    ADD CONSTRAINT "line_adjustments_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."listing_aliases"
    ADD CONSTRAINT "listing_aliases_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."listing_aliases"
    ADD CONSTRAINT "listing_aliases_platform_raw_name_key" UNIQUE ("platform", "raw_name");

ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_hostaway_listing_id_key" UNIQUE ("hostaway_listing_id");

ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."location_groups"
    ADD CONSTRAINT "location_groups_name_key" UNIQUE ("name");

ALTER TABLE ONLY "public"."location_groups"
    ADD CONSTRAINT "location_groups_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."maintenance_tasks"
    ADD CONSTRAINT "maintenance_tasks_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."orin_briefs"
    ADD CONSTRAINT "orin_briefs_period_type_period_label_key" UNIQUE ("period_type", "period_label");

ALTER TABLE ONLY "public"."orin_briefs"
    ADD CONSTRAINT "orin_briefs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."orin_conversations"
    ADD CONSTRAINT "orin_conversations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ota_attribution_decisions"
    ADD CONSTRAINT "ota_attribution_decisions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ota_import_batches"
    ADD CONSTRAINT "ota_import_batches_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."ota_transactions"
    ADD CONSTRAINT "ota_transactions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."owner_notification_prefs"
    ADD CONSTRAINT "owner_notification_prefs_pkey" PRIMARY KEY ("owner_id");

ALTER TABLE ONLY "public"."phantom_trace"
    ADD CONSTRAINT "phantom_trace_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."property_amenities"
    ADD CONSTRAINT "property_amenities_listing_id_amenity_id_key" UNIQUE ("listing_id", "amenity_id");

ALTER TABLE ONLY "public"."property_amenities"
    ADD CONSTRAINT "property_amenities_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."property_appliances"
    ADD CONSTRAINT "property_appliances_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."property_beds"
    ADD CONSTRAINT "property_beds_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."property_booking_sources"
    ADD CONSTRAINT "property_booking_sources_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."property_booking_sources"
    ADD CONSTRAINT "property_booking_sources_report_period_id_listing_id_channe_key" UNIQUE ("report_period_id", "listing_id", "channel");

ALTER TABLE ONLY "public"."property_briefs"
    ADD CONSTRAINT "property_briefs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."property_clean_rates"
    ADD CONSTRAINT "property_clean_rates_pkey" PRIMARY KEY ("listing_id");

ALTER TABLE ONLY "public"."property_contacts"
    ADD CONSTRAINT "property_contacts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."property_cost_benchmarks"
    ADD CONSTRAINT "property_cost_benchmarks_listing_id_cost_line_type_id_effec_key" UNIQUE ("listing_id", "cost_line_type_id", "effective_from");

ALTER TABLE ONLY "public"."property_cost_benchmarks"
    ADD CONSTRAINT "property_cost_benchmarks_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."property_costs"
    ADD CONSTRAINT "property_costs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."property_costs"
    ADD CONSTRAINT "property_costs_report_period_id_listing_id_cost_line_type_i_key" UNIQUE ("report_period_id", "listing_id", "cost_line_type_id");

ALTER TABLE ONLY "public"."property_documents"
    ADD CONSTRAINT "property_documents_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."property_equipment"
    ADD CONSTRAINT "property_equipment_listing_id_name_key" UNIQUE ("listing_id", "name");

ALTER TABLE ONLY "public"."property_equipment"
    ADD CONSTRAINT "property_equipment_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."property_knowledge"
    ADD CONSTRAINT "property_knowledge_listing_id_key" UNIQUE ("listing_id");

ALTER TABLE ONLY "public"."property_knowledge"
    ADD CONSTRAINT "property_knowledge_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."property_known_issues"
    ADD CONSTRAINT "property_known_issues_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."property_maintenance_log"
    ADD CONSTRAINT "property_maintenance_log_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."property_owners"
    ADD CONSTRAINT "property_owners_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."property_targets"
    ADD CONSTRAINT "property_targets_listing_id_effective_from_key" UNIQUE ("listing_id", "effective_from");

ALTER TABLE ONLY "public"."property_targets"
    ADD CONSTRAINT "property_targets_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");

ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."report_periods"
    ADD CONSTRAINT "report_periods_owner_id_period_start_key" UNIQUE ("owner_id", "period_start");

ALTER TABLE ONLY "public"."report_periods"
    ADD CONSTRAINT "report_periods_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."requests"
    ADD CONSTRAINT "requests_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."seasons"
    ADD CONSTRAINT "seasons_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."sync_logs"
    ADD CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."upload_batches"
    ADD CONSTRAINT "upload_batches_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "uq_reservations_hostaway_res_id" UNIQUE ("hostaway_reservation_id");

ALTER TABLE ONLY "public"."user_area_permissions"
    ADD CONSTRAINT "user_area_permissions_pkey" PRIMARY KEY ("user_id", "area_key");

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");

ALTER TABLE ONLY "public"."utility_expense_allocations"
    ADD CONSTRAINT "utility_expense_allocations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."utility_expense_allocations"
    ADD CONSTRAINT "utility_expense_allocations_utility_expense_id_listing_id_key" UNIQUE ("utility_expense_id", "listing_id");

ALTER TABLE ONLY "public"."utility_expenses"
    ADD CONSTRAINT "utility_expenses_pkey" PRIMARY KEY ("id");

CREATE UNIQUE INDEX "app_settings_key_unique" ON "public"."app_settings" USING "btree" ("key");

CREATE INDEX "bank_statement_txns_classification_status_idx" ON "public"."bank_statement_txns" USING "btree" ("classification", "status");

CREATE INDEX "bank_statement_txns_import_id_idx" ON "public"."bank_statement_txns" USING "btree" ("import_id");

CREATE INDEX "bill_allocations_bill_id_idx" ON "public"."bill_allocations" USING "btree" ("bill_id");

CREATE INDEX "bill_allocations_listing_id_idx" ON "public"."bill_allocations" USING "btree" ("listing_id");

CREATE INDEX "bills_on_behalf_bill_date_idx" ON "public"."bills_on_behalf" USING "btree" ("bill_date");

CREATE UNIQUE INDEX "clean_tasks_reservation_id_scheduled_date_key" ON "public"."clean_tasks" USING "btree" ("reservation_id", "listing_id", "scheduled_date") WHERE ("status" <> ALL (ARRAY['cancelled'::"text", 'canceled'::"text"]));

CREATE UNIQUE INDEX "clean_tasks_unique_listing_date_nonmanual" ON "public"."clean_tasks" USING "btree" ("listing_id", "scheduled_date") WHERE (("source" <> 'manual'::"text") AND ("status" <> ALL (ARRAY['cancelled'::"text", 'canceled'::"text"])));

CREATE INDEX "idx_amenities_active" ON "public"."amenities" USING "btree" ("is_active");

CREATE INDEX "idx_amenities_category" ON "public"."amenities" USING "btree" ("category");

CREATE INDEX "idx_amenities_postcode" ON "public"."amenities" USING "btree" ("postcode");

CREATE INDEX "idx_booking_requests_reservation" ON "public"."booking_requests" USING "btree" ("reservation_id");

CREATE INDEX "idx_checklist_task" ON "public"."clean_checklist_items" USING "btree" ("clean_task_id");

CREATE INDEX "idx_clean_checklist_photos_item" ON "public"."clean_checklist_photos" USING "btree" ("checklist_item_id");

CREATE INDEX "idx_clean_issues_created" ON "public"."clean_issues" USING "btree" ("created_at" DESC);

CREATE INDEX "idx_clean_issues_listing" ON "public"."clean_issues" USING "btree" ("listing_id");

CREATE INDEX "idx_clean_issues_status" ON "public"."clean_issues" USING "btree" ("status");

CREATE INDEX "idx_clean_state_resets_listing_id" ON "public"."clean_state_resets" USING "btree" ("listing_id");

CREATE INDEX "idx_clean_state_resets_reset_at" ON "public"."clean_state_resets" USING "btree" ("reset_at" DESC);

CREATE INDEX "idx_clean_tasks_overloaded" ON "public"."clean_tasks" USING "btree" ("overloaded") WHERE ("overloaded" = true);

CREATE INDEX "idx_clean_tasks_override" ON "public"."clean_tasks" USING "btree" ("override_assignment") WHERE ("override_assignment" = true);

CREATE INDEX "idx_clean_tasks_priority_level" ON "public"."clean_tasks" USING "btree" ("scheduled_date", "priority_level");

CREATE INDEX "idx_clean_tasks_scheduled_date" ON "public"."clean_tasks" USING "btree" ("scheduled_date");

CREATE INDEX "idx_cleaner_holidays_cleaner" ON "public"."cleaner_holidays" USING "btree" ("cleaner_id");

CREATE INDEX "idx_cleaner_holidays_dates" ON "public"."cleaner_holidays" USING "btree" ("start_date", "end_date");

CREATE INDEX "idx_cleaner_members" ON "public"."cleaner_members" USING "btree" ("cleaner_id");

CREATE UNIQUE INDEX "idx_cleaners_user_id" ON "public"."cleaners" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);

CREATE INDEX "idx_consumable_charges_date" ON "public"."consumable_charges" USING "btree" ("charge_date");

CREATE INDEX "idx_consumable_charges_listing" ON "public"."consumable_charges" USING "btree" ("listing_id");

CREATE INDEX "idx_consumables_room" ON "public"."consumables" USING "btree" ("room_type", "listing_id");

CREATE INDEX "idx_cwe_cleaner" ON "public"."cleaner_working_exceptions" USING "btree" ("cleaner_id");

CREATE INDEX "idx_cwe_date" ON "public"."cleaner_working_exceptions" USING "btree" ("work_date");

CREATE INDEX "idx_expense_consumables_date" ON "public"."expense_consumables" USING "btree" ("purchase_date" DESC);

CREATE INDEX "idx_expense_consumables_listing" ON "public"."expense_consumables" USING "btree" ("listing_id");

CREATE INDEX "idx_expense_consumables_payer" ON "public"."expense_consumables" USING "btree" ("payer");

CREATE INDEX "idx_laundry_allocations_bill" ON "public"."expense_laundry_allocations" USING "btree" ("bill_id");

CREATE INDEX "idx_laundry_allocations_listing" ON "public"."expense_laundry_allocations" USING "btree" ("listing_id");

CREATE INDEX "idx_laundry_bills_period" ON "public"."expense_laundry_bills" USING "btree" ("period_start", "period_end");

CREATE INDEX "idx_laundry_charges_date" ON "public"."laundry_charges" USING "btree" ("charge_date");

CREATE INDEX "idx_laundry_charges_listing" ON "public"."laundry_charges" USING "btree" ("listing_id");

CREATE INDEX "idx_laundry_rate_regions_region" ON "public"."laundry_rate_regions" USING "btree" ("region");

CREATE INDEX "idx_line_adjustments_period" ON "public"."line_adjustments" USING "btree" ("report_period_id");

CREATE INDEX "idx_listing_aliases_listing" ON "public"."listing_aliases" USING "btree" ("listing_id");

CREATE INDEX "idx_listings_archived" ON "public"."listings" USING "btree" ("is_archived");

CREATE INDEX "idx_listings_communal_group" ON "public"."listings" USING "btree" ("communal_group_id");

CREATE UNIQUE INDEX "idx_listings_hostaway_listing_id" ON "public"."listings" USING "btree" ("hostaway_listing_id") WHERE ("hostaway_listing_id" IS NOT NULL);

CREATE INDEX "idx_maintenance_tasks_group" ON "public"."maintenance_tasks" USING "btree" ("communal_group_id");

CREATE INDEX "idx_maintenance_tasks_listing" ON "public"."maintenance_tasks" USING "btree" ("listing_id");

CREATE INDEX "idx_maintenance_tasks_source" ON "public"."maintenance_tasks" USING "btree" ("source");

CREATE INDEX "idx_maintenance_tasks_status" ON "public"."maintenance_tasks" USING "btree" ("status");

CREATE INDEX "idx_orin_conversations_user_id" ON "public"."orin_conversations" USING "btree" ("user_id", "created_at" DESC);

CREATE INDEX "idx_ota_attr_txn" ON "public"."ota_attribution_decisions" USING "btree" ("ota_transaction_id");

CREATE INDEX "idx_ota_txn_batch" ON "public"."ota_transactions" USING "btree" ("batch_id");

CREATE INDEX "idx_ota_txn_listing" ON "public"."ota_transactions" USING "btree" ("resolved_listing_id");

CREATE INDEX "idx_ota_txn_recon_status" ON "public"."ota_transactions" USING "btree" ("recon_status");

CREATE INDEX "idx_ota_txn_reservation" ON "public"."ota_transactions" USING "btree" ("matched_reservation_id");

CREATE INDEX "idx_ota_txn_revenue" ON "public"."ota_transactions" USING "btree" ("is_revenue");

CREATE INDEX "idx_property_amenities_amenity" ON "public"."property_amenities" USING "btree" ("amenity_id");

CREATE INDEX "idx_property_amenities_featured" ON "public"."property_amenities" USING "btree" ("listing_id", "is_featured" DESC, "display_order", "distance_km");

CREATE INDEX "idx_property_amenities_listing" ON "public"."property_amenities" USING "btree" ("listing_id");

CREATE INDEX "idx_property_appliances_listing" ON "public"."property_appliances" USING "btree" ("listing_id");

CREATE INDEX "idx_property_beds_listing" ON "public"."property_beds" USING "btree" ("listing_id");

CREATE INDEX "idx_property_briefs_listing_open" ON "public"."property_briefs" USING "btree" ("listing_id") WHERE ("resolved_at" IS NULL);

CREATE INDEX "idx_property_contacts_listing" ON "public"."property_contacts" USING "btree" ("listing_id");

CREATE INDEX "idx_property_costs_period" ON "public"."property_costs" USING "btree" ("report_period_id");

CREATE INDEX "idx_property_documents_listing" ON "public"."property_documents" USING "btree" ("listing_id");

CREATE INDEX "idx_property_equipment_listing" ON "public"."property_equipment" USING "btree" ("listing_id");

CREATE INDEX "idx_property_knowledge_listing" ON "public"."property_knowledge" USING "btree" ("listing_id");

CREATE INDEX "idx_property_known_issues_listing" ON "public"."property_known_issues" USING "btree" ("listing_id");

CREATE INDEX "idx_property_maintenance_listing_date" ON "public"."property_maintenance_log" USING "btree" ("listing_id", "date" DESC);

CREATE INDEX "idx_property_targets_listing" ON "public"."property_targets" USING "btree" ("listing_id", "effective_from" DESC);

CREATE INDEX "idx_report_periods_owner" ON "public"."report_periods" USING "btree" ("owner_id", "period_start" DESC);

CREATE INDEX "idx_reservations_channel_reservation_code" ON "public"."reservations" USING "btree" ("channel_reservation_code") WHERE ("channel_reservation_code" IS NOT NULL);

CREATE INDEX "idx_utility_allocations_date" ON "public"."utility_expense_allocations" USING "btree" ("expense_date");

CREATE INDEX "idx_utility_allocations_expense" ON "public"."utility_expense_allocations" USING "btree" ("utility_expense_id");

CREATE INDEX "idx_utility_allocations_listing" ON "public"."utility_expense_allocations" USING "btree" ("listing_id");

CREATE UNIQUE INDEX "listings_slug_key" ON "public"."listings" USING "btree" ("slug") WHERE ("slug" IS NOT NULL);

CREATE UNIQUE INDEX "uq_checklist_item" ON "public"."clean_checklist_items" USING "btree" ("clean_task_id", "category", COALESCE("room_type", ''::"text"), COALESCE("room_index", 0), "label");

CREATE UNIQUE INDEX "uq_clean_tasks_one_live_auto_per_reservation" ON "public"."clean_tasks" USING "btree" ("reservation_id", "listing_id") WHERE (("reservation_id" IS NOT NULL) AND ("source" <> 'manual'::"text") AND ("status" <> ALL (ARRAY['cancelled'::"text", 'completed'::"text", 'done'::"text"])));

CREATE UNIQUE INDEX "uq_welcome_basket_per_reservation" ON "public"."maintenance_tasks" USING "btree" ("reservation_id") WHERE ("source" = 'welcome_basket'::"text");

CREATE UNIQUE INDEX "ux_ota_external_txn_id" ON "public"."ota_transactions" USING "btree" ("external_txn_id");

CREATE OR REPLACE TRIGGER "amenities_set_updated_at" BEFORE UPDATE ON "public"."amenities" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();

CREATE OR REPLACE TRIGGER "on_cleaner_assigned" AFTER UPDATE ON "public"."clean_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."notify_cleaner_on_assignment"();

CREATE OR REPLACE TRIGGER "on_today_task_created" AFTER INSERT OR UPDATE ON "public"."clean_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_today_task_allocation"();

CREATE OR REPLACE TRIGGER "property_amenities_set_updated_at" BEFORE UPDATE ON "public"."property_amenities" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();

CREATE OR REPLACE TRIGGER "tg_cleaner_holidays_updated_at" BEFORE UPDATE ON "public"."cleaner_holidays" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_appliances_updated_at" BEFORE UPDATE ON "public"."property_appliances" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_auto_create_clean_from_reservation" AFTER INSERT OR UPDATE OF "check_out", "listing_id", "status" ON "public"."reservations" FOR EACH ROW EXECUTE FUNCTION "public"."auto_create_clean_from_reservation"();

CREATE OR REPLACE TRIGGER "trg_bed_types_updated_at" BEFORE UPDATE ON "public"."bed_types" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_bill_payee_rules_touch" BEFORE UPDATE ON "public"."bill_payee_rules" FOR EACH ROW EXECUTE FUNCTION "public"."tg_bill_rules_touch_updated_at"();

CREATE OR REPLACE TRIGGER "trg_cancel_clean_on_reservation_cancel" AFTER UPDATE OF "status" ON "public"."reservations" FOR EACH ROW EXECUTE FUNCTION "public"."cancel_clean_on_reservation_cancel"();

CREATE OR REPLACE TRIGGER "trg_checklist_updated_at" BEFORE UPDATE ON "public"."clean_checklist_items" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_clean_issues_updated_at" BEFORE UPDATE ON "public"."clean_issues" FOR EACH ROW EXECUTE FUNCTION "public"."update_clean_issues_updated_at"();

CREATE OR REPLACE TRIGGER "trg_cleaner_delete_unassign" BEFORE DELETE ON "public"."cleaners" FOR EACH ROW EXECUTE FUNCTION "public"."tg_cleaner_delete_unassign"();

CREATE OR REPLACE TRIGGER "trg_communal_groups_updated_at" BEFORE UPDATE ON "public"."communal_groups" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_consumable_rates_updated_at" BEFORE UPDATE ON "public"."consumable_rates" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_consumables_updated_at" BEFORE UPDATE ON "public"."consumables" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_generate_turnover_charges" AFTER UPDATE OF "status" ON "public"."clean_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."generate_turnover_charges"();

CREATE OR REPLACE TRIGGER "trg_guard_clean_task_insert" BEFORE INSERT ON "public"."clean_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."guard_clean_task_insert"();

CREATE OR REPLACE TRIGGER "trg_known_issues_updated_at" BEFORE UPDATE ON "public"."property_known_issues" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_laundry_rates_updated_at" BEFORE UPDATE ON "public"."laundry_rates" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_location_groups_updated_at" BEFORE UPDATE ON "public"."location_groups" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_maintenance_tasks_updated_at" BEFORE UPDATE ON "public"."maintenance_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_notify_new_booking_ins" AFTER INSERT ON "public"."reservations" FOR EACH ROW WHEN (("new"."status" = 'confirmed'::"text")) EXECUTE FUNCTION "public"."notify_new_booking"();

CREATE OR REPLACE TRIGGER "trg_notify_new_booking_upd" AFTER UPDATE OF "status" ON "public"."reservations" FOR EACH ROW WHEN ((("old"."status" IS DISTINCT FROM 'confirmed'::"text") AND ("new"."status" = 'confirmed'::"text"))) EXECUTE FUNCTION "public"."notify_new_booking"();

CREATE OR REPLACE TRIGGER "trg_notify_owner_booking" AFTER INSERT OR UPDATE OF "status" ON "public"."reservations" FOR EACH ROW EXECUTE FUNCTION "public"."tg_notify_owner_booking"();

CREATE OR REPLACE TRIGGER "trg_owner_notification_prefs_updated_at" BEFORE UPDATE ON "public"."owner_notification_prefs" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_propagate_clean_duration" AFTER UPDATE OF "cleaning_duration_minutes" ON "public"."listings" FOR EACH ROW EXECUTE FUNCTION "public"."propagate_clean_duration"();

CREATE OR REPLACE TRIGGER "trg_property_knowledge_completion" BEFORE INSERT OR UPDATE ON "public"."property_knowledge" FOR EACH ROW EXECUTE FUNCTION "public"."calc_property_knowledge_completion"();

CREATE OR REPLACE TRIGGER "trg_requests_updated_at" BEFORE UPDATE ON "public"."requests" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_seasons_updated_at" BEFORE UPDATE ON "public"."seasons" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_utility_expenses_updated_at" BEFORE UPDATE ON "public"."utility_expenses" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_welcome_basket" AFTER INSERT ON "public"."reservations" FOR EACH ROW EXECUTE FUNCTION "public"."tg_create_welcome_basket"();

ALTER TABLE ONLY "public"."bank_statement_imports"
    ADD CONSTRAINT "bank_statement_imports_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."bank_statement_txns"
    ADD CONSTRAINT "bank_statement_txns_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "public"."bills_on_behalf"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."bank_statement_txns"
    ADD CONSTRAINT "bank_statement_txns_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "public"."bank_statement_imports"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."bank_statement_txns"
    ADD CONSTRAINT "bank_statement_txns_matched_owner_id_fkey" FOREIGN KEY ("matched_owner_id") REFERENCES "public"."property_owners"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."bill_allocations"
    ADD CONSTRAINT "bill_allocations_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "public"."bills_on_behalf"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."bill_allocations"
    ADD CONSTRAINT "bill_allocations_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."bill_payee_rules"
    ADD CONSTRAINT "bill_payee_rules_cost_line_type_id_fkey" FOREIGN KEY ("cost_line_type_id") REFERENCES "public"."cost_line_types"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."bill_payee_rules"
    ADD CONSTRAINT "bill_payee_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."bill_payee_rules"
    ADD CONSTRAINT "bill_payee_rules_target_communal_group_id_fkey" FOREIGN KEY ("target_communal_group_id") REFERENCES "public"."communal_groups"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."bill_payee_rules"
    ADD CONSTRAINT "bill_payee_rules_target_listing_id_fkey" FOREIGN KEY ("target_listing_id") REFERENCES "public"."listings"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."bills_on_behalf"
    ADD CONSTRAINT "bills_on_behalf_cost_line_type_id_fkey" FOREIGN KEY ("cost_line_type_id") REFERENCES "public"."cost_line_types"("id");

ALTER TABLE ONLY "public"."bills_on_behalf"
    ADD CONSTRAINT "bills_on_behalf_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."bills_on_behalf"
    ADD CONSTRAINT "bills_on_behalf_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "public"."bank_statement_imports"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."bills_on_behalf"
    ADD CONSTRAINT "bills_on_behalf_target_communal_group_id_fkey" FOREIGN KEY ("target_communal_group_id") REFERENCES "public"."communal_groups"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."bills_on_behalf"
    ADD CONSTRAINT "bills_on_behalf_txn_id_fkey" FOREIGN KEY ("txn_id") REFERENCES "public"."bank_statement_txns"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."booking_requests"
    ADD CONSTRAINT "booking_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."booking_requests"
    ADD CONSTRAINT "booking_requests_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."booking_requests"
    ADD CONSTRAINT "booking_requests_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."clean_checklist_items"
    ADD CONSTRAINT "clean_checklist_items_checked_by_fkey" FOREIGN KEY ("checked_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."clean_checklist_items"
    ADD CONSTRAINT "clean_checklist_items_clean_task_id_fkey" FOREIGN KEY ("clean_task_id") REFERENCES "public"."clean_tasks"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."clean_checklist_photos"
    ADD CONSTRAINT "clean_checklist_photos_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."clean_checklist_items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."clean_issues"
    ADD CONSTRAINT "clean_issues_claimed_by_fkey" FOREIGN KEY ("claimed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."clean_issues"
    ADD CONSTRAINT "clean_issues_clean_task_id_fkey" FOREIGN KEY ("clean_task_id") REFERENCES "public"."clean_tasks"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."clean_issues"
    ADD CONSTRAINT "clean_issues_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."clean_issues"
    ADD CONSTRAINT "clean_issues_handoff_to_fkey" FOREIGN KEY ("handoff_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."clean_issues"
    ADD CONSTRAINT "clean_issues_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."clean_issues"
    ADD CONSTRAINT "clean_issues_reported_by_cleaner_id_fkey" FOREIGN KEY ("reported_by_cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."clean_tasks"
    ADD CONSTRAINT "clean_tasks_assigned_cleaner_id_fkey" FOREIGN KEY ("assigned_cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."clean_tasks"
    ADD CONSTRAINT "clean_tasks_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."clean_tasks"
    ADD CONSTRAINT "clean_tasks_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."cleaner_holidays"
    ADD CONSTRAINT "cleaner_holidays_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."cleaner_members"
    ADD CONSTRAINT "cleaner_members_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."cleaner_property_rates"
    ADD CONSTRAINT "cleaner_property_rates_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."cleaner_property_rates"
    ADD CONSTRAINT "cleaner_property_rates_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."cleaner_working_exceptions"
    ADD CONSTRAINT "cleaner_working_exceptions_cleaner_id_fkey" FOREIGN KEY ("cleaner_id") REFERENCES "public"."cleaners"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."cleaners"
    ADD CONSTRAINT "cleaners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."consumable_charges"
    ADD CONSTRAINT "consumable_charges_clean_task_id_fkey" FOREIGN KEY ("clean_task_id") REFERENCES "public"."clean_tasks"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."consumable_charges"
    ADD CONSTRAINT "consumable_charges_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."consumable_charges"
    ADD CONSTRAINT "consumable_charges_rate_id_fkey" FOREIGN KEY ("rate_id") REFERENCES "public"."consumable_rates"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."consumable_rates"
    ADD CONSTRAINT "consumable_rates_communal_group_id_fkey" FOREIGN KEY ("communal_group_id") REFERENCES "public"."communal_groups"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."consumable_rates"
    ADD CONSTRAINT "consumable_rates_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."consumables"
    ADD CONSTRAINT "consumables_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."expense_consumables"
    ADD CONSTRAINT "expense_consumables_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."expense_consumables"
    ADD CONSTRAINT "expense_consumables_purchased_by_user_id_fkey" FOREIGN KEY ("purchased_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."expense_laundry_allocations"
    ADD CONSTRAINT "expense_laundry_allocations_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "public"."expense_laundry_bills"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."expense_laundry_allocations"
    ADD CONSTRAINT "expense_laundry_allocations_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."expense_laundry_bills"
    ADD CONSTRAINT "expense_laundry_bills_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."laundry_charges"
    ADD CONSTRAINT "laundry_charges_clean_task_id_fkey" FOREIGN KEY ("clean_task_id") REFERENCES "public"."clean_tasks"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."laundry_charges"
    ADD CONSTRAINT "laundry_charges_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."laundry_charges"
    ADD CONSTRAINT "laundry_charges_rate_id_fkey" FOREIGN KEY ("rate_id") REFERENCES "public"."laundry_rates"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."laundry_rate_regions"
    ADD CONSTRAINT "laundry_rate_regions_rate_id_fkey" FOREIGN KEY ("rate_id") REFERENCES "public"."laundry_rates"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."line_adjustments"
    ADD CONSTRAINT "line_adjustments_cost_line_type_id_fkey" FOREIGN KEY ("cost_line_type_id") REFERENCES "public"."cost_line_types"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."line_adjustments"
    ADD CONSTRAINT "line_adjustments_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."line_adjustments"
    ADD CONSTRAINT "line_adjustments_report_period_id_fkey" FOREIGN KEY ("report_period_id") REFERENCES "public"."report_periods"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."listing_aliases"
    ADD CONSTRAINT "listing_aliases_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_communal_group_id_fkey" FOREIGN KEY ("communal_group_id") REFERENCES "public"."communal_groups"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."property_owners"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."maintenance_tasks"
    ADD CONSTRAINT "maintenance_tasks_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."maintenance_tasks"
    ADD CONSTRAINT "maintenance_tasks_communal_group_id_fkey" FOREIGN KEY ("communal_group_id") REFERENCES "public"."communal_groups"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."maintenance_tasks"
    ADD CONSTRAINT "maintenance_tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."maintenance_tasks"
    ADD CONSTRAINT "maintenance_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."maintenance_tasks"
    ADD CONSTRAINT "maintenance_tasks_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."maintenance_tasks"
    ADD CONSTRAINT "maintenance_tasks_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."ota_attribution_decisions"
    ADD CONSTRAINT "ota_attribution_decisions_allocated_listing_id_fkey" FOREIGN KEY ("allocated_listing_id") REFERENCES "public"."listings"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."ota_attribution_decisions"
    ADD CONSTRAINT "ota_attribution_decisions_ota_transaction_id_fkey" FOREIGN KEY ("ota_transaction_id") REFERENCES "public"."ota_transactions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."ota_transactions"
    ADD CONSTRAINT "ota_transactions_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."ota_import_batches"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."ota_transactions"
    ADD CONSTRAINT "ota_transactions_matched_reservation_id_fkey" FOREIGN KEY ("matched_reservation_id") REFERENCES "public"."reservations"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."ota_transactions"
    ADD CONSTRAINT "ota_transactions_resolved_listing_id_fkey" FOREIGN KEY ("resolved_listing_id") REFERENCES "public"."listings"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."owner_notification_prefs"
    ADD CONSTRAINT "owner_notification_prefs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."property_owners"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."property_amenities"
    ADD CONSTRAINT "property_amenities_amenity_id_fkey" FOREIGN KEY ("amenity_id") REFERENCES "public"."amenities"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."property_amenities"
    ADD CONSTRAINT "property_amenities_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."property_appliances"
    ADD CONSTRAINT "property_appliances_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."property_beds"
    ADD CONSTRAINT "property_beds_bed_type_id_fkey" FOREIGN KEY ("bed_type_id") REFERENCES "public"."bed_types"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."property_beds"
    ADD CONSTRAINT "property_beds_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."property_booking_sources"
    ADD CONSTRAINT "property_booking_sources_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."property_booking_sources"
    ADD CONSTRAINT "property_booking_sources_report_period_id_fkey" FOREIGN KEY ("report_period_id") REFERENCES "public"."report_periods"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."property_briefs"
    ADD CONSTRAINT "property_briefs_consumed_by_clean_task_id_fkey" FOREIGN KEY ("consumed_by_clean_task_id") REFERENCES "public"."clean_tasks"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."property_briefs"
    ADD CONSTRAINT "property_briefs_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."property_clean_rates"
    ADD CONSTRAINT "property_clean_rates_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."property_contacts"
    ADD CONSTRAINT "property_contacts_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."property_cost_benchmarks"
    ADD CONSTRAINT "property_cost_benchmarks_cost_line_type_id_fkey" FOREIGN KEY ("cost_line_type_id") REFERENCES "public"."cost_line_types"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."property_cost_benchmarks"
    ADD CONSTRAINT "property_cost_benchmarks_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."property_costs"
    ADD CONSTRAINT "property_costs_cost_line_type_id_fkey" FOREIGN KEY ("cost_line_type_id") REFERENCES "public"."cost_line_types"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."property_costs"
    ADD CONSTRAINT "property_costs_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."property_costs"
    ADD CONSTRAINT "property_costs_report_period_id_fkey" FOREIGN KEY ("report_period_id") REFERENCES "public"."report_periods"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."property_documents"
    ADD CONSTRAINT "property_documents_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."property_equipment"
    ADD CONSTRAINT "property_equipment_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."property_knowledge"
    ADD CONSTRAINT "property_knowledge_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."property_known_issues"
    ADD CONSTRAINT "property_known_issues_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."property_maintenance_log"
    ADD CONSTRAINT "property_maintenance_log_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."property_owners"
    ADD CONSTRAINT "property_owners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."property_targets"
    ADD CONSTRAINT "property_targets_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."report_periods"
    ADD CONSTRAINT "report_periods_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."property_owners"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."upload_batches"
    ADD CONSTRAINT "upload_batches_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."user_area_permissions"
    ADD CONSTRAINT "user_area_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."utility_expense_allocations"
    ADD CONSTRAINT "utility_expense_allocations_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."utility_expense_allocations"
    ADD CONSTRAINT "utility_expense_allocations_utility_expense_id_fkey" FOREIGN KEY ("utility_expense_id") REFERENCES "public"."utility_expenses"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."utility_expenses"
    ADD CONSTRAINT "utility_expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

CREATE POLICY "Admin can read automation_logs" ON "public"."automation_logs" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));

CREATE POLICY "Admin can read clean_tasks" ON "public"."clean_tasks" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));

CREATE POLICY "Admin can read cleaner_holidays" ON "public"."cleaner_holidays" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));

CREATE POLICY "Admin can read cleaners" ON "public"."cleaners" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));

CREATE POLICY "Admin can read sync_logs" ON "public"."sync_logs" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));

CREATE POLICY "Admin can update maintenance" ON "public"."clean_issues" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));

CREATE POLICY "Authenticated read bed_types" ON "public"."bed_types" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Authenticated read cleaner_members" ON "public"."cleaner_members" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Authenticated read consumables" ON "public"."consumables" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Authenticated read property_beds" ON "public"."property_beds" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Authenticated read property_equipment" ON "public"."property_equipment" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Authenticated read requests" ON "public"."requests" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Cleaner manage own checklist" ON "public"."clean_checklist_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."clean_tasks" "ct"
     JOIN "public"."cleaners" "c" ON (("c"."id" = "ct"."assigned_cleaner_id")))
  WHERE (("ct"."id" = "clean_checklist_items"."clean_task_id") AND ("c"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."clean_tasks" "ct"
     JOIN "public"."cleaners" "c" ON (("c"."id" = "ct"."assigned_cleaner_id")))
  WHERE (("ct"."id" = "clean_checklist_items"."clean_task_id") AND ("c"."user_id" = "auth"."uid"())))));

CREATE POLICY "Cleaners can create issues" ON "public"."clean_issues" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "clean_issues"."reported_by_cleaner_id") AND ("c"."user_id" = "auth"."uid"())))));

CREATE POLICY "Cleaners can read own cleaner record" ON "public"."cleaners" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

CREATE POLICY "Cleaners can read own holidays" ON "public"."cleaner_holidays" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "cleaner_holidays"."cleaner_id") AND ("c"."user_id" = "auth"."uid"())))));

CREATE POLICY "Cleaners can read own tasks" ON "public"."clean_tasks" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "clean_tasks"."assigned_cleaner_id") AND ("c"."user_id" = "auth"."uid"())))));

CREATE POLICY "Cleaners can read task listings" ON "public"."listings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."clean_tasks" "ct"
     JOIN "public"."cleaners" "c" ON (("c"."id" = "ct"."assigned_cleaner_id")))
  WHERE (("ct"."listing_id" = "listings"."id") AND ("c"."user_id" = "auth"."uid"())))));

CREATE POLICY "Cleaners can update listing clean status" ON "public"."listings" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."clean_tasks" "ct"
     JOIN "public"."cleaners" "c" ON (("c"."id" = "ct"."assigned_cleaner_id")))
  WHERE (("ct"."listing_id" = "listings"."id") AND ("c"."user_id" = "auth"."uid"())))));

CREATE POLICY "Cleaners can update own tasks" ON "public"."clean_tasks" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "clean_tasks"."assigned_cleaner_id") AND ("c"."user_id" = "auth"."uid"())))));

CREATE POLICY "Cleaners can view own issues" ON "public"."clean_issues" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "clean_issues"."reported_by_cleaner_id") AND ("c"."user_id" = "auth"."uid"())))));

CREATE POLICY "Cleaners insert own consumables" ON "public"."expense_consumables" FOR INSERT TO "authenticated" WITH CHECK (("purchased_by_user_id" = "auth"."uid"()));

CREATE POLICY "Cleaners read active amenities" ON "public"."amenities" FOR SELECT TO "authenticated" USING ((("is_active" = true) AND (EXISTS ( SELECT 1
   FROM "public"."property_amenities" "pa"
  WHERE (("pa"."amenity_id" = "amenities"."id") AND "public"."cleaner_assigned_to_listing"("auth"."uid"(), "pa"."listing_id"))))));

CREATE POLICY "Cleaners read appliances for assigned listings" ON "public"."property_appliances" FOR SELECT TO "authenticated" USING ("public"."cleaner_assigned_to_listing"("auth"."uid"(), "listing_id"));

CREATE POLICY "Cleaners read assigned property_amenities" ON "public"."property_amenities" FOR SELECT TO "authenticated" USING ("public"."cleaner_assigned_to_listing"("auth"."uid"(), "listing_id"));

CREATE POLICY "Cleaners read listing booking_requests" ON "public"."booking_requests" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."reservations" "rv"
     JOIN "public"."clean_tasks" "ct" ON (("ct"."listing_id" = "rv"."listing_id")))
     JOIN "public"."cleaners" "c" ON (("c"."id" = "ct"."assigned_cleaner_id")))
  WHERE (("rv"."id" = "booking_requests"."reservation_id") AND ("c"."user_id" = "auth"."uid"())))));

CREATE POLICY "Cleaners read own consumables" ON "public"."expense_consumables" FOR SELECT TO "authenticated" USING (("purchased_by_user_id" = "auth"."uid"()));

CREATE POLICY "Cleaners read own working exceptions" ON "public"."cleaner_working_exceptions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."cleaners" "c"
  WHERE (("c"."id" = "cleaner_working_exceptions"."cleaner_id") AND ("c"."user_id" = "auth"."uid"())))));

CREATE POLICY "Clients can read own listings" ON "public"."listings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."property_owners"
  WHERE (("property_owners"."id" = "listings"."owner_id") AND ("property_owners"."user_id" = "auth"."uid"())))));

CREATE POLICY "Clients can read own owner record" ON "public"."property_owners" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

CREATE POLICY "Clients can read own reservations" ON "public"."reservations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."listings"
     JOIN "public"."property_owners" ON (("property_owners"."id" = "listings"."owner_id")))
  WHERE (("listings"."id" = "reservations"."listing_id") AND ("property_owners"."user_id" = "auth"."uid"())))));

CREATE POLICY "Owner manages own prefs" ON "public"."owner_notification_prefs" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."property_owners" "po"
  WHERE (("po"."id" = "owner_notification_prefs"."owner_id") AND ("po"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."property_owners" "po"
  WHERE (("po"."id" = "owner_notification_prefs"."owner_id") AND ("po"."user_id" = "auth"."uid"())))));

CREATE POLICY "Owners read active amenities" ON "public"."amenities" FOR SELECT TO "authenticated" USING ((("is_active" = true) AND (EXISTS ( SELECT 1
   FROM "public"."property_amenities" "pa"
  WHERE (("pa"."amenity_id" = "amenities"."id") AND "public"."owner_owns_listing"("auth"."uid"(), "pa"."listing_id"))))));

CREATE POLICY "Owners read appliances for own listings" ON "public"."property_appliances" FOR SELECT TO "authenticated" USING ("public"."owner_owns_listing"("auth"."uid"(), "listing_id"));

CREATE POLICY "Owners read consumable_charges" ON "public"."consumable_charges" FOR SELECT TO "authenticated" USING ("public"."owner_owns_listing"("auth"."uid"(), "listing_id"));

CREATE POLICY "Owners read documents for own listings" ON "public"."property_documents" FOR SELECT TO "authenticated" USING ("public"."owner_owns_listing"("auth"."uid"(), "listing_id"));

CREATE POLICY "Owners read laundry_charges" ON "public"."laundry_charges" FOR SELECT TO "authenticated" USING ("public"."owner_owns_listing"("auth"."uid"(), "listing_id"));

CREATE POLICY "Owners read own property_amenities" ON "public"."property_amenities" FOR SELECT TO "authenticated" USING ("public"."owner_owns_listing"("auth"."uid"(), "listing_id"));

CREATE POLICY "Owners read utility_allocations" ON "public"."utility_expense_allocations" FOR SELECT TO "authenticated" USING ("public"."owner_owns_listing"("auth"."uid"(), "listing_id"));

CREATE POLICY "Public read active amenities" ON "public"."amenities" FOR SELECT TO "anon" USING (("is_active" = true));

CREATE POLICY "Public read listings by slug" ON "public"."listings" FOR SELECT TO "anon" USING (("slug" IS NOT NULL));

CREATE POLICY "Public read property_amenities" ON "public"."property_amenities" FOR SELECT TO "anon" USING (true);

CREATE POLICY "Staff can insert clean_state_resets" ON "public"."clean_state_resets" FOR INSERT TO "authenticated" WITH CHECK ((("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")) AND ("reset_by" = "auth"."uid"())));

CREATE POLICY "Staff can read clean_state_resets" ON "public"."clean_state_resets" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff can read property_knowledge" ON "public"."property_knowledge" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff can view all issues" ON "public"."clean_issues" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff manage amenities" ON "public"."amenities" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff manage appliances" ON "public"."property_appliances" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff manage booking_requests" ON "public"."booking_requests" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff manage checklist" ON "public"."clean_checklist_items" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff manage consumable_charges" ON "public"."consumable_charges" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff manage consumable_rates" ON "public"."consumable_rates" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff manage consumables" ON "public"."expense_consumables" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff manage contacts" ON "public"."property_contacts" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff manage documents" ON "public"."property_documents" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff manage known_issues" ON "public"."property_known_issues" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff manage laundry_allocations" ON "public"."expense_laundry_allocations" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Staff manage laundry_bills" ON "public"."expense_laundry_bills" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Staff manage laundry_charges" ON "public"."laundry_charges" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff manage laundry_rate_regions" ON "public"."laundry_rate_regions" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff manage laundry_rates" ON "public"."laundry_rates" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff manage maintenance_log" ON "public"."property_maintenance_log" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff manage maintenance_tasks" ON "public"."maintenance_tasks" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff manage owner prefs" ON "public"."owner_notification_prefs" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff manage property_amenities" ON "public"."property_amenities" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff manage property_beds" ON "public"."property_beds" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff manage seasons" ON "public"."seasons" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff manage utility_allocations" ON "public"."utility_expense_allocations" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff manage utility_expenses" ON "public"."utility_expenses" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff read communal_groups" ON "public"."communal_groups" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff read location_groups" ON "public"."location_groups" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Staff read working exceptions" ON "public"."cleaner_working_exceptions" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super can delete issues" ON "public"."clean_issues" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role"));

CREATE POLICY "Super can delete listings" ON "public"."listings" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role"));

CREATE POLICY "Super can delete owners" ON "public"."property_owners" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role"));

CREATE POLICY "Super can delete property_knowledge" ON "public"."property_knowledge" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role"));

CREATE POLICY "Super can manage settings" ON "public"."app_settings" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role"));

CREATE POLICY "Super users can delete roles" ON "public"."user_roles" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role"));

CREATE POLICY "Super users can insert roles" ON "public"."user_roles" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role"));

CREATE POLICY "Super users can read all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role"));

CREATE POLICY "Super users can read all roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role"));

CREATE POLICY "Super/Senior can insert listings" ON "public"."listings" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior can insert owners" ON "public"."property_owners" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior can insert property_knowledge" ON "public"."property_knowledge" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior can insert reservations" ON "public"."reservations" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior can manage automation_logs" ON "public"."automation_logs" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior can manage clean_tasks" ON "public"."clean_tasks" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior can manage cleaners" ON "public"."cleaners" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior can manage issues" ON "public"."clean_issues" FOR UPDATE TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior can manage orin_briefs" ON "public"."orin_briefs" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior can manage sync_logs" ON "public"."sync_logs" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior can manage upload_batches" ON "public"."upload_batches" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior can read all conversations" ON "public"."orin_conversations" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior can update listings" ON "public"."listings" FOR UPDATE TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior can update owners" ON "public"."property_owners" FOR UPDATE TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior can update reservations" ON "public"."reservations" FOR UPDATE TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior manage bed_types" ON "public"."bed_types" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior manage cleaner_holidays" ON "public"."cleaner_holidays" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior manage cleaner_members" ON "public"."cleaner_members" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior manage communal_groups" ON "public"."communal_groups" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior manage consumables" ON "public"."consumables" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior manage location_groups" ON "public"."location_groups" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior manage property_equipment" ON "public"."property_equipment" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior manage requests" ON "public"."requests" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior manage working exceptions" ON "public"."cleaner_working_exceptions" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "Super/Senior/Admin can read all listings" ON "public"."listings" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Super/Senior/Admin can read all owners" ON "public"."property_owners" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Super/Senior/Admin can read all reservations" ON "public"."reservations" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Super/Senior/Admin can read orin_briefs" ON "public"."orin_briefs" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Super/Senior/Admin can update property_knowledge" ON "public"."property_knowledge" FOR UPDATE TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "Users can delete own messages" ON "public"."orin_conversations" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));

CREATE POLICY "Users can insert own messages" ON "public"."orin_conversations" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));

CREATE POLICY "Users can read own conversations" ON "public"."orin_conversations" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

CREATE POLICY "Users can read own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));

CREATE POLICY "Users can read own roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));

ALTER TABLE "public"."amenities" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."automation_logs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."bank_statement_imports" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_statement_imports_staff_all" ON "public"."bank_statement_imports" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

ALTER TABLE "public"."bank_statement_txns" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_statement_txns_staff_all" ON "public"."bank_statement_txns" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

ALTER TABLE "public"."bed_types" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."bill_allocations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bill_allocations_owner_read" ON "public"."bill_allocations" FOR SELECT TO "authenticated" USING ("public"."owner_owns_listing"("auth"."uid"(), "listing_id"));

CREATE POLICY "bill_allocations_staff_all" ON "public"."bill_allocations" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

ALTER TABLE "public"."bill_payee_rules" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bill_payee_rules_staff_all" ON "public"."bill_payee_rules" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

ALTER TABLE "public"."bills_on_behalf" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bills_on_behalf_owner_read" ON "public"."bills_on_behalf" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."bill_allocations" "ba"
  WHERE (("ba"."bill_id" = "bills_on_behalf"."id") AND "public"."owner_owns_listing"("auth"."uid"(), "ba"."listing_id")))));

CREATE POLICY "bills_on_behalf_staff_all" ON "public"."bills_on_behalf" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

ALTER TABLE "public"."booking_requests" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ccp_cleaner_delete" ON "public"."clean_checklist_photos" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."clean_checklist_items" "i"
     JOIN "public"."clean_tasks" "ct" ON (("ct"."id" = "i"."clean_task_id")))
     JOIN "public"."cleaners" "c" ON (("c"."id" = "ct"."assigned_cleaner_id")))
  WHERE (("i"."id" = "clean_checklist_photos"."checklist_item_id") AND ("c"."user_id" = "auth"."uid"()) AND ("ct"."status" <> ALL (ARRAY['completed'::"text", 'done'::"text"]))))));

CREATE POLICY "ccp_cleaner_insert" ON "public"."clean_checklist_photos" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."clean_checklist_items" "i"
     JOIN "public"."clean_tasks" "ct" ON (("ct"."id" = "i"."clean_task_id")))
     JOIN "public"."cleaners" "c" ON (("c"."id" = "ct"."assigned_cleaner_id")))
  WHERE (("i"."id" = "clean_checklist_photos"."checklist_item_id") AND ("c"."user_id" = "auth"."uid"())))));

CREATE POLICY "ccp_cleaner_select" ON "public"."clean_checklist_photos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."clean_checklist_items" "i"
     JOIN "public"."clean_tasks" "ct" ON (("ct"."id" = "i"."clean_task_id")))
     JOIN "public"."cleaners" "c" ON (("c"."id" = "ct"."assigned_cleaner_id")))
  WHERE (("i"."id" = "clean_checklist_photos"."checklist_item_id") AND ("c"."user_id" = "auth"."uid"())))));

CREATE POLICY "ccp_cleaner_update" ON "public"."clean_checklist_photos" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."clean_checklist_items" "i"
     JOIN "public"."clean_tasks" "ct" ON (("ct"."id" = "i"."clean_task_id")))
     JOIN "public"."cleaners" "c" ON (("c"."id" = "ct"."assigned_cleaner_id")))
  WHERE (("i"."id" = "clean_checklist_photos"."checklist_item_id") AND ("c"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."clean_checklist_items" "i"
     JOIN "public"."clean_tasks" "ct" ON (("ct"."id" = "i"."clean_task_id")))
     JOIN "public"."cleaners" "c" ON (("c"."id" = "ct"."assigned_cleaner_id")))
  WHERE (("i"."id" = "clean_checklist_photos"."checklist_item_id") AND ("c"."user_id" = "auth"."uid"())))));

CREATE POLICY "ccp_staff_all" ON "public"."clean_checklist_photos" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

ALTER TABLE "public"."clean_checklist_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."clean_checklist_photos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."clean_issues" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."clean_state_resets" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."clean_tasks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."cleaner_holidays" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."cleaner_members" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."cleaner_property_rates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."cleaner_working_exceptions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."cleaners" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."communal_groups" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."consumable_charges" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."consumable_rates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."consumables" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."cost_line_types" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cost_line_types_read" ON "public"."cost_line_types" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "cost_line_types_staff_all" ON "public"."cost_line_types" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "cpr_staff" ON "public"."cleaner_property_rates" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

ALTER TABLE "public"."expense_consumables" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."expense_laundry_allocations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."expense_laundry_bills" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."laundry_charges" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."laundry_rate_regions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."laundry_rates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."line_adjustments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "line_adjustments_staff_all" ON "public"."line_adjustments" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

ALTER TABLE "public"."listing_aliases" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listing_aliases_staff_all" ON "public"."listing_aliases" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

ALTER TABLE "public"."listings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."location_groups" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."maintenance_tasks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."notification_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."orin_briefs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."orin_conversations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."ota_attribution_decisions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ota_attribution_decisions_staff_all" ON "public"."ota_attribution_decisions" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

ALTER TABLE "public"."ota_import_batches" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ota_import_batches_staff_all" ON "public"."ota_import_batches" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

ALTER TABLE "public"."ota_transactions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ota_transactions_staff_all" ON "public"."ota_transactions" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

ALTER TABLE "public"."owner_notification_prefs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pb_admin_select" ON "public"."property_briefs" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));

CREATE POLICY "pb_cleaner_select" ON "public"."property_briefs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."clean_tasks" "ct"
     JOIN "public"."cleaners" "c" ON (("c"."id" = "ct"."assigned_cleaner_id")))
  WHERE (("ct"."listing_id" = "property_briefs"."listing_id") AND ("c"."user_id" = "auth"."uid"()) AND ("ct"."status" <> ALL (ARRAY['cancelled'::"text", 'canceled'::"text", 'completed'::"text", 'done'::"text"]))))));

CREATE POLICY "pb_supersenior_all" ON "public"."property_briefs" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

CREATE POLICY "pcr_staff" ON "public"."property_clean_rates" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")));

ALTER TABLE "public"."phantom_trace" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."property_amenities" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."property_appliances" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."property_beds" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."property_booking_sources" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_booking_sources_staff_all" ON "public"."property_booking_sources" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

ALTER TABLE "public"."property_briefs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."property_clean_rates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."property_contacts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."property_cost_benchmarks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_cost_benchmarks_staff_all" ON "public"."property_cost_benchmarks" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

ALTER TABLE "public"."property_costs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_costs_staff_all" ON "public"."property_costs" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

ALTER TABLE "public"."property_documents" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."property_equipment" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."property_knowledge" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."property_known_issues" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."property_maintenance_log" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."property_owners" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."property_targets" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_targets_staff_all" ON "public"."property_targets" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

CREATE POLICY "push_subs_delete" ON "public"."push_subscriptions" FOR DELETE USING (("owner_id" = "auth"."uid"()));

CREATE POLICY "push_subs_insert" ON "public"."push_subscriptions" FOR INSERT WITH CHECK (("owner_id" = "auth"."uid"()));

CREATE POLICY "push_subs_select" ON "public"."push_subscriptions" FOR SELECT USING (("owner_id" = "auth"."uid"()));

CREATE POLICY "push_subs_update" ON "public"."push_subscriptions" FOR UPDATE USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));

ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read area perms" ON "public"."user_area_permissions" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['super'::"public"."app_role", 'senior'::"public"."app_role"])))))));

ALTER TABLE "public"."report_periods" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_periods_staff_all" ON "public"."report_periods" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))) WITH CHECK (("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));

ALTER TABLE "public"."requests" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."reservations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."seasons" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super manage area perms" ON "public"."user_area_permissions" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'super'::"public"."app_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'super'::"public"."app_role")))));

ALTER TABLE "public"."sync_logs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."upload_batches" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."user_area_permissions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."utility_expense_allocations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."utility_expenses" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cleaners upload issue photos" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'clean-issue-photos'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));

CREATE POLICY "Cleaners view own issue photos" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'clean-issue-photos'::"text") AND ((("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1]) OR "public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))));

CREATE POLICY "Read brief photos" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'clean-issue-photos'::"text") AND (("storage"."foldername"("name"))[1] = 'briefs'::"text") AND ("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR (EXISTS ( SELECT 1
   FROM ("public"."clean_tasks" "ct"
     JOIN "public"."cleaners" "c" ON (("c"."id" = "ct"."assigned_cleaner_id")))
  WHERE ((("ct"."listing_id")::"text" = ("storage"."foldername"("c"."name"))[2]) AND ("c"."user_id" = "auth"."uid"()) AND ("ct"."status" <> ALL (ARRAY['cancelled'::"text", 'canceled'::"text", 'completed'::"text", 'done'::"text"]))))))));

CREATE POLICY "Receipts: read own" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'expense-receipts'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));

CREATE POLICY "Receipts: staff manage" ON "storage"."objects" TO "authenticated" USING ((("bucket_id" = 'expense-receipts'::"text") AND ("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role")))) WITH CHECK ((("bucket_id" = 'expense-receipts'::"text") AND ("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role"))));

CREATE POLICY "Receipts: staff read all" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'expense-receipts'::"text") AND ("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"))));

CREATE POLICY "Receipts: upload own folder" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'expense-receipts'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));

CREATE POLICY "Staff manage issue photos" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'clean-issue-photos'::"text") AND ("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role"))));

CREATE POLICY "Staff upload brief photos" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'clean-issue-photos'::"text") AND (("storage"."foldername"("name"))[1] = 'briefs'::"text") AND ("public"."has_role"("auth"."uid"(), 'super'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'senior'::"public"."app_role"))));

CREATE POLICY "clean-photos insert" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK (("bucket_id" = 'clean-photos'::"text"));

CREATE POLICY "clean-photos read" ON "storage"."objects" FOR SELECT TO "authenticated" USING (("bucket_id" = 'clean-photos'::"text"));

CREATE POLICY "clean-photos update" ON "storage"."objects" FOR UPDATE TO "authenticated" USING (("bucket_id" = 'clean-photos'::"text")) WITH CHECK (("bucket_id" = 'clean-photos'::"text"));

REVOKE ALL ON FUNCTION "public"."acknowledge_brief"("p_brief_id" "uuid", "p_clean_task_id" "uuid", "p_member" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."acknowledge_brief"("p_brief_id" "uuid", "p_clean_task_id" "uuid", "p_member" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."acknowledge_brief"("p_brief_id" "uuid", "p_clean_task_id" "uuid", "p_member" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."acknowledge_brief"("p_brief_id" "uuid", "p_clean_task_id" "uuid", "p_member" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."auto_create_clean_from_reservation"() FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."auto_create_clean_from_reservation"() TO "service_role";

GRANT ALL ON FUNCTION "public"."calc_property_knowledge_completion"() TO "anon";

GRANT ALL ON FUNCTION "public"."calc_property_knowledge_completion"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."calc_property_knowledge_completion"() TO "service_role";

GRANT ALL ON FUNCTION "public"."cancel_clean_on_reservation_cancel"() TO "anon";

GRANT ALL ON FUNCTION "public"."cancel_clean_on_reservation_cancel"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."cancel_clean_on_reservation_cancel"() TO "service_role";

GRANT ALL ON FUNCTION "public"."cleaner_assigned_to_listing"("_user_id" "uuid", "_listing_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."cleaner_assigned_to_listing"("_user_id" "uuid", "_listing_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."cleaner_assigned_to_listing"("_user_id" "uuid", "_listing_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."cleanup_phantom_instrumentation"() TO "anon";

GRANT ALL ON FUNCTION "public"."cleanup_phantom_instrumentation"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."cleanup_phantom_instrumentation"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."communal_group_ratio_sum"("p_group_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."communal_group_ratio_sum"("p_group_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."communal_group_ratio_sum"("p_group_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."complete_offline_cleans_eod"() TO "anon";

GRANT ALL ON FUNCTION "public"."complete_offline_cleans_eod"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."complete_offline_cleans_eod"() TO "service_role";

GRANT ALL ON FUNCTION "public"."edge_auth_header"() TO "anon";

GRANT ALL ON FUNCTION "public"."edge_auth_header"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."edge_auth_header"() TO "service_role";

GRANT ALL ON FUNCTION "public"."generate_turnover_charges"() TO "anon";

GRANT ALL ON FUNCTION "public"."generate_turnover_charges"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."generate_turnover_charges"() TO "service_role";

GRANT ALL ON FUNCTION "public"."guard_clean_task_insert"() TO "anon";

GRANT ALL ON FUNCTION "public"."guard_clean_task_insert"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."guard_clean_task_insert"() TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";

GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";

GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";

GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";

GRANT ALL ON FUNCTION "public"."manage_hostaway_cron"("interval_hours" integer, "supabase_url" "text", "anon_key" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."manage_hostaway_cron"("interval_hours" integer, "supabase_url" "text", "anon_key" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."manage_hostaway_cron"("interval_hours" integer, "supabase_url" "text", "anon_key" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."my_earnings"("p_month" "date") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."my_earnings"("p_month" "date") TO "anon";

GRANT ALL ON FUNCTION "public"."my_earnings"("p_month" "date") TO "authenticated";

GRANT ALL ON FUNCTION "public"."my_earnings"("p_month" "date") TO "service_role";

GRANT ALL ON FUNCTION "public"."notify_cleaner_on_assignment"() TO "anon";

GRANT ALL ON FUNCTION "public"."notify_cleaner_on_assignment"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."notify_cleaner_on_assignment"() TO "service_role";

GRANT ALL ON FUNCTION "public"."notify_new_booking"() TO "anon";

GRANT ALL ON FUNCTION "public"."notify_new_booking"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."notify_new_booking"() TO "service_role";

GRANT ALL ON FUNCTION "public"."owner_owns_listing"("_user_id" "uuid", "_listing_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."owner_owns_listing"("_user_id" "uuid", "_listing_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."owner_owns_listing"("_user_id" "uuid", "_listing_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."propagate_clean_duration"() TO "anon";

GRANT ALL ON FUNCTION "public"."propagate_clean_duration"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."propagate_clean_duration"() TO "service_role";

GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";

GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";

GRANT ALL ON FUNCTION "public"."tg_bill_rules_touch_updated_at"() TO "anon";

GRANT ALL ON FUNCTION "public"."tg_bill_rules_touch_updated_at"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."tg_bill_rules_touch_updated_at"() TO "service_role";

GRANT ALL ON FUNCTION "public"."tg_cleaner_delete_unassign"() TO "anon";

GRANT ALL ON FUNCTION "public"."tg_cleaner_delete_unassign"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."tg_cleaner_delete_unassign"() TO "service_role";

GRANT ALL ON FUNCTION "public"."tg_create_welcome_basket"() TO "anon";

GRANT ALL ON FUNCTION "public"."tg_create_welcome_basket"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."tg_create_welcome_basket"() TO "service_role";

GRANT ALL ON FUNCTION "public"."tg_notify_owner_booking"() TO "anon";

GRANT ALL ON FUNCTION "public"."tg_notify_owner_booking"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."tg_notify_owner_booking"() TO "service_role";

GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "anon";

GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."tg_set_updated_at"() TO "service_role";

GRANT ALL ON FUNCTION "public"."trigger_today_task_allocation"() TO "anon";

GRANT ALL ON FUNCTION "public"."trigger_today_task_allocation"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."trigger_today_task_allocation"() TO "service_role";

GRANT ALL ON FUNCTION "public"."update_clean_issues_updated_at"() TO "anon";

GRANT ALL ON FUNCTION "public"."update_clean_issues_updated_at"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."update_clean_issues_updated_at"() TO "service_role";

GRANT ALL ON FUNCTION "public"."verify_no_future_dated_cleans"() TO "anon";

GRANT ALL ON FUNCTION "public"."verify_no_future_dated_cleans"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."verify_no_future_dated_cleans"() TO "service_role";

GRANT ALL ON TABLE "public"."amenities" TO "anon";

GRANT ALL ON TABLE "public"."amenities" TO "authenticated";

GRANT ALL ON TABLE "public"."amenities" TO "service_role";

GRANT ALL ON TABLE "public"."app_settings" TO "anon";

GRANT ALL ON TABLE "public"."app_settings" TO "authenticated";

GRANT ALL ON TABLE "public"."app_settings" TO "service_role";

GRANT ALL ON TABLE "public"."automation_logs" TO "anon";

GRANT ALL ON TABLE "public"."automation_logs" TO "authenticated";

GRANT ALL ON TABLE "public"."automation_logs" TO "service_role";

GRANT ALL ON TABLE "public"."bank_statement_imports" TO "anon";

GRANT ALL ON TABLE "public"."bank_statement_imports" TO "authenticated";

GRANT ALL ON TABLE "public"."bank_statement_imports" TO "service_role";

GRANT ALL ON TABLE "public"."bank_statement_txns" TO "anon";

GRANT ALL ON TABLE "public"."bank_statement_txns" TO "authenticated";

GRANT ALL ON TABLE "public"."bank_statement_txns" TO "service_role";

GRANT ALL ON TABLE "public"."bed_types" TO "anon";

GRANT ALL ON TABLE "public"."bed_types" TO "authenticated";

GRANT ALL ON TABLE "public"."bed_types" TO "service_role";

GRANT ALL ON TABLE "public"."bill_allocations" TO "anon";

GRANT ALL ON TABLE "public"."bill_allocations" TO "authenticated";

GRANT ALL ON TABLE "public"."bill_allocations" TO "service_role";

GRANT ALL ON TABLE "public"."bill_payee_rules" TO "anon";

GRANT ALL ON TABLE "public"."bill_payee_rules" TO "authenticated";

GRANT ALL ON TABLE "public"."bill_payee_rules" TO "service_role";

GRANT ALL ON TABLE "public"."bills_on_behalf" TO "anon";

GRANT ALL ON TABLE "public"."bills_on_behalf" TO "authenticated";

GRANT ALL ON TABLE "public"."bills_on_behalf" TO "service_role";

GRANT ALL ON TABLE "public"."booking_requests" TO "anon";

GRANT ALL ON TABLE "public"."booking_requests" TO "authenticated";

GRANT ALL ON TABLE "public"."booking_requests" TO "service_role";

GRANT ALL ON TABLE "public"."clean_checklist_items" TO "anon";

GRANT ALL ON TABLE "public"."clean_checklist_items" TO "authenticated";

GRANT ALL ON TABLE "public"."clean_checklist_items" TO "service_role";

GRANT ALL ON TABLE "public"."clean_checklist_photos" TO "anon";

GRANT ALL ON TABLE "public"."clean_checklist_photos" TO "authenticated";

GRANT ALL ON TABLE "public"."clean_checklist_photos" TO "service_role";

GRANT ALL ON TABLE "public"."clean_issues" TO "anon";

GRANT ALL ON TABLE "public"."clean_issues" TO "authenticated";

GRANT ALL ON TABLE "public"."clean_issues" TO "service_role";

GRANT ALL ON TABLE "public"."clean_state_resets" TO "anon";

GRANT ALL ON TABLE "public"."clean_state_resets" TO "authenticated";

GRANT ALL ON TABLE "public"."clean_state_resets" TO "service_role";

GRANT ALL ON TABLE "public"."clean_tasks" TO "anon";

GRANT ALL ON TABLE "public"."clean_tasks" TO "authenticated";

GRANT ALL ON TABLE "public"."clean_tasks" TO "service_role";

GRANT ALL ON TABLE "public"."cleaner_holidays" TO "anon";

GRANT ALL ON TABLE "public"."cleaner_holidays" TO "authenticated";

GRANT ALL ON TABLE "public"."cleaner_holidays" TO "service_role";

GRANT ALL ON TABLE "public"."cleaner_members" TO "anon";

GRANT ALL ON TABLE "public"."cleaner_members" TO "authenticated";

GRANT ALL ON TABLE "public"."cleaner_members" TO "service_role";

GRANT ALL ON TABLE "public"."cleaner_property_rates" TO "anon";

GRANT ALL ON TABLE "public"."cleaner_property_rates" TO "authenticated";

GRANT ALL ON TABLE "public"."cleaner_property_rates" TO "service_role";

GRANT ALL ON TABLE "public"."cleaner_working_exceptions" TO "anon";

GRANT ALL ON TABLE "public"."cleaner_working_exceptions" TO "authenticated";

GRANT ALL ON TABLE "public"."cleaner_working_exceptions" TO "service_role";

GRANT ALL ON TABLE "public"."cleaners" TO "anon";

GRANT ALL ON TABLE "public"."cleaners" TO "authenticated";

GRANT ALL ON TABLE "public"."cleaners" TO "service_role";

GRANT ALL ON TABLE "public"."communal_groups" TO "anon";

GRANT ALL ON TABLE "public"."communal_groups" TO "authenticated";

GRANT ALL ON TABLE "public"."communal_groups" TO "service_role";

GRANT ALL ON TABLE "public"."consumable_charges" TO "anon";

GRANT ALL ON TABLE "public"."consumable_charges" TO "authenticated";

GRANT ALL ON TABLE "public"."consumable_charges" TO "service_role";

GRANT ALL ON TABLE "public"."consumable_rates" TO "anon";

GRANT ALL ON TABLE "public"."consumable_rates" TO "authenticated";

GRANT ALL ON TABLE "public"."consumable_rates" TO "service_role";

GRANT ALL ON TABLE "public"."consumables" TO "anon";

GRANT ALL ON TABLE "public"."consumables" TO "authenticated";

GRANT ALL ON TABLE "public"."consumables" TO "service_role";

GRANT ALL ON TABLE "public"."cost_line_types" TO "anon";

GRANT ALL ON TABLE "public"."cost_line_types" TO "authenticated";

GRANT ALL ON TABLE "public"."cost_line_types" TO "service_role";

GRANT ALL ON TABLE "public"."expense_consumables" TO "anon";

GRANT ALL ON TABLE "public"."expense_consumables" TO "authenticated";

GRANT ALL ON TABLE "public"."expense_consumables" TO "service_role";

GRANT ALL ON TABLE "public"."expense_laundry_allocations" TO "anon";

GRANT ALL ON TABLE "public"."expense_laundry_allocations" TO "authenticated";

GRANT ALL ON TABLE "public"."expense_laundry_allocations" TO "service_role";

GRANT ALL ON TABLE "public"."expense_laundry_bills" TO "anon";

GRANT ALL ON TABLE "public"."expense_laundry_bills" TO "authenticated";

GRANT ALL ON TABLE "public"."expense_laundry_bills" TO "service_role";

GRANT ALL ON TABLE "public"."laundry_charges" TO "anon";

GRANT ALL ON TABLE "public"."laundry_charges" TO "authenticated";

GRANT ALL ON TABLE "public"."laundry_charges" TO "service_role";

GRANT ALL ON TABLE "public"."laundry_rate_regions" TO "anon";

GRANT ALL ON TABLE "public"."laundry_rate_regions" TO "authenticated";

GRANT ALL ON TABLE "public"."laundry_rate_regions" TO "service_role";

GRANT ALL ON TABLE "public"."laundry_rates" TO "anon";

GRANT ALL ON TABLE "public"."laundry_rates" TO "authenticated";

GRANT ALL ON TABLE "public"."laundry_rates" TO "service_role";

GRANT ALL ON TABLE "public"."line_adjustments" TO "anon";

GRANT ALL ON TABLE "public"."line_adjustments" TO "authenticated";

GRANT ALL ON TABLE "public"."line_adjustments" TO "service_role";

GRANT ALL ON TABLE "public"."listing_aliases" TO "anon";

GRANT ALL ON TABLE "public"."listing_aliases" TO "authenticated";

GRANT ALL ON TABLE "public"."listing_aliases" TO "service_role";

GRANT ALL ON TABLE "public"."listings" TO "anon";

GRANT ALL ON TABLE "public"."listings" TO "authenticated";

GRANT ALL ON TABLE "public"."listings" TO "service_role";

GRANT ALL ON TABLE "public"."location_groups" TO "anon";

GRANT ALL ON TABLE "public"."location_groups" TO "authenticated";

GRANT ALL ON TABLE "public"."location_groups" TO "service_role";

GRANT ALL ON TABLE "public"."maintenance_tasks" TO "anon";

GRANT ALL ON TABLE "public"."maintenance_tasks" TO "authenticated";

GRANT ALL ON TABLE "public"."maintenance_tasks" TO "service_role";

GRANT ALL ON TABLE "public"."notification_settings" TO "anon";

GRANT ALL ON TABLE "public"."notification_settings" TO "authenticated";

GRANT ALL ON TABLE "public"."notification_settings" TO "service_role";

GRANT ALL ON TABLE "public"."orin_briefs" TO "anon";

GRANT ALL ON TABLE "public"."orin_briefs" TO "authenticated";

GRANT ALL ON TABLE "public"."orin_briefs" TO "service_role";

GRANT ALL ON TABLE "public"."orin_conversations" TO "anon";

GRANT ALL ON TABLE "public"."orin_conversations" TO "authenticated";

GRANT ALL ON TABLE "public"."orin_conversations" TO "service_role";

GRANT ALL ON TABLE "public"."ota_attribution_decisions" TO "anon";

GRANT ALL ON TABLE "public"."ota_attribution_decisions" TO "authenticated";

GRANT ALL ON TABLE "public"."ota_attribution_decisions" TO "service_role";

GRANT ALL ON TABLE "public"."ota_import_batches" TO "anon";

GRANT ALL ON TABLE "public"."ota_import_batches" TO "authenticated";

GRANT ALL ON TABLE "public"."ota_import_batches" TO "service_role";

GRANT ALL ON TABLE "public"."ota_transactions" TO "anon";

GRANT ALL ON TABLE "public"."ota_transactions" TO "authenticated";

GRANT ALL ON TABLE "public"."ota_transactions" TO "service_role";

GRANT ALL ON TABLE "public"."owner_notification_prefs" TO "anon";

GRANT ALL ON TABLE "public"."owner_notification_prefs" TO "authenticated";

GRANT ALL ON TABLE "public"."owner_notification_prefs" TO "service_role";

GRANT ALL ON TABLE "public"."phantom_trace" TO "anon";

GRANT ALL ON TABLE "public"."phantom_trace" TO "authenticated";

GRANT ALL ON TABLE "public"."phantom_trace" TO "service_role";

GRANT ALL ON SEQUENCE "public"."phantom_trace_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."phantom_trace_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."phantom_trace_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."profiles" TO "anon";

GRANT ALL ON TABLE "public"."profiles" TO "authenticated";

GRANT ALL ON TABLE "public"."profiles" TO "service_role";

GRANT ALL ON TABLE "public"."property_amenities" TO "anon";

GRANT ALL ON TABLE "public"."property_amenities" TO "authenticated";

GRANT ALL ON TABLE "public"."property_amenities" TO "service_role";

GRANT ALL ON TABLE "public"."property_appliances" TO "anon";

GRANT ALL ON TABLE "public"."property_appliances" TO "authenticated";

GRANT ALL ON TABLE "public"."property_appliances" TO "service_role";

GRANT ALL ON TABLE "public"."property_beds" TO "anon";

GRANT ALL ON TABLE "public"."property_beds" TO "authenticated";

GRANT ALL ON TABLE "public"."property_beds" TO "service_role";

GRANT ALL ON TABLE "public"."property_booking_sources" TO "anon";

GRANT ALL ON TABLE "public"."property_booking_sources" TO "authenticated";

GRANT ALL ON TABLE "public"."property_booking_sources" TO "service_role";

GRANT ALL ON TABLE "public"."property_briefs" TO "anon";

GRANT ALL ON TABLE "public"."property_briefs" TO "authenticated";

GRANT ALL ON TABLE "public"."property_briefs" TO "service_role";

GRANT ALL ON TABLE "public"."property_clean_rates" TO "anon";

GRANT ALL ON TABLE "public"."property_clean_rates" TO "authenticated";

GRANT ALL ON TABLE "public"."property_clean_rates" TO "service_role";

GRANT ALL ON TABLE "public"."property_contacts" TO "anon";

GRANT ALL ON TABLE "public"."property_contacts" TO "authenticated";

GRANT ALL ON TABLE "public"."property_contacts" TO "service_role";

GRANT ALL ON TABLE "public"."property_cost_benchmarks" TO "anon";

GRANT ALL ON TABLE "public"."property_cost_benchmarks" TO "authenticated";

GRANT ALL ON TABLE "public"."property_cost_benchmarks" TO "service_role";

GRANT ALL ON TABLE "public"."property_costs" TO "anon";

GRANT ALL ON TABLE "public"."property_costs" TO "authenticated";

GRANT ALL ON TABLE "public"."property_costs" TO "service_role";

GRANT ALL ON TABLE "public"."property_documents" TO "anon";

GRANT ALL ON TABLE "public"."property_documents" TO "authenticated";

GRANT ALL ON TABLE "public"."property_documents" TO "service_role";

GRANT ALL ON TABLE "public"."property_equipment" TO "anon";

GRANT ALL ON TABLE "public"."property_equipment" TO "authenticated";

GRANT ALL ON TABLE "public"."property_equipment" TO "service_role";

GRANT ALL ON TABLE "public"."property_knowledge" TO "anon";

GRANT ALL ON TABLE "public"."property_knowledge" TO "authenticated";

GRANT ALL ON TABLE "public"."property_knowledge" TO "service_role";

GRANT ALL ON TABLE "public"."property_knowledge_cleaner" TO "anon";

GRANT ALL ON TABLE "public"."property_knowledge_cleaner" TO "authenticated";

GRANT ALL ON TABLE "public"."property_knowledge_cleaner" TO "service_role";

GRANT ALL ON TABLE "public"."property_knowledge_owner" TO "anon";

GRANT ALL ON TABLE "public"."property_knowledge_owner" TO "authenticated";

GRANT ALL ON TABLE "public"."property_knowledge_owner" TO "service_role";

GRANT ALL ON TABLE "public"."property_known_issues" TO "anon";

GRANT ALL ON TABLE "public"."property_known_issues" TO "authenticated";

GRANT ALL ON TABLE "public"."property_known_issues" TO "service_role";

GRANT ALL ON TABLE "public"."property_maintenance_log" TO "anon";

GRANT ALL ON TABLE "public"."property_maintenance_log" TO "authenticated";

GRANT ALL ON TABLE "public"."property_maintenance_log" TO "service_role";

GRANT ALL ON TABLE "public"."property_owners" TO "anon";

GRANT ALL ON TABLE "public"."property_owners" TO "authenticated";

GRANT ALL ON TABLE "public"."property_owners" TO "service_role";

GRANT ALL ON TABLE "public"."property_targets" TO "anon";

GRANT ALL ON TABLE "public"."property_targets" TO "authenticated";

GRANT ALL ON TABLE "public"."property_targets" TO "service_role";

GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";

GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";

GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";

GRANT ALL ON TABLE "public"."report_periods" TO "anon";

GRANT ALL ON TABLE "public"."report_periods" TO "authenticated";

GRANT ALL ON TABLE "public"."report_periods" TO "service_role";

GRANT ALL ON TABLE "public"."requests" TO "anon";

GRANT ALL ON TABLE "public"."requests" TO "authenticated";

GRANT ALL ON TABLE "public"."requests" TO "service_role";

GRANT ALL ON TABLE "public"."reservations" TO "anon";

GRANT ALL ON TABLE "public"."reservations" TO "authenticated";

GRANT ALL ON TABLE "public"."reservations" TO "service_role";

GRANT ALL ON TABLE "public"."seasons" TO "anon";

GRANT ALL ON TABLE "public"."seasons" TO "authenticated";

GRANT ALL ON TABLE "public"."seasons" TO "service_role";

GRANT ALL ON TABLE "public"."sync_logs" TO "anon";

GRANT ALL ON TABLE "public"."sync_logs" TO "authenticated";

GRANT ALL ON TABLE "public"."sync_logs" TO "service_role";

GRANT ALL ON TABLE "public"."upload_batches" TO "anon";

GRANT ALL ON TABLE "public"."upload_batches" TO "authenticated";

GRANT ALL ON TABLE "public"."upload_batches" TO "service_role";

GRANT ALL ON TABLE "public"."user_area_permissions" TO "anon";

GRANT ALL ON TABLE "public"."user_area_permissions" TO "authenticated";

GRANT ALL ON TABLE "public"."user_area_permissions" TO "service_role";

GRANT ALL ON TABLE "public"."user_roles" TO "anon";

GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";

GRANT ALL ON TABLE "public"."user_roles" TO "service_role";

GRANT ALL ON TABLE "public"."utility_expense_allocations" TO "anon";

GRANT ALL ON TABLE "public"."utility_expense_allocations" TO "authenticated";

GRANT ALL ON TABLE "public"."utility_expense_allocations" TO "service_role";

GRANT ALL ON TABLE "public"."utility_expenses" TO "anon";

GRANT ALL ON TABLE "public"."utility_expenses" TO "authenticated";

GRANT ALL ON TABLE "public"."utility_expenses" TO "service_role";

GRANT ALL ON TABLE "public"."v_property_amenities" TO "anon";

GRANT ALL ON TABLE "public"."v_property_amenities" TO "authenticated";

GRANT ALL ON TABLE "public"."v_property_amenities" TO "service_role";

