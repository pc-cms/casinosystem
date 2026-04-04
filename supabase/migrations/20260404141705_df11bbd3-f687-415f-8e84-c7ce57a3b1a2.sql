
-- Make player-documents bucket private
UPDATE storage.buckets SET public = false WHERE id = 'player-documents';

-- RLS: authenticated users can read documents from their casino
CREATE POLICY "Authenticated users read player documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'player-documents'
  AND (storage.foldername(name))[1] = (SELECT casino_id::text FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
);

-- RLS: reception and manager can upload documents
CREATE POLICY "Authorized roles upload player documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'player-documents'
  AND (storage.foldername(name))[1] = (SELECT casino_id::text FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  AND (public.has_role(auth.uid(), 'reception') OR public.has_role(auth.uid(), 'manager'))
);

-- RLS: authorized roles can update (upsert) documents
CREATE POLICY "Authorized roles update player documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'player-documents'
  AND (storage.foldername(name))[1] = (SELECT casino_id::text FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  AND (public.has_role(auth.uid(), 'reception') OR public.has_role(auth.uid(), 'manager'))
);
