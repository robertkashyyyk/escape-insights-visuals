-- Equipment checks can be photo-verified (Hot Tub, BBQ…) OR tick-only (Coffee
-- Machine): a per-item flag decides. Default true = keep existing items photo-required.
alter table public.property_equipment   add column if not exists requires_photo boolean not null default true;
alter table public.clean_checklist_items add column if not exists requires_photo boolean not null default true;

-- Coffee Machine is a tick-only check. Seed it (no photo) onto properties whose
-- amenities mention coffee; managers can add/remove it per property in the editor.
insert into public.property_equipment (listing_id, name, requires_photo)
select l.id, 'Coffee Machine', false
from public.listings l
where l.is_bundle = false
  and jsonb_typeof(l.amenities) = 'array'
  and exists (select 1 from jsonb_array_elements_text(l.amenities) a where lower(a) like '%coffee%')
on conflict (listing_id, name) do update set requires_photo = excluded.requires_photo;
