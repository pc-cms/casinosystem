-- Private storage bucket for off-site backups uploaded by on-prem cms-backup containers.
-- Access is restricted: only the service role (used by upload-backup edge function) and
-- super_admin / finance_manager roles can list/download via signed URLs.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('backups', 'backups', false, 5368709120) -- 5 GiB cap
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5368709120;

-- RLS: only super_admin or finance_manager can read backup objects from app code.
-- Service role bypasses RLS, so the upload-backup edge function still works.
DROP POLICY IF EXISTS "backups_admin_read" ON storage.objects;
CREATE POLICY "backups_admin_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'backups'
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'finance_manager'::app_role)
  )
);

DROP POLICY IF EXISTS "backups_no_client_write" ON storage.objects;
CREATE POLICY "backups_no_client_write"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id <> 'backups');