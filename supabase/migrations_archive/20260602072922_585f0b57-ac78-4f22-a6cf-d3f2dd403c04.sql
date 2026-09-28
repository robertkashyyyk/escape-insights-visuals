-- Maintenance workflow fields on clean_issues
ALTER TABLE public.clean_issues
  ADD COLUMN IF NOT EXISTS claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS maintenance_stage text NOT NULL DEFAULT 'reported' CHECK (maintenance_stage IN ('reported','claimed','in_progress','pending_parts','handoff','complete')),
  ADD COLUMN IF NOT EXISTS handoff_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS handoff_note text,
  ADD COLUMN IF NOT EXISTS handoff_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_note text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.clean_issues DROP CONSTRAINT IF EXISTS clean_issues_status_check;
ALTER TABLE public.clean_issues ADD CONSTRAINT clean_issues_status_check CHECK (status IN ('open','acknowledged','in_progress','resolved','complete'));

-- Allow claimed_by / handoff_to / completed_by staff to update relevant rows (covered by super/senior policies already).
-- Add policy so admin can also update maintenance fields:
DROP POLICY IF EXISTS "Admin can update maintenance" ON public.clean_issues;
CREATE POLICY "Admin can update maintenance" ON public.clean_issues
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

-- ===== Expense Consumables =====
CREATE TABLE IF NOT EXISTS public.expense_consumables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchased_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  purchased_by_name text,
  purchase_date date NOT NULL,
  supplier text NOT NULL,
  receipt_value numeric(10,2) NOT NULL,
  payer text NOT NULL CHECK (payer IN ('company','cleaner')),
  reimbursed boolean NOT NULL DEFAULT false,
  reimbursed_at timestamptz,
  allocation_type text NOT NULL CHECK (allocation_type IN ('property','region')),
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  region text,
  notes text,
  receipt_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_consumables TO authenticated;
GRANT ALL ON public.expense_consumables TO service_role;

CREATE INDEX IF NOT EXISTS idx_expense_consumables_date ON public.expense_consumables(purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_expense_consumables_payer ON public.expense_consumables(payer);
CREATE INDEX IF NOT EXISTS idx_expense_consumables_listing ON public.expense_consumables(listing_id);

ALTER TABLE public.expense_consumables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage consumables" ON public.expense_consumables
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Cleaners insert own consumables" ON public.expense_consumables
  FOR INSERT TO authenticated
  WITH CHECK (purchased_by_user_id = auth.uid());

CREATE POLICY "Cleaners read own consumables" ON public.expense_consumables
  FOR SELECT TO authenticated
  USING (purchased_by_user_id = auth.uid());

-- ===== Laundry =====
CREATE TABLE IF NOT EXISTS public.expense_laundry_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_date date NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  supplier text NOT NULL DEFAULT 'Laundry Service',
  total_amount numeric(10,2) NOT NULL,
  notes text,
  receipt_path text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_laundry_bills TO authenticated;
GRANT ALL ON public.expense_laundry_bills TO service_role;

CREATE TABLE IF NOT EXISTS public.expense_laundry_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.expense_laundry_bills(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  listing_name text NOT NULL,
  bookings_in_period integer NOT NULL DEFAULT 0,
  bedrooms integer NOT NULL DEFAULT 0,
  rooms_let integer NOT NULL DEFAULT 0,
  allocation_pct numeric(6,4) NOT NULL DEFAULT 0,
  allocated_amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_laundry_allocations TO authenticated;
GRANT ALL ON public.expense_laundry_allocations TO service_role;

CREATE INDEX IF NOT EXISTS idx_laundry_bills_period ON public.expense_laundry_bills(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_laundry_allocations_bill ON public.expense_laundry_allocations(bill_id);
CREATE INDEX IF NOT EXISTS idx_laundry_allocations_listing ON public.expense_laundry_allocations(listing_id);

ALTER TABLE public.expense_laundry_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_laundry_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage laundry_bills" ON public.expense_laundry_bills
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role))
  WITH CHECK (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role));

CREATE POLICY "Staff manage laundry_allocations" ON public.expense_laundry_allocations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role))
  WITH CHECK (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role));

-- ===== Storage bucket: expense-receipts =====
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: per-user folder uploads, staff read all, uploaders read own
DROP POLICY IF EXISTS "Receipts: upload own folder" ON storage.objects;
CREATE POLICY "Receipts: upload own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'expense-receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Receipts: read own" ON storage.objects;
CREATE POLICY "Receipts: read own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Receipts: staff read all" ON storage.objects;
CREATE POLICY "Receipts: staff read all" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  );

DROP POLICY IF EXISTS "Receipts: staff manage" ON storage.objects;
CREATE POLICY "Receipts: staff manage" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'expense-receipts'
    AND (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role))
  )
  WITH CHECK (
    bucket_id = 'expense-receipts'
    AND (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role))
  );