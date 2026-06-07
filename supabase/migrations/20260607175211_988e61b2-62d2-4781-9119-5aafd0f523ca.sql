
CREATE TABLE public.fin_daily_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  business_date date NOT NULL,
  currency text NOT NULL,
  rate_to_tzs numeric(18,6) NOT NULL,
  set_by uuid,
  set_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (casino_id, business_date, currency)
);

CREATE INDEX fin_daily_rates_casino_date_idx
  ON public.fin_daily_rates (casino_id, business_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_daily_rates TO authenticated;
GRANT ALL ON public.fin_daily_rates TO service_role;

ALTER TABLE public.fin_daily_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fdr_read" ON public.fin_daily_rates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "fdr_write" ON public.fin_daily_rates
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'finance_manager'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'finance_manager'::app_role)
  );

CREATE TRIGGER trg_fdr_upd
  BEFORE UPDATE ON public.fin_daily_rates
  FOR EACH ROW EXECUTE FUNCTION public.fin_touch_updated_at();

-- Backfill today's rates from latest cage shift per (casino, currency).
INSERT INTO public.fin_daily_rates (casino_id, business_date, currency, rate_to_tzs, set_at)
SELECT DISTINCT ON (r.casino_id, r.currency_code)
  r.casino_id,
  CURRENT_DATE AS business_date,
  r.currency_code AS currency,
  r.rate_to_tzs,
  now()
FROM public.cage_slots_exchange_rates r
JOIN public.cage_slots_shifts s ON s.id = r.cage_slots_shift_id
WHERE r.rate_to_tzs > 0
ORDER BY r.casino_id, r.currency_code, s.opened_at DESC NULLS LAST
ON CONFLICT (casino_id, business_date, currency) DO NOTHING;
