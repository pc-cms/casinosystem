CREATE OR REPLACE FUNCTION public.am_trust_player(p_player_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (public.has_role(v_uid,'account_manager') OR public.has_role(v_uid,'super_admin')) THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.am_revoke_verification(p_player_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (public.has_role(v_uid,'account_manager') OR public.has_role(v_uid,'super_admin')) THEN
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
$function$;