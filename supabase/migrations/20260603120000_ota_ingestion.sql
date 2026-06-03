-- ============================================================================
-- Escape Grids — OTA Report Ingestion (P1–P4)
-- Upload Airbnb / Booking.com settlement reports, parse to staging, resolve
-- listings, match to Hostaway reservations, queue the rest for humans.
--
-- Additive only. References the EXISTING operational tables (listings,
-- reservations) per the Field Cross-Map "extend, don't duplicate" decision.
-- Internal staff tool: RLS = staff only (super / senior / admin).
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
do $$ begin
  create type ota_platform as enum ('airbnb','bookingcom');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ota_txn_type as enum ('reservation','payout','resolution','adjustment');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Booking.com Net = channel-collected; Gross = host-collected; Airbnb = always channel.
  create type ota_collection_model as enum ('channel','host');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ota_match_method as enum ('code','composite','manual','none');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ota_recon_status as enum ('auto_matched','needs_recon','matched','unmatched','excluded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ota_batch_status as enum ('parsed','reconciled','partial');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ota_attribution_outcome as enum ('management_report','company_retention');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- reservations.channel_reservation_code (forward-looking)
-- The Hostaway sync does not currently capture the channel/OTA confirmation
-- code, so reservation matching is composite-only today. This nullable column
-- + index lets the strong code-based match (match_method='code') light up with
-- zero rework once hostaway-sync is extended to populate it (channelReservationId).
-- ----------------------------------------------------------------------------
alter table public.reservations
  add column if not exists channel_reservation_code text;

create index if not exists idx_reservations_channel_reservation_code
  on public.reservations (channel_reservation_code)
  where channel_reservation_code is not null;

-- ----------------------------------------------------------------------------
-- ota_import_batches — one row per uploaded CSV
-- ----------------------------------------------------------------------------
create table if not exists public.ota_import_batches (
  id                   uuid primary key default gen_random_uuid(),
  platform             ota_platform not null,
  source_filename      text not null,
  inferred_period_start date,
  inferred_period_end   date,
  row_count            integer not null default 0,
  status               ota_batch_status not null default 'parsed',
  uploaded_by          uuid,                              -- auth.uid()
  uploaded_at          timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- ota_transactions — parsed/staged rows; the spine of recon + attribution
-- ----------------------------------------------------------------------------
create table if not exists public.ota_transactions (
  id                    uuid primary key default gen_random_uuid(),
  batch_id              uuid not null references public.ota_import_batches(id) on delete cascade,
  platform              ota_platform not null,
  txn_type              ota_txn_type not null,

  -- identifiers from the report
  confirmation_code     text,        -- Airbnb "Confirmation Code"
  reference_number      text,        -- Booking.com "Reference number"
  statement_descriptor  text,
  bookingcom_property_id text,        -- Booking.com stable numeric Property ID

  -- reservation detail
  property_name_raw     text,
  guest_name            text,
  check_in              date,
  check_out             date,
  nights                integer,

  -- money
  currency              text not null default 'GBP',
  gross_amount          numeric(12,2),
  commission_amount     numeric(12,2),
  commission_pct        numeric(7,4),
  payment_fee_amount    numeric(12,2),
  vat                   numeric(12,2),
  tax                   numeric(12,2),
  net_amount            numeric(12,2),

  collection_model      ota_collection_model,            -- null for non-reservation rows
  is_revenue            boolean not null default false,

  -- resolution + matching
  resolved_listing_id   uuid references public.listings(id) on delete set null,
  matched_reservation_id uuid references public.reservations(id) on delete set null,
  match_confidence      numeric(4,3),                    -- 0.000 .. 1.000
  match_method          ota_match_method not null default 'none',
  recon_status          ota_recon_status not null default 'needs_recon',

  raw_row               jsonb,
  created_at            timestamptz not null default now()
);
create index if not exists idx_ota_txn_batch        on public.ota_transactions (batch_id);
create index if not exists idx_ota_txn_recon_status  on public.ota_transactions (recon_status);
create index if not exists idx_ota_txn_listing       on public.ota_transactions (resolved_listing_id);
create index if not exists idx_ota_txn_reservation   on public.ota_transactions (matched_reservation_id);
create index if not exists idx_ota_txn_revenue       on public.ota_transactions (is_revenue);

-- ----------------------------------------------------------------------------
-- listing_aliases — learns name/id -> listing mappings (decided once)
-- For Booking.com's stable Property ID we store an alias whose raw_name is the
-- numeric id (coexists with textual-name aliases under the same platform).
-- ----------------------------------------------------------------------------
create table if not exists public.listing_aliases (
  id          uuid primary key default gen_random_uuid(),
  platform    ota_platform not null,
  raw_name    text not null,
  listing_id  uuid not null references public.listings(id) on delete cascade,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  unique (platform, raw_name)
);
create index if not exists idx_listing_aliases_listing on public.listing_aliases (listing_id);

-- ----------------------------------------------------------------------------
-- ota_attribution_decisions — outcome for non-revenue items
-- ----------------------------------------------------------------------------
create table if not exists public.ota_attribution_decisions (
  id                  uuid primary key default gen_random_uuid(),
  ota_transaction_id  uuid not null references public.ota_transactions(id) on delete cascade,
  outcome             ota_attribution_outcome not null,
  allocated_listing_id uuid references public.listings(id) on delete set null,
  reason              text,
  decided_by          uuid,
  decided_at          timestamptz not null default now(),
  -- "Send to Management Report" must carry a listing; "Company Retention" must not.
  constraint allocation_consistency check (
    (outcome = 'management_report' and allocated_listing_id is not null)
    or (outcome = 'company_retention' and allocated_listing_id is null)
  )
);
create index if not exists idx_ota_attr_txn on public.ota_attribution_decisions (ota_transaction_id);

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY — staff only (super / senior / admin), mirrors clean_issues
-- ----------------------------------------------------------------------------
alter table public.ota_import_batches        enable row level security;
alter table public.ota_transactions          enable row level security;
alter table public.listing_aliases           enable row level security;
alter table public.ota_attribution_decisions enable row level security;

do $$
declare
  t text;
  staff text := '(has_role(auth.uid(), ''super''::app_role) or has_role(auth.uid(), ''senior''::app_role) or has_role(auth.uid(), ''admin''::app_role))';
begin
  foreach t in array array[
    'ota_import_batches','ota_transactions','listing_aliases','ota_attribution_decisions'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using %s with check %s',
      t || '_staff_all', t, staff, staff
    );
  end loop;
end $$;
