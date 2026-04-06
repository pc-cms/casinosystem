CREATE POLICY "HR insert staff"
ON public.staff_members
FOR INSERT
TO authenticated
WITH CHECK (
  (casino_id = get_user_casino_id(auth.uid()))
  AND has_role(auth.uid(), 'hr'::app_role)
);

CREATE POLICY "HR update staff"
ON public.staff_members
FOR UPDATE
TO authenticated
USING (
  (casino_id = get_user_casino_id(auth.uid()))
  AND has_role(auth.uid(), 'hr'::app_role)
);

CREATE POLICY "HR insert staff rota"
ON public.staff_rota
FOR INSERT
TO authenticated
WITH CHECK (
  (casino_id = get_user_casino_id(auth.uid()))
  AND has_role(auth.uid(), 'hr'::app_role)
);

CREATE POLICY "HR update staff rota"
ON public.staff_rota
FOR UPDATE
TO authenticated
USING (
  (casino_id = get_user_casino_id(auth.uid()))
  AND has_role(auth.uid(), 'hr'::app_role)
);

CREATE POLICY "HR delete staff rota"
ON public.staff_rota
FOR DELETE
TO authenticated
USING (
  (casino_id = get_user_casino_id(auth.uid()))
  AND has_role(auth.uid(), 'hr'::app_role)
);

CREATE POLICY "HR insert staff attendance"
ON public.staff_attendance
FOR INSERT
TO authenticated
WITH CHECK (
  (casino_id = get_user_casino_id(auth.uid()))
  AND has_role(auth.uid(), 'hr'::app_role)
);

CREATE POLICY "HR update staff attendance"
ON public.staff_attendance
FOR UPDATE
TO authenticated
USING (
  (casino_id = get_user_casino_id(auth.uid()))
  AND has_role(auth.uid(), 'hr'::app_role)
);

CREATE POLICY "HR insert dealers"
ON public.dealers
FOR INSERT
TO authenticated
WITH CHECK (
  (casino_id = get_user_casino_id(auth.uid()))
  AND has_role(auth.uid(), 'hr'::app_role)
);

CREATE POLICY "HR update dealers"
ON public.dealers
FOR UPDATE
TO authenticated
USING (
  (casino_id = get_user_casino_id(auth.uid()))
  AND has_role(auth.uid(), 'hr'::app_role)
);

CREATE POLICY "HR insert pit rota"
ON public.pit_rota
FOR INSERT
TO authenticated
WITH CHECK (
  (casino_id = get_user_casino_id(auth.uid()))
  AND has_role(auth.uid(), 'hr'::app_role)
);

CREATE POLICY "HR update pit rota"
ON public.pit_rota
FOR UPDATE
TO authenticated
USING (
  (casino_id = get_user_casino_id(auth.uid()))
  AND has_role(auth.uid(), 'hr'::app_role)
);

CREATE POLICY "HR delete pit rota"
ON public.pit_rota
FOR DELETE
TO authenticated
USING (
  (casino_id = get_user_casino_id(auth.uid()))
  AND has_role(auth.uid(), 'hr'::app_role)
);

CREATE POLICY "HR insert dealer attendance"
ON public.dealer_attendance
FOR INSERT
TO authenticated
WITH CHECK (
  (casino_id = get_user_casino_id(auth.uid()))
  AND has_role(auth.uid(), 'hr'::app_role)
);

CREATE POLICY "HR update dealer attendance"
ON public.dealer_attendance
FOR UPDATE
TO authenticated
USING (
  (casino_id = get_user_casino_id(auth.uid()))
  AND has_role(auth.uid(), 'hr'::app_role)
);