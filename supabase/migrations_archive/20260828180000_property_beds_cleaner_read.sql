-- Cleaners need to READ property_beds so the day's Shopping List can total linens.
-- Previously only staff (super/senior/admin) could touch property_beds, so the
-- cleaner-context query returned nothing → "No bed inventory". Managing stays staff-only.
drop policy if exists "Authenticated read property_beds" on public.property_beds;
create policy "Authenticated read property_beds" on public.property_beds
  for select to authenticated using (true);
