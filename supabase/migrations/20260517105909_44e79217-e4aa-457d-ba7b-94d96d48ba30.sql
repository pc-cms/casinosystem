-- Open installer-snapshots bucket: public read for latest.ndjson.gz so installer can download without auth.
UPDATE storage.buckets SET public = true WHERE id = 'installer-snapshots';

-- RLS policy on storage.objects: public can read installer-snapshots only
DROP POLICY IF EXISTS "installer_snapshots_public_read" ON storage.objects;
CREATE POLICY "installer_snapshots_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'installer-snapshots');

-- Only super_admin (via service role from edge function) can write
DROP POLICY IF EXISTS "installer_snapshots_service_write" ON storage.objects;
CREATE POLICY "installer_snapshots_service_write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'installer-snapshots' AND auth.role() = 'service_role');