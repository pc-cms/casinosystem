
CREATE OR REPLACE FUNCTION public.club_self_register(
  _phone text,
  _first text,
  _last text,
  _dob date,
  _id_number text,
  _casino_slug text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_casino_id uuid;
  v_player_id uuid;
  v_age int;
BEGIN
  -- Validate inputs
  IF _phone IS NULL OR length(trim(_phone)) < 9 THEN
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

  -- Resolve casino
  SELECT id INTO v_casino_id FROM casinos WHERE slug = _casino_slug;
  IF v_casino_id IS NULL THEN
    RAISE EXCEPTION 'invalid_casino';
  END IF;

  -- Duplicate phone check (any casino)
  IF EXISTS (SELECT 1 FROM players WHERE phone = _phone) THEN
    RAISE EXCEPTION 'duplicate_phone';
  END IF;

  -- Duplicate ID check when provided
  IF _id_number IS NOT NULL AND length(trim(_id_number)) > 0 THEN
    IF EXISTS (SELECT 1 FROM players WHERE id_number = _id_number AND id_number <> '') THEN
      RAISE EXCEPTION 'duplicate_id';
    END IF;
  END IF;

  INSERT INTO players (
    casino_id, first_name, last_name, phone, id_number, birth_date,
    verification_status, status, category, player_type
  ) VALUES (
    v_casino_id,
    trim(_first),
    trim(_last),
    _phone,
    COALESCE(trim(_id_number), ''),
    _dob,
    'pending',
    'active',
    'normal',
    'table'
  ) RETURNING id INTO v_player_id;

  -- Ensure club_accounts row
  INSERT INTO club_accounts (player_id, phone)
  VALUES (v_player_id, _phone)
  ON CONFLICT (phone) DO UPDATE SET player_id = EXCLUDED.player_id;

  RETURN jsonb_build_object(
    'player_id', v_player_id,
    'casino_id', v_casino_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.club_self_register(text, text, text, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.club_self_register(text, text, text, date, text, text) TO service_role;
