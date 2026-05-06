CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  incident_date date NOT NULL,
  incident_time time NOT NULL,
  cctv_observer text,
  manager text,
  department text,
  employees text,
  table_name text,
  dealer_name text,
  inspector_name text,
  violation_type text,
  incident text NOT NULL,
  outcome text,
  points integer NOT NULL DEFAULT 0,
  comments text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_incidents_casino_date ON public.incidents(casino_id, incident_date DESC, incident_time DESC);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incidents_super_admin_all" ON public.incidents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "incidents_finance_all" ON public.incidents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'finance_manager'::app_role));

CREATE POLICY "incidents_casino_view" ON public.incidents FOR SELECT TO authenticated
  USING (
    casino_id = public.get_user_casino_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'pit'::app_role)
    )
  );

CREATE POLICY "incidents_surveillance_view" ON public.incidents FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'surveillance'::app_role)
    AND public.user_has_casino_access(auth.uid(), casino_id)
  );

CREATE POLICY "incidents_insert" ON public.incidents FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.has_role(auth.uid(), 'super_admin'::app_role)
      OR (
        public.has_role(auth.uid(), 'manager'::app_role)
        AND casino_id = public.get_user_casino_id(auth.uid())
      )
      OR (
        public.has_role(auth.uid(), 'surveillance'::app_role)
        AND public.user_has_casino_access(auth.uid(), casino_id)
      )
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;