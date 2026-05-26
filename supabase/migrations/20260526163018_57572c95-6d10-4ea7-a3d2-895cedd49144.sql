CREATE OR REPLACE FUNCTION public.approve_expense_as_manager(
  p_expense_id uuid,
  p_manager_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_casino uuid;
  v_expense_casino uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_manager_op(p_manager_id) THEN
    RAISE EXCEPTION 'Provided user is not a manager';
  END IF;
  SELECT public.get_user_casino_id(auth.uid()) INTO v_caller_casino;
  SELECT casino_id INTO v_expense_casino FROM public.expenses WHERE id = p_expense_id;
  IF v_expense_casino IS NULL THEN
    RAISE EXCEPTION 'Expense not found';
  END IF;
  IF v_expense_casino <> v_caller_casino THEN
    RAISE EXCEPTION 'Casino mismatch';
  END IF;
  UPDATE public.expenses
    SET approved = true,
        approved_by = p_manager_id,
        approved_at = now()
    WHERE id = p_expense_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_expense_as_manager(uuid, uuid) TO authenticated;