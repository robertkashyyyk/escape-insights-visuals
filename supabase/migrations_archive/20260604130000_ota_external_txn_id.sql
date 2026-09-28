-- Dedup key for ingested transactions (Stripe txn id, etc.) so the same item from
-- a CSV upload and the API sync collapses to one row. Full unique index — NULLs are
-- distinct in Postgres, so Airbnb/Booking rows (null external_txn_id) coexist.
alter table public.ota_transactions add column if not exists external_txn_id text;
create unique index if not exists ux_ota_external_txn_id on public.ota_transactions (external_txn_id);
