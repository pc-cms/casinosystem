
-- 1. club_accounts: remove reception/cashier/manager SELECT (not used in client; edge functions use service role)
DROP POLICY IF EXISTS "Reception/cashier read club_accounts same casino" ON public.club_accounts;

-- 2. employee-photos: add casino folder isolation; super_admin + finance_manager keep network-wide
DROP POLICY IF EXISTS "employee_photos_select" ON storage.objects;
CREATE POLICY "employee_photos_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'employee-photos'
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'finance_manager'::app_role)
      OR (
        (has_role(auth.uid(), 'hr'::app_role)
          OR has_role(auth.uid(), 'manager'::app_role)
          OR has_role(auth.uid(), 'surveillance'::app_role))
        AND (storage.foldername(name))[1] = (
          SELECT employees.id::text FROM employees
          WHERE employees.casino_id = get_user_casino_id(auth.uid())
            AND employees.id::text = (storage.foldername(name))[1]
          LIMIT 1
        )
      )
    )
  );
