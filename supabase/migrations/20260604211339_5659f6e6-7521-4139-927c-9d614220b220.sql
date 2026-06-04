-- 1) Extend verified_source CHECK to include 'am_trusted'
ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_verified_source_check;
ALTER TABLE public.players
  ADD CONSTRAINT players_verified_source_check
  CHECK (verified_source IS NULL OR verified_source IN ('reception','club_app','am_trusted'));

-- 2) Add 'trusted_bypass' to kyc_review_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'kyc_review_status' AND e.enumlabel = 'trusted_bypass'
  ) THEN
    ALTER TYPE public.kyc_review_status ADD VALUE 'trusted_bypass';
  END IF;
END $$;

-- 3) RPC: am_trust_player — AM marks player verified without docs
CREATE OR REPLACE FUNCTION public.am_trust_player(
  p_player_id uuid,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_role(v_uid,'account_manager') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'reason_required_min_10';
  END IF;

  SELECT * INTO v_player FROM public.players WHERE id = p_player_id FOR UPDATE;
  IF v_player IS NULL THEN RAISE EXCEPTION 'player_not_found'; END IF;

  UPDATE public.players
     SET verification_status = 'verified',
         verified_source = 'am_trusted',
         verified_by = v_uid,
         verified_at = now(),
         updated_at = now()
   WHERE id = p_player_id;

  INSERT INTO public.kyc_reviews(player_id, casino_id, source, status, am_user_id, am_decision_at, am_notes, ai_result)
  VALUES (p_player_id, v_player.casino_id, 'reception', 'trusted_bypass', v_uid, now(), p_reason,
          jsonb_build_object('am_trusted', true));

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.am_trust_player(uuid,text) TO authenticated;

-- 4) RPC: am_revoke_verification — AM revokes ANY verified player (reception OR trusted)
CREATE OR REPLACE FUNCTION public.am_revoke_verification(
  p_player_id uuid,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_role(v_uid,'account_manager') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  SELECT * INTO v_player FROM public.players WHERE id = p_player_id FOR UPDATE;
  IF v_player IS NULL THEN RAISE EXCEPTION 'player_not_found'; END IF;
  IF v_player.verification_status IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION 'not_verified';
  END IF;

  UPDATE public.players
     SET verification_status = 'unverified',
         verified_source = NULL,
         verified_by = NULL,
         verified_at = NULL,
         updated_at = now()
   WHERE id = p_player_id;

  INSERT INTO public.kyc_reviews(player_id, casino_id, source, status, am_user_id, am_decision_at, am_notes)
  VALUES (p_player_id, v_player.casino_id,
          CASE WHEN v_player.verified_source = 'am_trusted' THEN 'reception'::kyc_review_source
               ELSE COALESCE(v_player.verified_source, 'reception')::kyc_review_source END,
          'revoked', v_uid, now(),
          'Source=' || COALESCE(v_player.verified_source, 'unknown') || '; ' || p_reason);

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.am_revoke_verification(uuid,text) TO authenticated;

-- 5) Make Account Manager network-wide on players SELECT
DROP POLICY IF EXISTS "Players visible within casino access" ON public.players;
CREATE POLICY "Players visible within casino access"
ON public.players
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'finance_manager'::app_role)
  OR has_role(auth.uid(), 'account_manager'::app_role)
  OR user_has_casino_access(auth.uid(), casino_id)
);
