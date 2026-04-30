
-- Public buckets are read via CDN/public URL — RLS SELECT policies are not needed
-- and only enable bucket listing. Drop them.
DROP POLICY IF EXISTS "Authenticated read employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read player photos"   ON storage.objects;
-- player-documents is private (public=false) — keep its existing role policies; do not drop.
DROP POLICY IF EXISTS "Authenticated read player documents" ON storage.objects;
