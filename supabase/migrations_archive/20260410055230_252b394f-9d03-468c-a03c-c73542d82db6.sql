
-- Add 'cleaner' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cleaner';

-- Add user_id to cleaners table to link to auth.users
ALTER TABLE public.cleaners ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cleaners_user_id ON public.cleaners(user_id) WHERE user_id IS NOT NULL;

-- Add missing columns to clean_tasks
ALTER TABLE public.clean_tasks ADD COLUMN IF NOT EXISTS route_order integer DEFAULT 0;
ALTER TABLE public.clean_tasks ADD COLUMN IF NOT EXISTS is_same_day_turnaround boolean DEFAULT false;
ALTER TABLE public.clean_tasks ADD COLUMN IF NOT EXISTS checkout_time time without time zone;
ALTER TABLE public.clean_tasks ADD COLUMN IF NOT EXISTS checkin_time time without time zone;

-- RLS: Cleaners can read their own tasks
CREATE POLICY "Cleaners can read own tasks"
ON public.clean_tasks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cleaners c
    WHERE c.id = clean_tasks.assigned_cleaner_id
      AND c.user_id = auth.uid()
  )
);

-- RLS: Cleaners can update their own tasks (mark complete)
CREATE POLICY "Cleaners can update own tasks"
ON public.clean_tasks
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cleaners c
    WHERE c.id = clean_tasks.assigned_cleaner_id
      AND c.user_id = auth.uid()
  )
);

-- RLS: Cleaners can read listings linked to their tasks
CREATE POLICY "Cleaners can read task listings"
ON public.listings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clean_tasks ct
    JOIN public.cleaners c ON c.id = ct.assigned_cleaner_id
    WHERE ct.listing_id = listings.id
      AND c.user_id = auth.uid()
  )
);

-- RLS: Cleaners can update is_clean on listings for their tasks
CREATE POLICY "Cleaners can update listing clean status"
ON public.listings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clean_tasks ct
    JOIN public.cleaners c ON c.id = ct.assigned_cleaner_id
    WHERE ct.listing_id = listings.id
      AND c.user_id = auth.uid()
  )
);

-- RLS: Cleaners can read their own cleaner profile
CREATE POLICY "Cleaners can read own cleaner record"
ON public.cleaners
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
