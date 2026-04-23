
CREATE TABLE public.table_daily_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  date date NOT NULL,
  table_id uuid NOT NULL REFERENCES public.gaming_tables(id) ON DELETE CASCADE,
  open numeric NOT NULL DEFAULT 0,
  fill numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  close numeric NOT NULL DEFAULT 0,
  drop_amount numeric NOT NULL DEFAULT 0,
  result numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'imported' CHECK (source IN ('imported','shift')),
  confirmed boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (casino_id, date, table_id)
);

CREATE INDEX idx_tdr_casino_date ON public.table_daily_results (casino_id, date DESC);
CREATE INDEX idx_tdr_table_date ON public.table_daily_results (table_id, date DESC);

ALTER TABLE public.table_daily_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers see own casino daily results"
ON public.table_daily_results FOR SELECT TO authenticated
USING (
  casino_id = get_user_casino_id(auth.uid())
  AND (has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'finance_manager'::app_role))
);

CREATE POLICY "Surveillance sees assigned casino daily results"
ON public.table_daily_results FOR SELECT TO authenticated
USING (has_role(auth.uid(),'surveillance'::app_role) AND user_has_casino_access(auth.uid(), casino_id));

CREATE POLICY "Super admins see all daily results"
ON public.table_daily_results FOR SELECT TO authenticated
USING (has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "Managers insert daily results"
ON public.table_daily_results FOR INSERT TO authenticated
WITH CHECK (
  casino_id = get_user_casino_id(auth.uid())
  AND created_by = auth.uid()
  AND (has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
);

CREATE POLICY "Managers update daily results"
ON public.table_daily_results FOR UPDATE TO authenticated
USING (
  casino_id = get_user_casino_id(auth.uid())
  AND (has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
);

CREATE POLICY "Managers delete daily results"
ON public.table_daily_results FOR DELETE TO authenticated
USING (
  casino_id = get_user_casino_id(auth.uid())
  AND (has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'super_admin'::app_role))
);

CREATE TRIGGER trg_tdr_updated_at
BEFORE UPDATE ON public.table_daily_results
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
