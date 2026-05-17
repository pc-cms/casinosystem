-- Casino System — hotfix for local nodes missing FKs + business-date RPC
-- Run via:
--   docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /repair/hotfix-fks-rpc.sql
-- Idempotent.

-- ─────────── 1. Foreign keys needed for PostgREST embedding ───────────
DO $$
DECLARE
  r text[];
  fks text[][] := ARRAY[
    ARRAY['players','casino_id','casinos','id'],
    ARRAY['player_cards','player_id','players','id'],
    ARRAY['player_tags','player_id','players','id'],
    ARRAY['player_notes','player_id','players','id'],
    ARRAY['player_notes','casino_id','casinos','id'],
    ARRAY['player_chip_adjustments','player_id','players','id'],
    ARRAY['player_chip_adjustments','casino_id','casinos','id'],
    ARRAY['casino_visits','player_id','players','id'],
    ARRAY['client_sessions','player_id','players','id'],
    ARRAY['transactions','player_id','players','id'],
    ARRAY['expenses','player_id','players','id'],
    ARRAY['group_members','player_id','players','id'],
    ARRAY['gaming_tables','casino_id','casinos','id'],
    ARRAY['shifts','casino_id','casinos','id'],
    ARRAY['daily_summaries','casino_id','casinos','id'],
    ARRAY['employees','casino_id','casinos','id']
  ];
  tbl text; col text; rtbl text; rcol text; cname text;
BEGIN
  FOREACH r SLICE 1 IN ARRAY fks LOOP
    tbl := r[1]; col := r[2]; rtbl := r[3]; rcol := r[4];
    cname := tbl||'_'||col||'_fkey';
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid=c.conrelid
        WHERE c.contype='f' AND t.relname=tbl AND c.conname=cname
      ) AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl)
        AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=rtbl)
        AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl AND column_name=col)
        AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=rtbl AND column_name=rcol)
      THEN
        EXECUTE format(
          'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(%I) NOT VALID',
          tbl, cname, col, rtbl, rcol
        );
        RAISE NOTICE 'Added FK %.% -> %.%', tbl, col, rtbl, rcol;
      END IF;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Skipped FK %.%: %', tbl, col, SQLERRM;
    END;
  END LOOP;
END $$;

-- ─────────── 2. business_day_closures table (if missing) ───────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.business_day_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL,
  business_date date NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid,
  UNIQUE (casino_id, business_date)
);

-- ─────────── 3. get_current_business_date RPC ───────────
CREATE OR REPLACE FUNCTION public.get_current_business_date(_casino_id uuid)
RETURNS date
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _last_closed date;
  _now_eat timestamp;
  _eat_hour int;
  _today date;
BEGIN
  SELECT MAX(business_date) INTO _last_closed
  FROM public.business_day_closures
  WHERE casino_id = _casino_id;

  _now_eat := (now() AT TIME ZONE 'Africa/Dar_es_Salaam');
  _eat_hour := EXTRACT(HOUR FROM _now_eat)::int;
  _today := _now_eat::date;

  IF _last_closed IS NOT NULL THEN
    RETURN LEAST(_last_closed + 1, _today);
  END IF;

  IF _eat_hour < 11 THEN
    RETURN _today - 1;
  END IF;
  RETURN _today;
END;
$function$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.get_current_business_date(uuid) TO anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.get_current_business_date(uuid) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.get_current_business_date(uuid) TO service_role;
  END IF;
END $$;

-- ─────────── 4. Reload PostgREST schema cache ───────────
NOTIFY pgrst, 'reload schema';

SELECT 'hotfix-fks-rpc applied' AS status;
