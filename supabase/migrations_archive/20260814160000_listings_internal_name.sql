-- Bring Hostaway's internal/operational listing name into Escape Grids.
-- Hostaway listings carry two names: the branded guest-facing one (l.name, e.g.
-- "Mabel's Maison by Escape Ordinary") and an internalListingName used
-- operationally (e.g. "Castle Hume 9"). We already store the branded one as
-- listings.name; this adds the internal one so renamed properties can still be
-- identified (communal groups, ops views, search).
alter table public.listings add column if not exists internal_name text;
comment on column public.listings.internal_name is
  'Hostaway internalListingName — operational/internal name (e.g. "Castle Hume 9"), distinct from the branded guest-facing listings.name.';
