
-- 1. Create CCTV observations table (pit book journal)
CREATE TABLE public.cctv_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  observer_id uuid NOT NULL,
  content text NOT NULL,
  observation_type text NOT NULL DEFAULT 'general',
  shift_id uuid REFERENCES public.shifts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cctv_observations ENABLE ROW LEVEL SECURITY;

-- Security users can read observations for their assigned casinos
CREATE POLICY "Security sees assigned casino observations"
  ON public.cctv_observations FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'security') AND user_has_casino_access(auth.uid(), casino_id)
  );

-- Security users can insert observations
CREATE POLICY "Security inserts observations"
  ON public.cctv_observations FOR INSERT TO authenticated
  WITH CHECK (
    observer_id = auth.uid() AND
    has_role(auth.uid(), 'security') AND
    user_has_casino_access(auth.uid(), casino_id)
  );

-- Managers and super admins can read all observations for their casino
CREATE POLICY "Managers see casino observations"
  ON public.cctv_observations FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()) AND has_role(auth.uid(), 'manager'));

CREATE POLICY "Super admins see all observations"
  ON public.cctv_observations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- 2. Add multi-casino SELECT policies for security role on operational tables
-- These use user_has_casino_access() to check assigned casinos

CREATE POLICY "Security sees assigned casino tables"
  ON public.gaming_tables FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'security') AND user_has_casino_access(auth.uid(), casino_id));

CREATE POLICY "Security sees assigned casino shifts"
  ON public.shifts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'security') AND user_has_casino_access(auth.uid(), casino_id));

CREATE POLICY "Security sees assigned casino transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'security') AND user_has_casino_access(auth.uid(), casino_id));

CREATE POLICY "Security sees assigned casino expenses"
  ON public.expenses FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'security') AND user_has_casino_access(auth.uid(), casino_id));

CREATE POLICY "Security sees assigned casino visits"
  ON public.casino_visits FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'security') AND user_has_casino_access(auth.uid(), casino_id));

CREATE POLICY "Security sees assigned casino dealers"
  ON public.dealers FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'security') AND user_has_casino_access(auth.uid(), casino_id));

CREATE POLICY "Security sees assigned casino rota"
  ON public.pit_rota FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'security') AND user_has_casino_access(auth.uid(), casino_id));

CREATE POLICY "Security sees assigned casino attendance"
  ON public.dealer_attendance FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'security') AND user_has_casino_access(auth.uid(), casino_id));

CREATE POLICY "Security sees assigned casino breaklist"
  ON public.breaklist FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'security') AND user_has_casino_access(auth.uid(), casino_id));

CREATE POLICY "Security sees assigned casino logs"
  ON public.activity_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'security') AND user_has_casino_access(auth.uid(), casino_id));

CREATE POLICY "Security sees assigned casino cash counts"
  ON public.cash_counts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'security') AND user_has_casino_access(auth.uid(), casino_id));

CREATE POLICY "Security sees assigned casinos"
  ON public.casinos FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'security') AND user_has_casino_access(auth.uid(), id));

-- Security can add player tags (cross-casino)
CREATE POLICY "Security inserts player tags"
  ON public.player_tags FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'security') AND created_by = auth.uid());

-- Enable realtime for cctv_observations
ALTER PUBLICATION supabase_realtime ADD TABLE public.cctv_observations;
