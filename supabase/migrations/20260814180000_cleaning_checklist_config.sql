-- Cleaner job-checklist config foundation (Phase 1).
--  * kitchens count on listings (bathrooms already exists)
--  * consumables catalogue (central, by room type; per-property override later)
--  * per-property equipment list (seeded from amenities)

-- ── Kitchens count ──
alter table public.listings add column if not exists kitchens integer not null default 1;

-- ── Consumables catalogue ──
-- listing_id NULL = global default (applies to every property's rooms). A future
-- per-property override can add rows with a listing_id set.
create table if not exists public.consumables (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete cascade,
  name text not null,
  room_type text not null check (room_type in ('kitchen','bathroom')),
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_consumables_room on public.consumables (room_type, listing_id);

insert into public.consumables (name, room_type, display_order) values
  ('Dishwasher Tablets','kitchen',1),
  ('Washing-Up Liquid','kitchen',2),
  ('Tea Towels','kitchen',3),
  ('Kitchen Roll','kitchen',4),
  ('Shampoo / Shower Gel','bathroom',1),
  ('Toilet Rolls','bathroom',2)
on conflict do nothing;

-- ── Per-property equipment ──
create table if not exists public.property_equipment (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (listing_id, name)
);
create index if not exists idx_property_equipment_listing on public.property_equipment (listing_id);

-- Seed equipment from amenities so properties start populated (manager edits after).
insert into public.property_equipment (listing_id, name)
select l.id, e.name
from public.listings l
cross join (values ('Hot Tub','hot tub'),('BBQ','bbq'),('Sauna','sauna'),('Pizza Oven','pizza oven')) e(name, kw)
where l.is_bundle = false
  and jsonb_typeof(l.amenities) = 'array'
  and exists (select 1 from jsonb_array_elements_text(l.amenities) a where lower(a) like '%' || e.kw || '%')
on conflict (listing_id, name) do nothing;

-- ── RLS: catalogue/equipment readable by any signed-in user (cleaners need it);
-- managed by super/senior. ──
alter table public.consumables enable row level security;
alter table public.property_equipment enable row level security;

drop policy if exists "Authenticated read consumables" on public.consumables;
create policy "Authenticated read consumables" on public.consumables for select to authenticated using (true);
drop policy if exists "Super/Senior manage consumables" on public.consumables;
create policy "Super/Senior manage consumables" on public.consumables for all to authenticated
  using (has_role(auth.uid(),'super'::app_role) or has_role(auth.uid(),'senior'::app_role))
  with check (has_role(auth.uid(),'super'::app_role) or has_role(auth.uid(),'senior'::app_role));

drop policy if exists "Authenticated read property_equipment" on public.property_equipment;
create policy "Authenticated read property_equipment" on public.property_equipment for select to authenticated using (true);
drop policy if exists "Super/Senior manage property_equipment" on public.property_equipment;
create policy "Super/Senior manage property_equipment" on public.property_equipment for all to authenticated
  using (has_role(auth.uid(),'super'::app_role) or has_role(auth.uid(),'senior'::app_role))
  with check (has_role(auth.uid(),'super'::app_role) or has_role(auth.uid(),'senior'::app_role));

grant select, insert, update, delete on public.consumables to authenticated;
grant select, insert, update, delete on public.property_equipment to authenticated;

drop trigger if exists trg_consumables_updated_at on public.consumables;
create trigger trg_consumables_updated_at before update on public.consumables
  for each row execute function public.tg_set_updated_at();
