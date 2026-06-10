-- Fix: a cleaner's turnover clean is dated on the DEPARTING reservation's checkout, but
-- it prepares the property for the NEXT arriving guest. So the cleaner must be able to
-- read booking_requests for any reservation at a listing they clean (not only the exact
-- reservation their clean_task is linked to), so the arriving guest's requests surface.
DROP POLICY IF EXISTS "Cleaners read assigned booking_requests" ON public.booking_requests;
DROP POLICY IF EXISTS "Cleaners read listing booking_requests" ON public.booking_requests;
CREATE POLICY "Cleaners read listing booking_requests" ON public.booking_requests
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.reservations rv
    JOIN public.clean_tasks ct ON ct.listing_id = rv.listing_id
    JOIN public.cleaners c ON c.id = ct.assigned_cleaner_id
    WHERE rv.id = booking_requests.reservation_id
      AND c.user_id = auth.uid()
  ));
