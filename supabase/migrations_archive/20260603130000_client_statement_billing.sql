-- ============================================================================
-- Escape Grids — Client Statement Area (P5 billing/reporting layer)
-- Revenue = GROSS (decided 2026-06-03). Engine math (R1–R7) lives in TS
-- (useClientStatement); this schema persists config, manual costs, adjustments
-- and the finalised settlement snapshot. Extends property_owners/listings per
-- the Field Cross-Map ("extend, don't duplicate"). Staff-only RLS.
-- ============================================================================
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
do $$ begin create type management_fee_method as enum ('percent_per_property','flat_per_property','flat_per_portfolio'); exception when duplicate_object then null; end $$;
do $$ begin create type settlement_method as enum ('pay_on_generation','weekly_draw'); exception when duplicate_object then null; end $$;
do $$ begin create type revenue_recognition as enum ('prorate_by_nights','whole_in_attributed_month'); exception when duplicate_object then null; end $$;
do $$ begin create type report_source_category as enum ('integration','platform_engine','derived','manual'); exception when duplicate_object then null; end $$;
do $$ begin create type report_booking_channel as enum ('bookingcom','airbnb','direct'); exception when duplicate_object then null; end $$;
do $$ begin create type report_status as enum ('draft','finalised'); exception when duplicate_object then null; end $$;
do $$ begin create type adjustment_target as enum ('revenue','cost_line','settlement'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- property_owners — billing profile (the CLIENT axes)
-- ---------------------------------------------------------------------------
alter table public.property_owners
  add column if not exists management_fee_method management_fee_method not null default 'percent_per_property',
  add column if not exists settlement_method     settlement_method     not null default 'pay_on_generation',
  add column if not exists weekly_rr_amount       numeric(12,2),
  add column if not exists flat_portfolio_fee     numeric(12,2),
  add column if not exists opening_balance        numeric(12,2) not null default 0,
  add column if not exists revenue_recognition    revenue_recognition not null default 'prorate_by_nights';

-- listings — per-property flat fee (only when method = flat_per_property)
alter table public.listings
  add column if not exists management_flat_fee numeric(12,2);

-- ---------------------------------------------------------------------------
-- cost_line_types — the report's cost lines (data, not schema)
-- ---------------------------------------------------------------------------
create table if not exists public.cost_line_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  source_category report_source_category not null,
  default_target_pct numeric(6,4),
  -- GROSS model: are booking/card fees a real settlement deduction? Yes (Revenue=gross).
  is_settlement_cost boolean not null default true,
  sort_order integer not null default 0
);
insert into public.cost_line_types (code, display_name, source_category, default_target_pct, is_settlement_cost, sort_order) values
  ('booking_fees',   'Booking Fees',          'integration',     0.1456, true,  10),
  ('card_processing','Card Processing Fees',  'integration',     0.0150, true,  20),
  ('cleaning',       'Cleaning',              'platform_engine', 0.1000, true,  30),
  ('consumables',    'Consumables',           'platform_engine', 0.0104, true,  40),
  ('laundry',        'Laundry',               'platform_engine', 0.0542, true,  50),
  ('management',     'Management',            'derived',         0.2400, true,  60),
  ('maintenance',    'Maintenance',           'platform_engine', 0.0374, true,  70),
  ('refunds',        'Refunds',               'integration',     0.0038, true,  80),
  ('setup',          'Setup',                 'manual',          0.0000, true,  90),
  ('welcome_baskets','Welcome Baskets',       'platform_engine', 0.0100, true, 100),
  ('utilities',      'Utilities',             'manual',          0.0000, true, 110)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- report_periods — one statement run per owner per month (settlement snapshot)
-- ---------------------------------------------------------------------------
create table if not exists public.report_periods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.property_owners(id) on delete restrict,
  period_start date not null,
  period_end   date not null,
  status report_status not null default 'draft',
  opening_balance numeric(12,2) not null default 0,
  weekly_rr_total numeric(12,2) not null default 0,
  -- finalised snapshot of the waterfall
  revenue_total          numeric(12,2),
  cost_total             numeric(12,2),
  net_total              numeric(12,2),
  settlement_due         numeric(12,2),
  net_settlement_balance numeric(12,2),
  generated_at  timestamptz,
  finalised_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (owner_id, period_start)
);
create index if not exists idx_report_periods_owner on public.report_periods (owner_id, period_start desc);

