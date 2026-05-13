CREATE OR REPLACE FUNCTION public.reopen_shift(_shift_id uuid, _reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_casino uuid;
  v_shift public.shifts%ROWTYPE;
  v_other_open uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (public.has_role(v_user, 'manager'::app_role)
       OR public.has_role(v_user, 'super_admin'::app_role)
       OR public.has_role(v_user, 'finance_manager'::app_role)) THEN
    RAISE EXCEPTION 'Insufficient privileges to reopen shift';
  END IF;

  SELECT * INTO v_shift FROM public.shifts WHERE id = _shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift not found';
  END IF;
  IF v_shift.status <> 'closed' THEN
    RAISE EXCEPTION 'Shift is not closed';
  END IF;

  v_casino := v_shift.casino_id;

  -- Block if another shift is already open in this casino
  SELECT id INTO v_other_open
  FROM public.shifts
  WHERE casino_id = v_casino AND status = 'open' AND id <> _shift_id
  LIMIT 1;
  IF v_other_open IS NOT NULL THEN
    RAISE EXCEPTION 'Another shift is currently open for this casino';
  END IF;

  -- Audit BEFORE mutation (write to activity_logs, not the legacy system_logs name)
  INSERT INTO public.activity_logs (casino_id, operator_id, category, action, details)
  VALUES (
    v_casino, v_user, 'system'::log_category, 'SHIFT_REOPENED',
    jsonb_build_object(
      'shift_id', _shift_id,
      'reason', _reason,
      'previous', jsonb_build_object(
        'closed_at', v_shift.closed_at,
        'closed_by', v_shift.closed_by,
        'cash_result', v_shift.cash_result,
        'miss_total', v_shift.miss_total,
        'shift_result', v_shift.shift_result,
        'closing_count', v_shift.closing_count,
        'closing_cash', v_shift.closing_cash,
        'notes', v_shift.notes
      )
    )
  );

  UPDATE public.shifts
     SET status = 'open',
         closed_at = NULL,
         closed_by = NULL,
         closing_count = NULL,
         closing_cash = NULL,
         cash_result = NULL,
         miss_total = NULL,
         shift_result = NULL,
         notes = NULL
   WHERE id = _shift_id;

  RETURN jsonb_build_object('status','reopened','shift_id', _shift_id);
END;
$function$;