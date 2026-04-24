-- 1. Bank checks table
CREATE TABLE public.bank_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  casino_id UUID NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  check_date DATE NOT NULL,
  check_time TIME,
  receipt_no TEXT NOT NULL DEFAULT '',
  approval_code TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'TZS',
  bank TEXT NOT NULL DEFAULT '',
  merchant TEXT NOT NULL DEFAULT '',
  card_masked TEXT NOT NULL DEFAULT '',
  photo_url TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique approval code per casino (when present)
CREATE UNIQUE INDEX bank_checks_approval_unique
  ON public.bank_checks (casino_id, approval_code)
  WHERE approval_code <> '';

CREATE INDEX bank_checks_casino_date_idx
  ON public.bank_checks (casino_id, check_date DESC, check_time DESC);

ALTER TABLE public.bank_checks ENABLE ROW LEVEL SECURITY;

-- Casino fm/managers see their checks
CREATE POLICY "Casino fm/managers see bank checks"
ON public.bank_checks FOR SELECT TO authenticated
USING (
  (casino_id = get_user_casino_id(auth.uid()))
  AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role))
);

CREATE POLICY "Super admin/FM see all bank checks"
ON public.bank_checks FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role));

CREATE POLICY "Casino fm/managers insert bank checks"
ON public.bank_checks FOR INSERT TO authenticated
WITH CHECK (
  (casino_id = get_user_casino_id(auth.uid()))
  AND (created_by = auth.uid())
  AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role))
);

CREATE POLICY "Casino fm/managers update bank checks"
ON public.bank_checks FOR UPDATE TO authenticated
USING (
  (casino_id = get_user_casino_id(auth.uid()))
  AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role))
);

CREATE POLICY "Casino fm/managers delete bank checks"
ON public.bank_checks FOR DELETE TO authenticated
USING (
  (casino_id = get_user_casino_id(auth.uid()))
  AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role))
);

-- updated_at trigger
CREATE TRIGGER bank_checks_set_updated_at
BEFORE UPDATE ON public.bank_checks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('bank-checks', 'bank-checks', false)
ON CONFLICT (id) DO NOTHING;

-- Bucket policies: managers/finance_managers of the casino (folder = casino_id)
CREATE POLICY "Casino fm/managers read bank check photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'bank-checks'
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'finance_manager'::app_role)
    OR (
      (storage.foldername(name))[1] = get_user_casino_id(auth.uid())::text
      AND has_role(auth.uid(), 'manager'::app_role)
    )
  )
);

CREATE POLICY "Casino fm/managers upload bank check photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'bank-checks'
  AND (storage.foldername(name))[1] = get_user_casino_id(auth.uid())::text
  AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role))
);

CREATE POLICY "Casino fm/managers delete bank check photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'bank-checks'
  AND (storage.foldername(name))[1] = get_user_casino_id(auth.uid())::text
  AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role))
);