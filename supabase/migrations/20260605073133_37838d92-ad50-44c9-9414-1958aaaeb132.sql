CREATE TABLE IF NOT EXISTS public.fin_category_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_norm text NOT NULL UNIQUE,
  alias_original text NOT NULL,
  category_id uuid NOT NULL REFERENCES public.fin_categories(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.fin_category_aliases TO authenticated;
GRANT ALL ON public.fin_category_aliases TO service_role;

ALTER TABLE public.fin_category_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_aliases_read_auth" ON public.fin_category_aliases
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "fin_aliases_write_fm" ON public.fin_category_aliases
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'finance_manager') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'finance_manager') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_fin_aliases_category ON public.fin_category_aliases(category_id);