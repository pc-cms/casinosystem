
-- Cash count snapshots for physical cash audits
CREATE TABLE public.cash_count_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  wallet_type public.wallet_type NOT NULL,
  currency text NOT NULL DEFAULT 'TZS',
  denominations jsonb NOT NULL DEFAULT '{}'::jsonb,
  physical_total numeric NOT NULL DEFAULT 0,
  expected_balance numeric NOT NULL DEFAULT 0,
  discrepancy numeric NOT NULL DEFAULT 0,
  exchange_rate numeric NOT NULL DEFAULT 1,
  physical_total_tzs numeric NOT NULL DEFAULT 0,
  counted_by uuid NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_count_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino fm/managers see cash counts"
ON public.cash_count_snapshots FOR SELECT TO authenticated
USING (casino_id = get_user_casino_id(auth.uid()) 
  AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role)));

CREATE POLICY "Casino fm/managers insert cash counts"
ON public.cash_count_snapshots FOR INSERT TO authenticated
WITH CHECK (casino_id = get_user_casino_id(auth.uid()) 
  AND counted_by = auth.uid()
  AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role)));
