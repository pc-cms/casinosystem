
-- Shifts table: one active shift per casino at a time
CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opened_by uuid NOT NULL,
  closed_by uuid,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  exchange_rates jsonb NOT NULL DEFAULT '{"USD": 2500, "EUR": 2700}'::jsonb,
  opening_float jsonb,
  closing_count jsonb,
  closing_cash jsonb,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only one open shift per casino
CREATE UNIQUE INDEX shifts_one_open_per_casino ON public.shifts (casino_id) WHERE status = 'open';

-- Link transactions to shifts
ALTER TABLE public.transactions ADD COLUMN shift_id uuid REFERENCES public.shifts(id);

-- Link expenses to shifts
ALTER TABLE public.expenses ADD COLUMN shift_id uuid REFERENCES public.shifts(id);

-- Cash counts per shift (multi-currency snapshots)
CREATE TABLE public.cash_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  shift_id uuid NOT NULL REFERENCES public.shifts(id),
  count_type text NOT NULL CHECK (count_type IN ('opening', 'closing', 'check')),
  currency text NOT NULL DEFAULT 'TZS',
  denominations jsonb NOT NULL DEFAULT '{}'::jsonb,
  total numeric NOT NULL DEFAULT 0,
  counted_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for shifts
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino users see shifts" ON public.shifts
  FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()));

CREATE POLICY "Cashiers open shifts" ON public.shifts
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = get_user_casino_id(auth.uid()) AND opened_by = auth.uid()
    AND (has_role(auth.uid(), 'cashier') OR has_role(auth.uid(), 'manager')));

CREATE POLICY "Cashiers close shifts" ON public.shifts
  FOR UPDATE TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid())
    AND (has_role(auth.uid(), 'cashier') OR has_role(auth.uid(), 'manager')));

-- RLS for cash_counts
ALTER TABLE public.cash_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino users see cash counts" ON public.cash_counts
  FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()));

CREATE POLICY "Cashiers insert cash counts" ON public.cash_counts
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = get_user_casino_id(auth.uid()) AND counted_by = auth.uid()
    AND (has_role(auth.uid(), 'cashier') OR has_role(auth.uid(), 'manager')));
