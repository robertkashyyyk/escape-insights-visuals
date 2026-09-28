-- Web-push subscriptions — one row per device, keyed to the auth user.
-- Reusable for owners now and cleaners later.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now(),
  last_used_at timestamptz
);

alter table public.push_subscriptions enable row level security;

-- A user may only see/manage their own device rows. The Edge Function uses the
-- service role and bypasses RLS. UPDATE is included so the client's re-subscribe
-- upsert (ON CONFLICT (endpoint) DO UPDATE) is permitted for one's own rows.
drop policy if exists push_subs_select on public.push_subscriptions;
create policy push_subs_select on public.push_subscriptions
  for select using (owner_id = auth.uid());

drop policy if exists push_subs_insert on public.push_subscriptions;
create policy push_subs_insert on public.push_subscriptions
  for insert with check (owner_id = auth.uid());

drop policy if exists push_subs_update on public.push_subscriptions;
create policy push_subs_update on public.push_subscriptions
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists push_subs_delete on public.push_subscriptions;
create policy push_subs_delete on public.push_subscriptions
  for delete using (owner_id = auth.uid());
