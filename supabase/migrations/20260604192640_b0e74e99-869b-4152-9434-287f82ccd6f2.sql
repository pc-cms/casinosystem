-- Default new players to unverified instead of pending (self-service KYC flow)
ALTER TABLE public.players ALTER COLUMN verification_status SET DEFAULT 'unverified'::player_verification_status;

-- ============================================================
-- club_self_register_minimal: phone + name + DOB → player + club_account
-- ============================================================
CREATE OR REPLACE FUNCTION public.club_self_register_minimal(
  _phone text,
  _first text,
  _last text,
  _dob date,
  _casino_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_casino_id uuid;
  v_player_id uuid;
  v_age int;
BEGIN
  IF _phone IS NULL OR length(trim(_phone)) < 8 THEN
    RAISE EXCEPTION 'invalid_phone';
  END IF;
  IF _first IS NULL OR length(trim(_first)) = 0 THEN
    RAISE EXCEPTION 'invalid_first_name';
  END IF;
  IF _last IS NULL OR length(trim(_last)) = 0 THEN
    RAISE EXCEPTION 'invalid_last_name';
  END IF;
  IF _dob IS NULL THEN
    RAISE EXCEPTION 'invalid_dob';
  END IF;
  v_age := date_part('year', age(_dob))::int;
  IF v_age < 18 THEN
    RAISE EXCEPTION 'underage';
  END IF;

  SELECT id INTO v_casino_id FROM casinos WHERE slug = COALESCE(_casino_slug, 'arusha');
  IF v_casino_id IS NULL THEN
    SELECT id INTO v_casino_id FROM casinos WHERE slug = 'arusha';
  END IF;
  IF v_casino_id IS NULL THEN
    RAISE EXCEPTION 'invalid_casino';
  END IF;

  IF EXISTS (SELECT 1 FROM players WHERE phone = _phone) THEN
    RAISE EXCEPTION 'duplicate_phone';
  END IF;

  INSERT INTO players (
    casino_id, first_name, last_name, phone, id_number, birth_date,
    verification_status, status, category, player_type
  ) VALUES (
    v_casino_id, trim(_first), trim(_last), _phone, '', _dob,
    'unverified', 'active', 'normal', 'table'
  ) RETURNING id INTO v_player_id;

  INSERT INTO club_accounts (player_id, phone)
  VALUES (v_player_id, _phone)
  ON CONFLICT (phone) DO UPDATE SET player_id = EXCLUDED.player_id;

  RETURN jsonb_build_object('player_id', v_player_id, 'casino_id', v_casino_id);
END;
$$;

-- ============================================================
-- club_update_profile: editable while unverified only
-- ============================================================
CREATE OR REPLACE FUNCTION public.club_update_profile(
  _player_id uuid,
  _first text,
  _last text,
  _dob date,
  _id_number text,
  _casino_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status player_verification_status;
  v_casino_id uuid;
BEGIN
  SELECT verification_status INTO v_status FROM players WHERE id = _player_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'player_not_found';
  END IF;
  IF v_status NOT IN ('unverified') THEN
    RAISE EXCEPTION 'profile_locked';
  END IF;

  IF _first IS NULL OR length(trim(_first)) = 0 THEN
    RAISE EXCEPTION 'invalid_first_name';
  END IF;
  IF _last IS NULL OR length(trim(_last)) = 0 THEN
    RAISE EXCEPTION 'invalid_last_name';
  END IF;
  IF _dob IS NULL THEN
    RAISE EXCEPTION 'invalid_dob';
  END IF;
  IF date_part('year', age(_dob))::int < 18 THEN
    RAISE EXCEPTION 'underage';
  END IF;

  IF _casino_slug IS NOT NULL AND length(trim(_casino_slug)) > 0 THEN
    SELECT id INTO v_casino_id FROM casinos WHERE slug = _casino_slug;
    IF v_casino_id IS NULL THEN
      RAISE EXCEPTION 'invalid_casino';
    END IF;
  END IF;

  IF _id_number IS NOT NULL AND length(trim(_id_number)) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM players
      WHERE id_number = trim(_id_number)
        AND id_number <> ''
        AND id <> _player_id
    ) THEN
      RAISE EXCEPTION 'duplicate_id';
    END IF;
  END IF;

  UPDATE players SET
    first_name = trim(_first),
    last_name = trim(_last),
    birth_date = _dob,
    id_number = COALESCE(trim(_id_number), ''),
    casino_id = COALESCE(v_casino_id, casino_id),
    updated_at = now()
  WHERE id = _player_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================
-- club_submit_kyc: save photo URLs, lock profile, open kyc review
-- ============================================================
CREATE OR REPLACE FUNCTION public.club_submit_kyc(
  _player_id uuid,
  _first text,
  _last text,
  _dob date,
  _id_number text,
  _selfie_url text,
  _id_front_url text,
  _id_back_url text,
  _ocr jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status player_verification_status;
  v_casino_id uuid;
  v_review_id uuid;
BEGIN
  SELECT verification_status, casino_id INTO v_status, v_casino_id FROM players WHERE id = _player_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'player_not_found';
  END IF;
  IF v_status <> 'unverified' THEN
    RAISE EXCEPTION 'already_submitted';
  END IF;

  IF _first IS NULL OR length(trim(_first)) = 0 THEN RAISE EXCEPTION 'invalid_first_name'; END IF;
  IF _last  IS NULL OR length(trim(_last))  = 0 THEN RAISE EXCEPTION 'invalid_last_name';  END IF;
  IF _dob   IS NULL                              THEN RAISE EXCEPTION 'invalid_dob';        END IF;
  IF _id_number IS NULL OR length(trim(_id_number)) = 0 THEN RAISE EXCEPTION 'invalid_id_number'; END IF;
  IF _selfie_url IS NULL OR _id_front_url IS NULL OR _id_back_url IS NULL THEN
    RAISE EXCEPTION 'missing_photos';
  END IF;

  IF EXISTS (
    SELECT 1 FROM players
    WHERE id_number = trim(_id_number)
      AND id_number <> ''
      AND id <> _player_id
  ) THEN
    RAISE EXCEPTION 'duplicate_id';
  END IF;

  UPDATE players SET
    first_name = trim(_first),
    last_name  = trim(_last),
    birth_date = _dob,
    id_number  = trim(_id_number),
    photo_url  = _selfie_url,
    id_document_url = _id_front_url,
    verification_status = 'pending',
    updated_at = now()
  WHERE id = _player_id;

  INSERT INTO kyc_reviews (player_id, casino_id, source, status, ai_result)
  VALUES (
    _player_id,
    v_casino_id,
    'club_app',
    'pending',
    COALESCE(_ocr, '{}'::jsonb)
      || jsonb_build_object(
        'selfie_url', _selfie_url,
        'id_front_url', _id_front_url,
        'id_back_url', _id_back_url
      )
  )
  RETURNING id INTO v_review_id;

  RETURN jsonb_build_object('ok', true, 'review_id', v_review_id);
END;
$$;

-- ============================================================
-- club_cancel_kyc: withdraw a pending review and unlock profile
-- ============================================================
CREATE OR REPLACE FUNCTION public.club_cancel_kyc(_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status player_verification_status;
BEGIN
  SELECT verification_status INTO v_status FROM players WHERE id = _player_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'player_not_found'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'not_pending'; END IF;

  UPDATE kyc_reviews
  SET status = 'cancelled',
      am_decision_at = now(),
      updated_at = now()
  WHERE player_id = _player_id AND status = 'pending';

  UPDATE players
  SET verification_status = 'unverified',
      updated_at = now()
  WHERE id = _player_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;