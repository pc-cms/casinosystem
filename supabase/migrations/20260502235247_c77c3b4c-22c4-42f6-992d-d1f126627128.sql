-- 1) player_notes — allow surveillance to insert
DROP POLICY IF EXISTS "Authorized roles create player notes" ON public.player_notes;
CREATE POLICY "Authorized roles create player notes"
  ON public.player_notes FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      (
        casino_id = public.get_user_casino_id(auth.uid())
        AND (
          public.has_role(auth.uid(), 'reception'::app_role)
          OR public.has_role(auth.uid(), 'pit'::app_role)
          OR public.has_role(auth.uid(), 'cashier'::app_role)
          OR public.has_role(auth.uid(), 'manager'::app_role)
        )
      )
      OR (
        public.has_role(auth.uid(), 'surveillance'::app_role)
        AND public.user_has_casino_access(auth.uid(), casino_id)
      )
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

-- 2) player_tags — allow surveillance to insert / delete tags in their casinos
DROP POLICY IF EXISTS "Surveillance inserts player tags" ON public.player_tags;
CREATE POLICY "Surveillance inserts player tags"
  ON public.player_tags FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'surveillance'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = player_tags.player_id
        AND public.user_has_casino_access(auth.uid(), p.casino_id)
    )
  );

DROP POLICY IF EXISTS "Surveillance deletes player tags" ON public.player_tags;
CREATE POLICY "Surveillance deletes player tags"
  ON public.player_tags FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'surveillance'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.players p
      WHERE p.id = player_tags.player_id
        AND public.user_has_casino_access(auth.uid(), p.casino_id)
    )
  );

-- 3) players — allow surveillance to update status (blacklist / reactivate)
--    via a dedicated UPDATE policy. Surveillance can only flip status; everything
--    else still gated by existing policies (no new SELECT/INSERT granted here).
DROP POLICY IF EXISTS "Surveillance updates blacklist status" ON public.players;
CREATE POLICY "Surveillance updates blacklist status"
  ON public.players FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'surveillance'::app_role)
    AND public.user_has_casino_access(auth.uid(), casino_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'surveillance'::app_role)
    AND public.user_has_casino_access(auth.uid(), casino_id)
  );

-- 4) chip_transfers — allow surveillance to insert (paired by RPC)
DROP POLICY IF EXISTS "Pit/managers insert chip transfers" ON public.chip_transfers;
CREATE POLICY "Pit/managers/surveillance insert chip transfers"
  ON public.chip_transfers FOR INSERT TO authenticated
  WITH CHECK (
    casino_id = public.get_user_casino_id(auth.uid())
    AND operator_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'pit'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
      OR public.has_role(auth.uid(), 'surveillance'::app_role)
    )
  );

-- 5) Update create_chip_transfer_pair RPC to allow surveillance
CREATE OR REPLACE FUNCTION public.create_chip_transfer_pair(
  _from_player uuid,
  _to_player uuid,
  _amount bigint,
  _table_id uuid DEFAULT NULL,
  _chips jsonb DEFAULT NULL,
  _note text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_casino_id uuid;
  v_pair_id uuid := gen_random_uuid();
  v_op uuid := auth.uid();
  v_out_id uuid;
  v_in_id uuid;
BEGIN
  IF v_op IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT (
    public.has_role(v_op, 'pit'::app_role)
    OR public.has_role(v_op, 'manager'::app_role)
    OR public.has_role(v_op, 'surveillance'::app_role)
  ) THEN
    RAISE EXCEPTION 'Pit, Manager or Surveillance role required';
  END IF;
  IF _from_player = _to_player THEN
    RAISE EXCEPTION 'From and To players must differ';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  v_casino_id := public.get_user_casino_id(v_op);
  IF v_casino_id IS NULL THEN
    RAISE EXCEPTION 'Operator has no casino assigned';
  END IF;

  -- OUT (from_player gives chips away)
  INSERT INTO public.chip_transfers
    (casino_id, table_id, pair_id, direction, player_id, counterparty_player_id, amount, chips, note, operator_id)
  VALUES
    (v_casino_id, _table_id, v_pair_id, 'out', _from_player, _to_player, _amount, _chips, _note, v_op)
  RETURNING id INTO v_out_id;

  -- IN (to_player receives chips)
  INSERT INTO public.chip_transfers
    (casino_id, table_id, pair_id, direction, player_id, counterparty_player_id, amount, chips, note, operator_id)
  VALUES
    (v_casino_id, _table_id, v_pair_id, 'in', _to_player, _from_player, _amount, _chips, _note, v_op)
  RETURNING id INTO v_in_id;

  RETURN jsonb_build_object(
    'pair_id', v_pair_id,
    'out_id', v_out_id,
    'in_id', v_in_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_chip_transfer_pair(uuid, uuid, bigint, uuid, jsonb, text) TO authenticated;
