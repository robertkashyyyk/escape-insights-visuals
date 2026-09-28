-- Cleaner job checklist state (Phase 2) — one row per tickable item on a clean.
-- This table IS the audit trail backbone: every tick carries who/when, whether it
-- was part of a "Check All", a photo (equipment, Phase 3) and a red-flag (Phase 4).
create table if not exists public.clean_checklist_items (
  id uuid primary key default gen_random_uuid(),
  clean_task_id uuid not null references public.clean_tasks(id) on delete cascade,
  category text not null check (category in ('request','consumable','equipment')),
  room_type text,                 -- 'kitchen' | 'bathroom' for consumables
  room_index integer,             -- which room instance (1..N) for consumables
  label text not null,            -- snapshot label (e.g. 'Toilet Rolls', 'Travel Cot', 'Hot Tub')
  ref_id uuid,                    -- source consumable/equipment id (null for requests)
  checked boolean not null default false,
  checked_at timestamptz,
  checked_by uuid references auth.users(id) on delete set null,
  check_all boolean not null default false,   -- ticked as part of a room "Check All"
  photo_url text,                              -- equipment photo (Phase 3)
  flagged boolean not null default false,      -- rushed check-all (Phase 4)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_checklist_item on public.clean_checklist_items
  (clean_task_id, category, coalesce(room_type,''), coalesce(room_index,0), label);
create index if not exists idx_checklist_task on public.clean_checklist_items (clean_task_id);

alter table public.clean_checklist_items enable row level security;

-- Cleaners manage checklist items for the tasks assigned to them.
drop policy if exists "Cleaner manage own checklist" on public.clean_checklist_items;
create policy "Cleaner manage own checklist" on public.clean_checklist_items for all to authenticated
using (exists (
  select 1 from public.clean_tasks ct join public.cleaners c on c.id = ct.assigned_cleaner_id
  where ct.id = clean_checklist_items.clean_task_id and c.user_id = auth.uid()))
with check (exists (
  select 1 from public.clean_tasks ct join public.cleaners c on c.id = ct.assigned_cleaner_id
  where ct.id = clean_checklist_items.clean_task_id and c.user_id = auth.uid()));

-- Staff (super/senior/admin) manage all.
drop policy if exists "Staff manage checklist" on public.clean_checklist_items;
create policy "Staff manage checklist" on public.clean_checklist_items for all to authenticated
using (has_role(auth.uid(),'super'::app_role) or has_role(auth.uid(),'senior'::app_role) or has_role(auth.uid(),'admin'::app_role))
with check (has_role(auth.uid(),'super'::app_role) or has_role(auth.uid(),'senior'::app_role) or has_role(auth.uid(),'admin'::app_role));

grant select, insert, update, delete on public.clean_checklist_items to authenticated;

drop trigger if exists trg_checklist_updated_at on public.clean_checklist_items;
create trigger trg_checklist_updated_at before update on public.clean_checklist_items
  for each row execute function public.tg_set_updated_at();
