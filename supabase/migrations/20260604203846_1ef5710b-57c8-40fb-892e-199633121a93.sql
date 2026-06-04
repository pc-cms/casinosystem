
-- Add verified_source to players + revoked status enum + reception/AM RPCs

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS verified_source text
    CHECK (verified_source IS NULL OR verified_source IN ('reception','club_app'));

-- Backfill source for already-verified players where we can infer it (best-effort, leaves nulls otherwise)
UPDATE public.players p
   SET verified_source = 'reception'
 WHERE verification_status = 'verified'
   AND verified_source IS NULL
   AND verified_at IS NOT NULL
   AND EXISTS (SELECT 1 FROM public.kyc_reviews r
                WHERE r.player_id = p.id AND r.source = 'reception'::kyc_review_source);

-- Add 'revoked' to kyc_review_status enum (audit trail of cancelled reception verifies)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'kyc_review_status' AND e.enumlabel = 'revoked'
  ) THEN
    ALTER TYPE public.kyc_review_status ADD VALUE 'revoked';
  END IF;
END $$;


-- ============== RPC: reception_verify_player ==============
CREATE OR REPLACE FUNCTION public.reception_verify_player(
  p_player_id uuid,
  p_first text,
  p_last text,
  p_dob date,
  p_id_number text,
  p_photo_url text DEFAULT NULL,
  p_id_doc_url text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
  v_dup uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (
    public.has_role(v_uid,'reception') OR
    public.has_role(v_uid,'manager') OR
    public.has_role(v_uid,'super_admin') OR
    public.has_role(v_uid,'floor_manager') OR
    public.has_role(v_uid,'account_manager')
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_first IS NULL OR length(trim(p_first)) = 0 THEN RAISE EXCEPTION 'first_name_required'; END IF;
  IF p_last  IS NULL OR length(trim(p_last))  = 0 THEN RAISE EXCEPTION 'last_name_required'; END IF;
  IF p_dob   IS NULL THEN RAISE EXCEPTION 'dob_required'; END IF;
  IF p_id_number IS NULL OR length(trim(p_id_number)) = 0 THEN RAISE EXCEPTION 'id_number_required'; END IF;
  IF p_dob > (current_date - interval '18 years')::date THEN
    RAISE EXCEPTION 'must_be_18_plus';
  END IF;

  SELECT * INTO v_player FROM public.players WHERE id = p_player_id FOR UPDATE;
  IF v_player IS NULL THEN RAISE EXCEPTION 'player_not_found'; END IF;

  -- Duplicate id_number guard (within casino, excluding this player)
  SELECT id INTO v_dup
    FROM public.players
   WHERE casino_id = v_player.casino_id
     AND id <> v_player.id
     AND id_number IS NOT NULL
     AND lower(trim(id_number)) = lower(trim(p_id_number))
   LIMIT 1;
  IF v_dup IS NOT NULL THEN RAISE EXCEPTION 'duplicate_id_number'; END IF;

  UPDATE public.players
     SET first_name = p_first,
         last_name  = p_last,
         birth_date = p_dob,
         id_number  = p_id_number,
         photo_url  = COALESCE(p_photo_url, photo_url),
         id_document_url = COALESCE(p_id_doc_url, id_document_url),
         verification_status = 'verified',
         verified_source = 'reception',
         verified_by = v_uid,
         verified_at = now(),
         updated_at = now()
   WHERE id = p_player_id;

  -- Audit row so AM can see it in "Verified by Reception" tab
  INSERT INTO public.kyc_reviews(player_id, casino_id, source, status, am_user_id, am_decision_at, ai_result)
  VALUES (p_player_id, v_player.casino_id, 'reception', 'approved', v_uid, now(),
          jsonb_build_object('verified_by_reception', true));

  RETURN jsonb_build_object('ok', true, 'player_id', p_player_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.reception_verify_player(uuid,text,text,date,text,text,text) TO authenticated;


-- ============== RPC: kyc_revoke_reception ==============
CREATE OR REPLACE FUNCTION public.kyc_revoke_reception(
  p_player_id uuid,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (
    public.has_role(v_uid,'account_manager') OR
    public.has_role(v_uid,'manager') OR
    public.has_role(v_uid,'super_admin')
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  SELECT * INTO v_player FROM public.players WHERE id = p_player_id FOR UPDATE;
  IF v_player IS NULL THEN RAISE EXCEPTION 'player_not_found'; END IF;
  IF v_player.verified_source IS DISTINCT FROM 'reception' THEN
    RAISE EXCEPTION 'not_reception_verified';
  END IF;

  UPDATE public.players
     SET verification_status = 'unverified',
         verified_source = NULL,
         verified_by = NULL,
         verified_at = NULL,
         updated_at = now()
   WHERE id = p_player_id;

  INSERT INTO public.kyc_reviews(player_id, casino_id, source, status, am_user_id, am_decision_at, am_notes)
  VALUES (p_player_id, v_player.casino_id, 'reception', 'revoked', v_uid, now(), p_reason);

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.kyc_revoke_reception(uuid,text) TO authenticated;
