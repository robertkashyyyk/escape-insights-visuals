-- A cleaner's weekly day-off (non_working_days) is a RULE, not absolute. This
-- table records single-date overrides — "actually working this Thursday" — the
-- way you'd delete one occurrence of a repeating calendar event. Multi-day time
-- off stays handled by cleaner_holidays.
create table if not exists public.cleaner_working_exceptions (
  id uuid primary key default gen_random_uuid(),
  cleaner_id uuid not null references public.cleaners(id) on delete cascade,
  work_date date not null,
  created_at timestamptz not null default now(),
  unique (cleaner_id, work_date)
);
create index if not exists idx_cwe_cleaner on public.cleaner_working_exceptions (cleaner_id);
create index if not exists idx_cwe_date on public.cleaner_working_exceptions (work_date);

alter table public.cleaner_working_exceptions enable row level security;

drop policy if exists "Super/Senior manage working exceptions" on public.cleaner_working_exceptions;
create policy "Super/Senior manage working exceptions" on public.cleaner_working_exceptions
  for all to authenticated
  using (public.has_role(auth.uid(),'super'::app_role) or public.has_role(auth.uid(),'senior'::app_role))
  with check (public.has_role(auth.uid(),'super'::app_role) or public.has_role(auth.uid(),'senior'::app_role));

drop policy if exists "Staff read working exceptions" on public.cleaner_working_exceptions;
create policy "Staff read working exceptions" on public.cleaner_working_exceptions
  for select to authenticated
  using (public.has_role(auth.uid(),'admin'::app_role) or public.has_role(auth.uid(),'super'::app_role) or public.has_role(auth.uid(),'senior'::app_role));

drop policy if exists "Cleaners read own working exceptions" on public.cleaner_working_exceptions;
create policy "Cleaners read own working exceptions" on public.cleaner_working_exceptions
  for select to authenticated
  using (exists (select 1 from public.cleaners c where c.id = cleaner_working_exceptions.cleaner_id and c.user_id = auth.uid()));

grant select, insert, update, delete on public.cleaner_working_exceptions to authenticated;
