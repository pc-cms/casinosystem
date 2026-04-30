-- ─────────────────────────────────────────────────────────────
-- Casino System — Sync Outbox
-- -----------------------------------------------------------------
-- Локальный Postgres ведёт журнал ВСЕХ изменений ключевых таблиц
-- через триггеры. cms-sync воркер периодически читает unsent-строки
-- и отправляет батчем в Cloud (edge function pull-changes).
--
-- Cloud → Local идёт обратной стороной (cms-sync поллит edge
-- функцию outbox-pull-changes и upsert-ит в локальную БД).
-- ─────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS sync;

-- Outbox: каждое изменение = одна строка
CREATE TABLE IF NOT EXISTS sync.outbox (
  id           BIGSERIAL PRIMARY KEY,
  casino_id    UUID         NOT NULL,
  table_name   TEXT         NOT NULL,
  op           TEXT         NOT NULL CHECK (op IN ('INSERT','UPDATE','DELETE')),
  pk           JSONB        NOT NULL,        -- {id: "..."} или composite
  payload      JSONB,                        -- NEW row для INSERT/UPDATE
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  sent_at      TIMESTAMPTZ,
  attempts     INT          NOT NULL DEFAULT 0,
  last_error   TEXT
);

CREATE INDEX IF NOT EXISTS idx_outbox_unsent
  ON sync.outbox (created_at)
  WHERE sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_outbox_casino_unsent
  ON sync.outbox (casino_id, created_at)
  WHERE sent_at IS NULL;

-- Курсор для входящих изменений из Cloud (что уже скачали)
CREATE TABLE IF NOT EXISTS sync.cloud_cursor (
  casino_id    UUID PRIMARY KEY,
  last_pulled_at TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Флаг чтобы триггеры не писали в outbox при применении входящих изменений
-- (set_config('sync.applying','on',true) в воркере)
CREATE OR REPLACE FUNCTION sync.is_applying() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT current_setting('sync.applying', true) = 'on';
$$;

-- Универсальный trigger function: пишет change в outbox
CREATE OR REPLACE FUNCTION sync.capture_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, sync
AS $$
DECLARE
  v_casino_id UUID;
  v_pk        JSONB;
  v_payload   JSONB;
  v_row       JSONB;
BEGIN
  IF sync.is_applying() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
  ELSE
    v_row := to_jsonb(NEW);
  END IF;

  -- casino_id извлекаем если колонка есть, иначе NULL (глобальные таблицы)
  v_casino_id := NULLIF(v_row->>'casino_id','')::uuid;

  v_pk := jsonb_build_object('id', v_row->'id');

  IF TG_OP = 'DELETE' THEN
    v_payload := NULL;
  ELSE
    v_payload := v_row;
  END IF;

  INSERT INTO sync.outbox (casino_id, table_name, op, pk, payload)
  VALUES (v_casino_id, TG_TABLE_NAME, TG_OP, v_pk, v_payload);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Хелпер: навешивает capture trigger на таблицу (idempotent)
CREATE OR REPLACE FUNCTION sync.attach(p_table regclass)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_trg_name TEXT := 'trg_sync_capture';
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS %I ON %s',
    v_trg_name, p_table
  );
  EXECUTE format(
    'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %s
       FOR EACH ROW EXECUTE FUNCTION sync.capture_change()',
    v_trg_name, p_table
  );
END;
$$;

-- Список реплицируемых таблиц (можно расширять без правок воркера)
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'transactions','shifts','cage_transfers','expenses',
    'wallet_transactions','chip_emissions','chip_baseline','chip_inventory',
    'chip_initial_baseline','chip_snapshots','miss_chips',
    'casino_visits','players','player_cards','player_tags','player_notes',
    'breaklist','rota','employee_attendance',
    'activity_logs','daily_review','budget_items','budget_periods'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      PERFORM sync.attach(format('public.%I', t)::regclass);
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'sync: table public.% not found, skipping', t;
    END;
  END LOOP;
END $$;

-- Очистка отправленных строк (TTL 7 дней)
CREATE OR REPLACE FUNCTION sync.gc()
RETURNS void
LANGUAGE sql AS $$
  DELETE FROM sync.outbox
  WHERE sent_at IS NOT NULL AND sent_at < now() - INTERVAL '7 days';
$$;
