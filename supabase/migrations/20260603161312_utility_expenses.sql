-- Meeting spec item 10: Expenses → Utilities tab
--
-- A utility expense (type/date/value) split across selected properties. Default is an
-- even split by count; ratios are editable and must sum to 100% (enforced in the UI).
-- Allocations carry a denormalised expense_date + amount so the owner report can sum
-- them per listing/period with a simple filter (same shape as laundry/consumable charges).

CREATE TABLE IF NOT EXISTS public.utility_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,                         -- e.g. Electricity, Gas, Water, Internet
  expense_date date NOT NULL,
  value numeric(10,2) NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.utility_expense_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utility_expense_id uuid NOT NULL REFERENCES public.utility_expenses(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  attribution_pct numeric(6,3) NOT NULL,
  amount numeric(10,2) NOT NULL,              -- value * attribution_pct / 100
  expense_date date NOT NULL,                 -- denormalised from parent for period queries
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (utility_expense_id, listing_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.utility_expenses, public.utility_expense_allocations TO authenticated;
GRANT ALL ON public.utility_expenses, public.utility_expense_allocations TO service_role;

CREATE INDEX IF NOT EXISTS idx_utility_allocations_listing ON public.utility_expense_allocations(listing_id);
CREATE INDEX IF NOT EXISTS idx_utility_allocations_date ON public.utility_expense_allocations(expense_date);
CREATE INDEX IF NOT EXISTS idx_utility_allocations_expense ON public.utility_expense_allocations(utility_expense_id);

DROP TRIGGER IF EXISTS trg_utility_expenses_updated_at ON public.utility_expenses;
CREATE TRIGGER trg_utility_expenses_updated_at BEFORE UPDATE ON public.utility_expenses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.utility_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utility_expense_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage utility_expenses" ON public.utility_expenses;
CREATE POLICY "Staff manage utility_expenses" ON public.utility_expenses
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS "Staff manage utility_allocations" ON public.utility_expense_allocations;
CREATE POLICY "Staff manage utility_allocations" ON public.utility_expense_allocations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super'::app_role) OR has_role(auth.uid(),'senior'::app_role) OR has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS "Owners read utility_allocations" ON public.utility_expense_allocations;
CREATE POLICY "Owners read utility_allocations" ON public.utility_expense_allocations
  FOR SELECT TO authenticated USING (owner_owns_listing(auth.uid(), listing_id));
