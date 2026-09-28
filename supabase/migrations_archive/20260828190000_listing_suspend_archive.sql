-- Property lifecycle: Suspend (reversible — out of operations, still in management)
-- and Archive (hidden everywhere, history kept, recoverable). Kept separate from
-- the Hostaway-synced `status` so a sync can't undo them.
alter table public.listings add column if not exists is_suspended boolean not null default false;
alter table public.listings add column if not exists is_archived  boolean not null default false;
alter table public.listings add column if not exists archived_at   timestamptz;
create index if not exists idx_listings_archived on public.listings (is_archived);
