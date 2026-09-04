-- Owner booking push: dedup column + kill switch + trigger that calls the
-- send-booking-notification edge function.

-- Dedup: dispatch only when null; the edge function stamps it after a send.
alter table public.reservations add column if not exists notified_at timestamptz;

-- Kill switch — flip off before any bulk load / onboarding, on again after.
--   turn off:  update public.notification_settings set booking_push_enabled = false;
--   turn on:   update public.notification_settings set booking_push_enabled = true;
create table if not exists public.notification_settings (
  id int primary key default 1 check (id = 1),
  booking_push_enabled boolean not null default true,
  updated_at timestamptz default now()
);
insert into public.notification_settings (id, booking_push_enabled)
  values (1, true) on conflict (id) do nothing;

create or replace function public.notify_new_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_enabled boolean;
begin
  -- Kill switch
  select booking_push_enabled into v_enabled from public.notification_settings where id = 1;
  if v_enabled is distinct from true then return new; end if;

  -- Dedup + relevance guards
  if new.notified_at is not null then return new; end if;                                   -- already sent
  if new.check_in is null or new.check_in < (now() at time zone 'Europe/London')::date
     then return new; end if;                                                               -- future arrivals only
  if tg_op = 'INSERT' then                                                                  -- recency guard: insert path only
    if new.created_at is null or now() - new.created_at > interval '10 minutes' then return new; end if;
  end if;

  -- Fire-and-forget; the function resolves the owner, sends, prunes dead
  -- endpoints and stamps notified_at. (anon key is public, same as the app build.)
  perform net.http_post(
    url := 'https://pftqjrmdksrrpczhomln.supabase.co/functions/v1/send-booking-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmdHFqcm1ka3NycnBjemhvbWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTYyMzAsImV4cCI6MjA5MDI3MjIzMH0.pnIOzWvQOxPLUsf3srx4Qqdc73xUAOa8aenokDABMOA'
    ),
    body := jsonb_build_object('reservation_id', new.id)
  );
  return new;
end;
$$;

-- Fire on a brand-new confirmed booking...
drop trigger if exists trg_notify_new_booking_ins on public.reservations;
create trigger trg_notify_new_booking_ins
  after insert on public.reservations
  for each row when (new.status = 'confirmed')
  execute function public.notify_new_booking();

-- ...OR when a pending/inquiry booking later transitions INTO confirmed
-- (the insert already happened and wouldn't re-fire an AFTER INSERT trigger).
drop trigger if exists trg_notify_new_booking_upd on public.reservations;
create trigger trg_notify_new_booking_upd
  after update of status on public.reservations
  for each row when (old.status is distinct from 'confirmed' and new.status = 'confirmed')
  execute function public.notify_new_booking();
