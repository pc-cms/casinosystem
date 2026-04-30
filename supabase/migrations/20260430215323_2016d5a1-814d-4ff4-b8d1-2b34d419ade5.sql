-- ─────────────────────────────────────────────────────────────
-- Cloud-side sync infrastructure for two-way replication with
-- self-hosted casino servers (cms-sync worker).
-- ─────────────────────────────────────────────────────────────

-- Outbox: changes in Cloud → fan out to local servers
CREATE TABLE IF NOT EXISTS public.sync_outbox (
  id           BIGSERIAL PRIMARY KEY,
  casino_id    UUID,                     -- NULL = global (push to all locals)
  table_name   TEXT NOT NULL,
  op           TEXT NOT NULL CHECK (op IN ('INSERT','UPDATE','DELETE')),
  pk           JSONB NOT NULL,
  payload      JSONB,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_casino_changed
  ON public.sync_outbox (casino_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_changed
  ON public.sync_outbox (changed_at);

-- Inbox log: incoming changes from local servers (idempotency)
CREATE TABLE IF NOT EXISTS public.sync_inbox_log (
  id           BIGSERIAL PRIMARY KEY,
  casino_id    UUID NOT NULL,
  local_id     BIGINT NOT NULL,
  table_name   TEXT NOT NULL,
  op           TEXT NOT NULL,
  applied_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  error        TEXT,
  UNIQUE (casino_id, local_id)
);

ALTER TABLE public.sync_outbox    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_inbox_log ENABLE ROW LEVEL SECURITY;

-- No policies → only service_role (which bypasses RLS) can read/write.
-- Edge functions use SUPABASE_SERVICE_ROLE_KEY exclusively.

-- Capture function: writes change to sync_outbox
CREATE OR REPLACE FUNCTION public.sync_capture_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_casino_id UUID;
  v_row       JSONB;
  v_payload   JSONB;
BEGIN
  IF current_setting('sync.applying', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
    v_payload := NULL;
  ELSE
    v_row := to_jsonb(NEW);
    v_payload := v_row;
  END IF;
  v_casino_id := NULLIF(v_row->>'casino_id','')::uuid;
  INSERT INTO public.sync_outbox (casino_id, table_name, op, pk, payload)
  VALUES (
    v_casino_id, TG_TABLE_NAME, TG_OP,
    jsonb_build_object('id', v_row->'id'), v_payload
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Helper to attach
CREATE OR REPLACE FUNCTION public.sync_attach(p_table regclass)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS trg_sync_capture ON %s', p_table);
  EXECUTE format(
    'CREATE TRIGGER trg_sync_capture AFTER INSERT OR UPDATE OR DELETE ON %s
       FOR EACH ROW EXECUTE FUNCTION public.sync_capture_change()',
    p_table
  );
END;
$$;

-- Attach to key tables (skip silently if missing)
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'transactions','shifts','cage_transfers','expenses',
    'wallet_transactions','chip_emissions','miss_chips',
    'casino_visits','players','player_cards','player_tags','player_notes',
    'activity_logs','daily_review','budget_items','budget_periods',
    'blacklist','inter_casino_transfers'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      PERFORM public.sync_attach(format('public.%I', t)::regclass);
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'sync_attach: table public.% not found, skipping', t;
    END;
  END LOOP;
END $$;

-- GC: keep outbox 30 days
CREATE OR REPLACE FUNCTION public.sync_outbox_gc()
RETURNS void
LANGUAGE sql AS $$
  DELETE FROM public.sync_outbox WHERE changed_at < now() - INTERVAL '30 days';
$$;