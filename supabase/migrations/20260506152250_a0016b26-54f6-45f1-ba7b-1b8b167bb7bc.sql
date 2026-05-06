ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS photo_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('incident-photos', 'incident-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Incident photos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'incident-photos');

CREATE POLICY "Incident photos staff upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'incident-photos'
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'surveillance'::app_role)
  )
);