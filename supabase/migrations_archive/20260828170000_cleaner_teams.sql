-- Team cleaners: one login shared by several named people (e.g. Sunshine = 4).
-- The cleaner record stays a single scheduling unit; members are named here and
-- attached to each action for attribution.
alter table public.cleaners add column if not exists is_team boolean not null default false;

create table if not exists public.cleaner_members (
  id uuid primary key default gen_random_uuid(),
  cleaner_id uuid not null references public.cleaners(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_cleaner_members on public.cleaner_members (cleaner_id);

alter table public.cleaner_members enable row level security;

drop policy if exists "Super/Senior manage cleaner_members" on public.cleaner_members;
create policy "Super/Senior manage cleaner_members" on public.cleaner_members
  for all to authenticated
  using (public.has_role(auth.uid(),'super'::app_role) or public.has_role(auth.uid(),'senior'::app_role))
  with check (public.has_role(auth.uid(),'super'::app_role) or public.has_role(auth.uid(),'senior'::app_role));

drop policy if exists "Authenticated read cleaner_members" on public.cleaner_members;
create policy "Authenticated read cleaner_members" on public.cleaner_members
  for select to authenticated using (true);

grant select, insert, update, delete on public.cleaner_members to authenticated;

-- Member attribution on the actions (name snapshot, survives member edits).
alter table public.clean_tasks          add column if not exists started_by_member   text;
alter table public.clean_tasks          add column if not exists completed_by_member text;
alter table public.clean_checklist_items add column if not exists checked_by_member  text;
