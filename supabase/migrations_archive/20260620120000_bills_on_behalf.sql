-- Bills paid on behalf of client: bank-statement ingest → auto-strip → review →
-- apportion (property / communal-by-ratio / region) → learning rules.
-- Apportioned amounts reach owner statements via cost_line_types (Stage 4).

-- Staff-write predicate mirrors the existing pattern (super/senior/admin).
-- Owner read is via owner_owns_listing(auth.uid(), listing_id).

-- 1. One row per uploaded bank statement CSV.
create table public.bank_statement_imports (
  id          uuid primary key default gen_random_uuid(),
  bank        text not null default 'wise',
  file_name   text,
  period_start date,
  period_end   date,
  row_count   int not null default 0,
  status      text not null default 'review' check (status in ('review','done')),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- 2. Parsed bank rows. external_id (e.g. Wise "TransferWise ID") is the idempotency
--    key so re-uploading the same / overlapping statement never double-counts.
create table public.bank_statement_txns (
  id             uuid primary key default gen_random_uuid(),
  import_id      uuid references public.bank_statement_imports(id) on delete cascade,
  external_id    text unique,
  txn_date       date,
  amount         numeric not null,                 -- signed as in statement (debit negative)
  direction      text check (direction in ('credit','debit')),
  details_type   text,                             -- TRANSFER / DIRECT_DEBIT / CARD / DEPOSIT
  payer_name     text,
  payee_name     text,
  reference      text,
  description    text,
  classification text not null default 'pending'
    check (classification in ('pending','income','owner_settlement','internal','candidate','bill','ignored')),
  matched_owner_id uuid references public.property_owners(id) on delete set null,
  status         text not null default 'pending' check (status in ('pending','confirmed','ignored')),
  bill_id        uuid,                             -- FK added after bills_on_behalf exists
  created_at     timestamptz not null default now()
);

-- 3. Learning / "bank of knowledge": normalised payee → what to do next time.
create table public.bill_payee_rules (
  id                       uuid primary key default gen_random_uuid(),
  payee_key                text not null unique,   -- normalised payee name
  sample_payee             text,                   -- last raw payee seen (display)
  action                   text not null check (action in ('income','owner_settlement','internal','bill','ignore')),
  cost_line_type_id        uuid references public.cost_line_types(id) on delete set null,
  target_type              text check (target_type in ('property','communal','region')),
  target_listing_id        uuid references public.listings(id) on delete set null,
  target_communal_group_id uuid references public.communal_groups(id) on delete set null,
  target_region            text,
  default_description       text,
  hit_count                int not null default 0,
  created_by               uuid references auth.users(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- 4. Confirmed "bill on behalf" (header).
create table public.bills_on_behalf (
  id                       uuid primary key default gen_random_uuid(),
  txn_id                   uuid references public.bank_statement_txns(id) on delete set null,
  import_id                uuid references public.bank_statement_imports(id) on delete set null,
  payee_name               text,
  bill_date                date not null,
  amount                   numeric not null check (amount >= 0),
  cost_line_type_id        uuid not null references public.cost_line_types(id),
  description              text,
  target_type              text not null check (target_type in ('property','communal','region')),
  target_communal_group_id uuid references public.communal_groups(id) on delete set null,
  target_region            text,
  receipt_url              text,
  created_by               uuid references auth.users(id) on delete set null,
  created_at               timestamptz not null default now()
);

alter table public.bank_statement_txns
  add constraint bank_statement_txns_bill_id_fkey
  foreign key (bill_id) references public.bills_on_behalf(id) on delete set null;

-- 5. Per-listing apportionment — the rows that reach the owner statement.
create table public.bill_allocations (
  id         uuid primary key default gen_random_uuid(),
  bill_id    uuid not null references public.bills_on_behalf(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  ratio_pct  numeric,                              -- null/100 for single property; communal ratio otherwise
  amount     numeric not null,                     -- bill.amount * ratio/100
  created_at timestamptz not null default now()
);

create index on public.bank_statement_txns(import_id);
create index on public.bank_statement_txns(classification, status);
create index on public.bills_on_behalf(bill_date);
create index on public.bill_allocations(bill_id);
create index on public.bill_allocations(listing_id);

-- updated_at touch (uniquely named to avoid clobbering any shared helper).
create or replace function public.tg_bill_rules_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger trg_bill_payee_rules_touch
  before update on public.bill_payee_rules
  for each row execute function public.tg_bill_rules_touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.bank_statement_imports enable row level security;
alter table public.bank_statement_txns    enable row level security;
alter table public.bill_payee_rules       enable row level security;
alter table public.bills_on_behalf        enable row level security;
alter table public.bill_allocations       enable row level security;

grant select, insert, update, delete on
  public.bank_statement_imports, public.bank_statement_txns,
  public.bill_payee_rules, public.bills_on_behalf, public.bill_allocations
  to authenticated;
grant all on
  public.bank_statement_imports, public.bank_statement_txns,
  public.bill_payee_rules, public.bills_on_behalf, public.bill_allocations
  to service_role;

-- Staff (super/senior/admin) manage everything.
do $$
declare t text;
begin
  foreach t in array array['bank_statement_imports','bank_statement_txns','bill_payee_rules','bills_on_behalf','bill_allocations']
  loop
    execute format($f$
      create policy "%1$s_staff_all" on public.%1$s for all to authenticated
      using (has_role(auth.uid(),'super'::app_role) or has_role(auth.uid(),'senior'::app_role) or has_role(auth.uid(),'admin'::app_role))
      with check (has_role(auth.uid(),'super'::app_role) or has_role(auth.uid(),'senior'::app_role) or has_role(auth.uid(),'admin'::app_role));
    $f$, t);
  end loop;
end $$;

-- Owners may read the bills/allocations that touch their own listings (for statements).
create policy "bill_allocations_owner_read" on public.bill_allocations
  for select to authenticated using (owner_owns_listing(auth.uid(), listing_id));

create policy "bills_on_behalf_owner_read" on public.bills_on_behalf
  for select to authenticated using (
    exists (
      select 1 from public.bill_allocations ba
      where ba.bill_id = bills_on_behalf.id and owner_owns_listing(auth.uid(), ba.listing_id)
    )
  );
