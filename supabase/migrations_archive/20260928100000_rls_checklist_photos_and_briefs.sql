-- Security fix: replace the wide-open "ALL to authenticated USING(true)" policies on
-- clean_checklist_photos and property_briefs with least-privilege policies matching the
-- clean_checklist_items / clean_issues pattern.

-- ============================ clean_checklist_photos ============================
DROP POLICY IF EXISTS ccp_all ON public.clean_checklist_photos;

-- Staff (super/senior/admin) manage all.
CREATE POLICY ccp_staff_all ON public.clean_checklist_photos FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role));

-- A cleaner can read/add/update photos only for checklist items on clean_tasks assigned
-- to them. DELETE is separate and blocked once the clean is completed.
CREATE POLICY ccp_cleaner_select ON public.clean_checklist_photos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clean_checklist_items i
      JOIN public.clean_tasks ct ON ct.id = i.clean_task_id
      JOIN public.cleaners c ON c.id = ct.assigned_cleaner_id
    WHERE i.id = clean_checklist_photos.checklist_item_id AND c.user_id = auth.uid()));

CREATE POLICY ccp_cleaner_insert ON public.clean_checklist_photos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clean_checklist_items i
      JOIN public.clean_tasks ct ON ct.id = i.clean_task_id
      JOIN public.cleaners c ON c.id = ct.assigned_cleaner_id
    WHERE i.id = clean_checklist_photos.checklist_item_id AND c.user_id = auth.uid()));

CREATE POLICY ccp_cleaner_update ON public.clean_checklist_photos FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clean_checklist_items i
      JOIN public.clean_tasks ct ON ct.id = i.clean_task_id
      JOIN public.cleaners c ON c.id = ct.assigned_cleaner_id
    WHERE i.id = clean_checklist_photos.checklist_item_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clean_checklist_items i
      JOIN public.clean_tasks ct ON ct.id = i.clean_task_id
      JOIN public.cleaners c ON c.id = ct.assigned_cleaner_id
    WHERE i.id = clean_checklist_photos.checklist_item_id AND c.user_id = auth.uid()));

-- Cleaner DELETE own photos only while the clean is NOT completed.
CREATE POLICY ccp_cleaner_delete ON public.clean_checklist_photos FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clean_checklist_items i
      JOIN public.clean_tasks ct ON ct.id = i.clean_task_id
      JOIN public.cleaners c ON c.id = ct.assigned_cleaner_id
    WHERE i.id = clean_checklist_photos.checklist_item_id AND c.user_id = auth.uid()
      AND ct.status NOT IN ('completed','done')));

-- ============================ property_briefs ============================
DROP POLICY IF EXISTS property_briefs_rw ON public.property_briefs;

-- Super/senior manage all; admin read-only.
CREATE POLICY pb_superSenior_all ON public.property_briefs FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role))
  WITH CHECK (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role));

CREATE POLICY pb_admin_select ON public.property_briefs FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));

-- A cleaner can only SEE briefs for a listing where they have a LIVE assigned clean.
-- They cannot UPDATE directly — acknowledgement goes through acknowledge_brief().
CREATE POLICY pb_cleaner_select ON public.property_briefs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clean_tasks ct
      JOIN public.cleaners c ON c.id = ct.assigned_cleaner_id
    WHERE ct.listing_id = property_briefs.listing_id AND c.user_id = auth.uid()
      AND ct.status NOT IN ('cancelled','canceled','completed','done')));

-- SECURITY DEFINER ack: the assigned cleaner sets only the acknowledgement fields.
CREATE OR REPLACE FUNCTION public.acknowledge_brief(p_brief_id uuid, p_clean_task_id uuid, p_member text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clean_tasks ct
      JOIN public.cleaners c ON c.id = ct.assigned_cleaner_id
      JOIN public.property_briefs b ON b.id = p_brief_id
    WHERE ct.id = p_clean_task_id AND c.user_id = auth.uid()
      AND ct.listing_id = b.listing_id
      AND ct.status NOT IN ('cancelled','canceled','completed','done')
  ) THEN
    RAISE EXCEPTION 'not authorised to acknowledge this brief';
  END IF;
  UPDATE public.property_briefs
     SET consumed_by_clean_task_id = p_clean_task_id, consumed_at = now(), consumed_by_member = p_member
   WHERE id = p_brief_id AND resolved_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.acknowledge_brief(uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.acknowledge_brief(uuid, uuid, text) TO authenticated;

-- ============================ storage: brief photos ============================
-- Brief photos live under briefs/<listing_id>/... in clean-issue-photos. Managers
-- (super/senior) upload; staff and cleaners-with-a-live-clean-on-that-listing read.
DROP POLICY IF EXISTS "Staff upload brief photos" ON storage.objects;
CREATE POLICY "Staff upload brief photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'clean-issue-photos'
    AND (storage.foldername(name))[1] = 'briefs'
    AND (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role)));

DROP POLICY IF EXISTS "Read brief photos" ON storage.objects;
CREATE POLICY "Read brief photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'clean-issue-photos'
    AND (storage.foldername(name))[1] = 'briefs'
    AND (
      has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.clean_tasks ct
          JOIN public.cleaners c ON c.id = ct.assigned_cleaner_id
        WHERE ct.listing_id::text = (storage.foldername(name))[2] AND c.user_id = auth.uid()
          AND ct.status NOT IN ('cancelled','canceled','completed','done'))
    ));
-- (DELETE of brief photos is covered by the existing "Staff manage issue photos" DELETE
--  policy for super/senior on this bucket.)
