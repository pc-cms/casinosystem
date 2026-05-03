-- Fix player-photos and player-documents storage RLS so authenticated users
-- (including reception) can upload/replace photos without 403.

-- player-photos: ensure SELECT (public bucket already, but RLS on objects still needed for authenticated path checks)
DROP POLICY IF EXISTS "Authenticated users select player photos" ON storage.objects;
CREATE POLICY "Authenticated users select player photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'player-photos');

DROP POLICY IF EXISTS "Authenticated users delete player photos" ON storage.objects;
CREATE POLICY "Authenticated users delete player photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'player-photos');

-- Recreate INSERT/UPDATE policies bound explicitly to authenticated role
-- (some old policies may be set on `public` which lets anon-token attempts shadow auth)
DROP POLICY IF EXISTS "Authenticated users upload player photos" ON storage.objects;
CREATE POLICY "Authenticated users upload player photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'player-photos');

DROP POLICY IF EXISTS "Authenticated users update player photos" ON storage.objects;
CREATE POLICY "Authenticated users update player photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'player-photos')
  WITH CHECK (bucket_id = 'player-photos');

-- player-documents: same set, scoped to authenticated
DROP POLICY IF EXISTS "Authenticated users select player documents" ON storage.objects;
CREATE POLICY "Authenticated users select player documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'player-documents');

DROP POLICY IF EXISTS "Authenticated users upload player documents" ON storage.objects;
CREATE POLICY "Authenticated users upload player documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'player-documents');

DROP POLICY IF EXISTS "Authenticated users update player documents" ON storage.objects;
CREATE POLICY "Authenticated users update player documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'player-documents')
  WITH CHECK (bucket_id = 'player-documents');

DROP POLICY IF EXISTS "Authenticated users delete player documents" ON storage.objects;
CREATE POLICY "Authenticated users delete player documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'player-documents');