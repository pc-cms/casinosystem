CREATE OR REPLACE FUNCTION public.cancel_transaction(p_transaction_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tx public.transactions;
  v_shift_closed timestamptz;
  v_uid uuid := auth.uid();
  v_allowed boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'Reason is required (min 3 chars)' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_tx FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_tx.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Transaction already cancelled' USING ERRCODE = '22023';
  END IF;

  v_allowed := public.has_role(v_uid, 'cashier'::app_role)
            OR public.has_role(v_uid, 'manager'::app_role)
            OR public.has_role(v_uid, 'floor_manager'::app_role)
            OR public.has_role(v_uid, 'super_admin'::app_role);
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Your role cannot cancel transactions (cashier / manager / floor_manager / super_admin required)'
      USING ERRCODE = '42501';
  END IF;

  IF v_tx.shift_id IS NOT NULL THEN
    SELECT closed_at INTO v_shift_closed FROM public.shifts WHERE id = v_tx.shift_id;
    IF v_shift_closed IS NOT NULL
       AND NOT (public.has_role(v_uid, 'manager'::app_role)
                OR public.has_role(v_uid, 'super_admin'::app_role)) THEN
      RAISE EXCEPTION 'Cannot cancel: shift already closed (manager override required)'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.transactions
    SET cancelled_at = now(),
        cancelled_by = v_uid,
        cancel_reason = btrim(p_reason)
    WHERE id = p_transaction_id;
END;
$function$;