-- ---------------------------------------------------------------------------
-- property_costs — actual cost per period/listing/line (manual + snapshot)
-- ---------------------------------------------------------------------------
create table if not exists public.property_costs (
  id uuid primary key default gen_random_uuid(),
  report_period_id uuid not null references public.report_periods(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete restrict,
  cost_line_type_id uuid not null references public.cost_line_types(id) on delete restrict,
  actual_amount numeric(12,2) not null default 0,
  source report_source_category not null default 'manual',
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_period_id, listing_id, cost_line_type_id)
);
create index if not exists idx_property_costs_period on public.property_costs (report_period_id);

-- ---------------------------------------------------------------------------
-- property_booking_sources — channel split snapshot
-- ---------------------------------------------------------------------------
create table if not exists public.property_booking_sources (
  id uuid primary key default gen_random_uuid(),
  report_period_id uuid not null references public.report_periods(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete restrict,
  channel report_booking_channel not null,
  amount numeric(12,2) not null default 0,
  unique (report_period_id, listing_id, channel)
);

-- ---------------------------------------------------------------------------
-- line_adjustments — the one logged, attributed override (R6)
-- ---------------------------------------------------------------------------
create table if not exists public.line_adjustments (
  id uuid primary key default gen_random_uuid(),
  report_period_id uuid not null references public.report_periods(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete restrict,        -- null = portfolio level
  target adjustment_target not null,
  cost_line_type_id uuid references public.cost_line_types(id) on delete restrict,
  amount numeric(12,2) not null,                                            -- signed
  reason text not null,
  adjusted_by uuid,
  created_at timestamptz not null default now(),
  constraint cost_line_ref_consistency check (
    (target = 'cost_line' and cost_line_type_id is not null)
    or (target <> 'cost_line' and cost_line_type_id is null)
  )
);
create index if not exists idx_line_adjustments_period on public.line_adjustments (report_period_id);

-- ---------------------------------------------------------------------------
-- property_targets / property_cost_benchmarks — effective-dated targets
-- ---------------------------------------------------------------------------
create table if not exists public.property_targets (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  effective_from date not null,
  target_revenue numeric(12,2),
  target_occupancy_pct numeric(6,4),
  target_adr numeric(12,2),
  target_length_of_stay numeric(6,2),
  target_bookingcom_max_pct numeric(6,4),
  target_airbnb_max_pct numeric(6,4),
  target_direct_min_pct numeric(6,4),
  created_at timestamptz not null default now(),
  unique (listing_id, effective_from)
);
create index if not exists idx_property_targets_listing on public.property_targets (listing_id, effective_from desc);

create table if not exists public.property_cost_benchmarks (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  cost_line_type_id uuid not null references public.cost_line_types(id) on delete restrict,
  effective_from date not null,
  target_pct numeric(6,4) not null,
  created_at timestamptz not null default now(),
  unique (listing_id, cost_line_type_id, effective_from)
);

-- ---------------------------------------------------------------------------
-- updated_at trigger for property_costs (reuse set_updated_at if it exists)
-- ---------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_proc where proname='set_updated_at' and pronamespace='public'::regnamespace) then
    drop trigger if exists trg_property_costs_updated on public.property_costs;
    create trigger trg_property_costs_updated before update on public.property_costs
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- RLS — staff only (super/senior/admin). cost_line_types is readable reference.
-- ---------------------------------------------------------------------------
alter table public.cost_line_types          enable row level security;
alter table public.report_periods           enable row level security;
alter table public.property_costs           enable row level security;
alter table public.property_booking_sources enable row level security;
alter table public.line_adjustments         enable row level security;
alter table public.property_targets         enable row level security;
alter table public.property_cost_benchmarks enable row level security;

do $$
declare
  t text;
  staff text := '(has_role(auth.uid(), ''super''::app_role) or has_role(auth.uid(), ''senior''::app_role) or has_role(auth.uid(), ''admin''::app_role))';
begin
  foreach t in array array[
    'report_periods','property_costs','property_booking_sources','line_adjustments',
    'property_targets','property_cost_benchmarks'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_all', t);
    execute format('create policy %I on public.%I for all to authenticated using %s with check %s', t || '_staff_all', t, staff, staff);
  end loop;
  -- cost_line_types: staff full write, any authenticated read (reference data)
  execute 'drop policy if exists cost_line_types_staff_all on public.cost_line_types';
  execute format('create policy cost_line_types_staff_all on public.cost_line_types for all to authenticated using %s with check %s', staff, staff);
  execute 'drop policy if exists cost_line_types_read on public.cost_line_types';
  execute 'create policy cost_line_types_read on public.cost_line_types for select to authenticated using (true)';
end $$;
