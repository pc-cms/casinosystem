-- 1. Permission matrix table
CREATE TABLE IF NOT EXISTS public.user_module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_key text NOT NULL,
  can_view boolean NOT NULL DEFAULT true,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_user_module_permissions_user
  ON public.user_module_permissions (user_id);

ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;

-- Super admin can do everything
CREATE POLICY "Super admins manage module permissions"
  ON public.user_module_permissions
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Users see their own
CREATE POLICY "Users read own module permissions"
  ON public.user_module_permissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- updated_at trigger
CREATE TRIGGER trg_user_module_permissions_updated_at
  BEFORE UPDATE ON public.user_module_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. Casino branding fields
ALTER TABLE public.casinos
  ADD COLUMN IF NOT EXISTS brand_primary_hsl text,
  ADD COLUMN IF NOT EXISTS brand_accent_hsl text,
  ADD COLUMN IF NOT EXISTS logo_url text;


-- 3. Storage bucket for casino branding (logos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('casino-branding', 'casino-branding', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "Casino branding public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'casino-branding');

-- Super admin write
CREATE POLICY "Super admins upload casino branding"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'casino-branding' AND has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins update casino branding"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'casino-branding' AND has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins delete casino branding"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'casino-branding' AND has_role(auth.uid(), 'super_admin'::app_role));