-- F1: multiple proof photos per checklist item.
-- - property_equipment.min_photos (default 1); default 2 for hot tub / jacuzzi / coffee.
-- - clean_checklist_items.min_photos (denormalised at generation) so the cleaner app
--   knows the requirement per item.
-- - clean_checklist_photos child table (photo_url on the item stays as the first photo
--   for read-compatibility during the transition).
ALTER TABLE public.property_equipment  ADD COLUMN IF NOT EXISTS min_photos smallint NOT NULL DEFAULT 1;
ALTER TABLE public.clean_checklist_items ADD COLUMN IF NOT EXISTS min_photos smallint NOT NULL DEFAULT 1;

-- Anything named like a hot tub / jacuzzi / coffee machine needs 2 proof photos by default.
UPDATE public.property_equipment
   SET min_photos = 2
 WHERE min_photos < 2
   AND (name ~* 'hot ?tub' OR name ~* 'jacuzzi' OR name ~* 'coffee');

CREATE TABLE IF NOT EXISTS public.clean_checklist_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id uuid NOT NULL REFERENCES public.clean_checklist_items(id) ON DELETE CASCADE,
  photo_path text NOT NULL,
  taken_at timestamptz NOT NULL DEFAULT now(),
  taken_by_member text
);
CREATE INDEX IF NOT EXISTS idx_clean_checklist_photos_item ON public.clean_checklist_photos(checklist_item_id);

ALTER TABLE public.clean_checklist_photos ENABLE ROW LEVEL SECURITY;
-- Mirror clean_checklist_items access: authenticated users (managers + cleaners) can
-- read/insert; keep it simple (same surface the checklist itself uses).
DROP POLICY IF EXISTS ccp_all ON public.clean_checklist_photos;
CREATE POLICY ccp_all ON public.clean_checklist_photos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Backfill: seed the child table from any existing single photo_url so history shows.
INSERT INTO public.clean_checklist_photos (checklist_item_id, photo_path, taken_at)
SELECT id, photo_url, COALESCE(checked_at, created_at)
FROM public.clean_checklist_items
WHERE photo_url IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.clean_checklist_photos p WHERE p.checklist_item_id = clean_checklist_items.id);
