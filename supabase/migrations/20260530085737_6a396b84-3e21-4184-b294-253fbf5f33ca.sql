
CREATE TYPE public.player_crm_segment AS ENUM ('vip','regular','new','dormant','custom');

CREATE TABLE public.player_crm (
  player_id uuid PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  host_user_id uuid REFERENCES auth.users(id),
  segment public.player_crm_segment NOT NULL DEFAULT 'regular',
  segment_locked boolean NOT NULL DEFAULT false,
  birthday_card_sent_year int,
  last_contact_at timestamptz,
  last_contact_note text NOT NULL DEFAULT '',
  custom_tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
CREATE INDEX idx_player_crm_casino ON public.player_crm(casino_id);
CREATE INDEX idx_player_crm_host ON public.player_crm(host_user_id);
CREATE INDEX idx_player_crm_segment ON public.player_crm(casino_id, segment);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_crm TO authenticated;
GRANT ALL ON public.player_crm TO service_role;

ALTER TABLE public.player_crm ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm read by casino access"
  ON public.player_crm FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_casino_access uca
      WHERE uca.user_id = auth.uid() AND uca.casino_id = player_crm.casino_id
    )
  );

CREATE POLICY "crm write by manager/host"
  ON public.player_crm FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'floor_manager'::app_role)
    OR has_role(auth.uid(), 'finance_manager'::app_role)
    OR has_role(auth.uid(), 'reception'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'floor_manager'::app_role)
    OR has_role(auth.uid(), 'finance_manager'::app_role)
    OR has_role(auth.uid(), 'reception'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  );

CREATE OR REPLACE FUNCTION public.player_crm_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  IF auth.uid() IS NOT NULL THEN NEW.updated_by = auth.uid(); END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_player_crm_touch
  BEFORE INSERT OR UPDATE ON public.player_crm
  FOR EACH ROW EXECUTE FUNCTION public.player_crm_touch();

CREATE OR REPLACE FUNCTION public.player_segment_recalc(_casino uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _updated int;
BEGIN
  WITH stats AS (
    SELECT
      p.id AS player_id,
      p.casino_id,
      p.created_at,
      (SELECT MAX(cv.date) FROM casino_visits cv WHERE cv.player_id = p.id AND cv.casino_id = p.casino_id) AS last_visit,
      (SELECT COUNT(*) FROM casino_visits cv WHERE cv.player_id = p.id AND cv.casino_id = p.casino_id AND cv.date >= (CURRENT_DATE - 90)) AS visits_90d
    FROM players p
    WHERE p.casino_id = _casino AND p.status = 'active'
  ),
  classified AS (
    SELECT
      s.player_id, s.casino_id,
      CASE
        WHEN s.last_visit IS NOT NULL AND s.last_visit < (CURRENT_DATE - 60) THEN 'dormant'::player_crm_segment
        WHEN s.created_at > (now() - interval '30 days') THEN 'new'::player_crm_segment
        WHEN s.visits_90d >= 10 THEN 'vip'::player_crm_segment
        ELSE 'regular'::player_crm_segment
      END AS seg
    FROM stats s
  )
  INSERT INTO player_crm(player_id, casino_id, segment)
  SELECT c.player_id, c.casino_id, c.seg FROM classified c
  ON CONFLICT (player_id) DO UPDATE
    SET segment = EXCLUDED.segment,
        updated_at = now()
    WHERE player_crm.segment_locked = false
      AND player_crm.segment IS DISTINCT FROM EXCLUDED.segment;
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated;
END;$$;

CREATE OR REPLACE FUNCTION public.crm_players_list(_casino uuid)
RETURNS TABLE (
  player_id uuid,
  first_name text,
  last_name text,
  nickname text,
  phone text,
  photo_url text,
  category player_category,
  status player_status,
  birth_date date,
  card_number text,
  segment player_crm_segment,
  segment_locked boolean,
  host_user_id uuid,
  host_name text,
  last_contact_at timestamptz,
  last_contact_note text,
  custom_tags text[],
  birthday_card_sent_year int,
  last_visit date,
  visits_90d bigint,
  visits_total bigint,
  created_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.id,
    p.first_name, p.last_name, p.nickname, p.phone, p.photo_url,
    p.category, p.status, p.birth_date,
    (SELECT card_number FROM player_cards pc WHERE pc.player_id = p.id AND pc.is_active = true ORDER BY pc.issued_at DESC LIMIT 1) AS card_number,
    COALESCE(c.segment, 'regular'::player_crm_segment) AS segment,
    COALESCE(c.segment_locked, false),
    c.host_user_id,
    (SELECT pr.display_name FROM profiles pr WHERE pr.user_id = c.host_user_id LIMIT 1) AS host_name,
    c.last_contact_at,
    COALESCE(c.last_contact_note,''),
    COALESCE(c.custom_tags, ARRAY[]::text[]),
    c.birthday_card_sent_year,
    (SELECT MAX(cv.date) FROM casino_visits cv WHERE cv.player_id = p.id AND cv.casino_id = p.casino_id),
    (SELECT COUNT(*) FROM casino_visits cv WHERE cv.player_id = p.id AND cv.casino_id = p.casino_id AND cv.date >= (CURRENT_DATE - 90)),
    (SELECT COUNT(*) FROM casino_visits cv WHERE cv.player_id = p.id AND cv.casino_id = p.casino_id),
    p.created_at
  FROM players p
  LEFT JOIN player_crm c ON c.player_id = p.id
  WHERE p.casino_id = _casino
  ORDER BY p.last_name, p.first_name;
$$;

GRANT EXECUTE ON FUNCTION public.player_segment_recalc(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_players_list(uuid) TO authenticated;

INSERT INTO role_module_defaults(role, module_key, can_view, can_write, day_horizon) VALUES
  ('super_admin','crm_players', true,  true,  'all'),
  ('manager',    'crm_players', true,  true,  'all'),
  ('floor_manager','crm_players', true, true, 'all'),
  ('finance_manager','crm_players', true, true, 'all'),
  ('reception',  'crm_players', true,  true,  'all'),
  ('hr',         'crm_players', true,  false, 'all')
ON CONFLICT (role, module_key) DO NOTHING;
