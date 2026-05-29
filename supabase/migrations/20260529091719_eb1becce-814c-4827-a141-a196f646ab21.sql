
-- M10a: POS shift segmentation (day/evening/night) + handover flow

ALTER TABLE public.pos_shifts
  ADD COLUMN IF NOT EXISTS shift_type text NOT NULL DEFAULT 'evening',
  ADD COLUMN IF NOT EXISTS handover_from_shift_id uuid REFERENCES public.pos_shifts(id);

ALTER TABLE public.pos_shifts
  DROP CONSTRAINT IF EXISTS pos_shifts_shift_type_chk;
ALTER TABLE public.pos_shifts
  ADD CONSTRAINT pos_shifts_shift_type_chk
  CHECK (shift_type IN ('day','evening','night'));

CREATE INDEX IF NOT EXISTS idx_pos_shifts_business_date_type
  ON public.pos_shifts(casino_id, business_date, shift_type);

-- Allow the guard trigger to update closing_cash + closed_at + z_report only.
-- Existing guard already prevents mutation after close — no change needed.

-- ===================================================================
-- pos_handover_shift: atomically close current shift and open the next.
-- Caller (outgoing waiter or pos_manager) closes; new waiter must be
-- supplied. Opening cash of new shift = closing cash of outgoing.
-- ===================================================================
CREATE OR REPLACE FUNCTION public.pos_handover_shift(
  _closing_shift_id uuid,
  _new_waiter_user_id uuid,
  _new_shift_type text,
  _closing_cash bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outgoing public.pos_shifts%ROWTYPE;
  v_z jsonb;
  v_new_id uuid;
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF _new_shift_type NOT IN ('day','evening','night') THEN
    RAISE EXCEPTION 'invalid shift_type %', _new_shift_type;
  END IF;

  SELECT * INTO v_outgoing FROM public.pos_shifts WHERE id = _closing_shift_id FOR UPDATE;
  IF v_outgoing.id IS NULL THEN
    RAISE EXCEPTION 'shift not found';
  END IF;
  IF v_outgoing.closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'shift already closed';
  END IF;

  -- Authorisation: outgoing waiter himself, or pos_manager, or super_admin
  IF v_outgoing.waiter_user_id <> v_caller
     AND NOT public.has_role(v_caller, 'pos_manager'::app_role)
     AND NOT public.has_role(v_caller, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'not allowed to close this shift';
  END IF;

  -- Refuse handover while there are still open tabs
  IF EXISTS (
    SELECT 1 FROM public.pos_tabs
    WHERE shift_id = v_outgoing.id AND closed_at IS NULL AND voided_at IS NULL
  ) THEN
    RAISE EXCEPTION 'close all open tabs before handover';
  END IF;

  -- Close outgoing via existing RPC so z_report logic stays single-source
  v_z := public.pos_close_shift(_closing_shift_id, _closing_cash);

  -- Open new shift for incoming waiter, opening_cash = closing_cash
  INSERT INTO public.pos_shifts (
    casino_id, waiter_user_id, opening_cash, shift_type, handover_from_shift_id
  )
  VALUES (
    v_outgoing.casino_id, _new_waiter_user_id, _closing_cash, _new_shift_type, v_outgoing.id
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'closed_shift_id', v_outgoing.id,
    'new_shift_id', v_new_id,
    'z_report', v_z
  );
END $$;

GRANT EXECUTE ON FUNCTION public.pos_handover_shift(uuid, uuid, text, bigint) TO authenticated;
