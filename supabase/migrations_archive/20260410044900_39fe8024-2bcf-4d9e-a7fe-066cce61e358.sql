
-- Clean tasks table
CREATE TABLE public.clean_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  scheduled_date date NOT NULL,
  assigned_cleaner_id uuid REFERENCES public.cleaners(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'scheduled',
  priority text NOT NULL DEFAULT 'standard',
  estimated_start_time time,
  cleaning_duration_minutes integer NOT NULL DEFAULT 90,
  travel_time_from_previous_minutes integer DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(reservation_id, scheduled_date)
);

ALTER TABLE public.clean_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super/Senior can manage clean_tasks" ON public.clean_tasks
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super'::app_role) OR has_role(auth.uid(), 'senior'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super'::app_role) OR has_role(auth.uid(), 'senior'::app_role));

CREATE POLICY "Admin can read clean_tasks" ON public.clean_tasks
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Automation logs table
CREATE TABLE public.automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  tasks_created integer NOT NULL DEFAULT 0,
  tasks_unassigned integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  triggered_by text DEFAULT 'scheduled'
);

ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super/Senior can manage automation_logs" ON public.automation_logs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super'::app_role) OR has_role(auth.uid(), 'senior'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super'::app_role) OR has_role(auth.uid(), 'senior'::app_role));

CREATE POLICY "Admin can read automation_logs" ON public.automation_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add is_clean to listings
ALTER TABLE public.listings ADD COLUMN is_clean boolean NOT NULL DEFAULT true;

-- Add notification toggles to cleaners
ALTER TABLE public.cleaners ADD COLUMN notify_email boolean NOT NULL DEFAULT false;
ALTER TABLE public.cleaners ADD COLUMN notify_whatsapp boolean NOT NULL DEFAULT false;

-- Add schedule generation time setting
INSERT INTO public.app_settings (key, value) VALUES ('schedule_generation_time', '07:00')
ON CONFLICT DO NOTHING;
