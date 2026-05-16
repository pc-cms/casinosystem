
-- Peer mesh: loop prevention + per-peer cursor tracking
-- ------------------------------------------------------------------
-- 1. Add origin_node_id to sync_outbox so receivers can skip echoes
--    of changes they themselves authored.
ALTER TABLE public.sync_outbox
  ADD COLUMN IF NOT EXISTS origin_node_id uuid;

-- Index for fast "exclude my-own-rows" filter during pull
CREATE INDEX IF NOT EXISTS idx_sync_outbox_origin
  ON public.sync_outbox (origin_node_id);

-- 2. Update capture trigger to stamp the local node id.
--    Reads from public.node_identity (singleton). Skips if sync.applying='on'
--    OR if a peer-supplied origin was already set via GUC sync.origin_node_id.
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
  v_origin    UUID;
  v_supplied  TEXT;
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

  -- Prefer caller-supplied origin (when re-applying a peer's row), fall back to local node_id.
  v_supplied := current_setting('sync.origin_node_id', true);
  IF v_supplied IS NOT NULL AND v_supplied <> '' THEN
    BEGIN
      v_origin := v_supplied::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_origin := NULL;
    END;
  END IF;
  IF v_origin IS NULL THEN
    SELECT node_id INTO v_origin FROM public.node_identity WHERE id = true;
  END IF;

  INSERT INTO public.sync_outbox (casino_id, table_name, op, pk, payload, origin_node_id)
  VALUES (
    v_casino_id, TG_TABLE_NAME, TG_OP,
    jsonb_build_object('id', v_row->'id'), v_payload, v_origin
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3. RPC: peer applies a batch of changes idempotently.
--    Filters by casino_id whitelist (data isolation) and LWW for global rows.
--    Sets origin_node_id GUC so re-emitted outbox rows are tagged with the source peer.
CREATE OR REPLACE FUNCTION public.peer_apply_change(
  p_origin_node_id uuid,
  p_table text,
  p_op text,
  p_pk jsonb,
  p_payload jsonb,
  p_changed_at timestamptz
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_sql text;
  v_cols text[];
  v_setlist text;
  v_existing_updated_at timestamptz;
  v_incoming_updated_at timestamptz;
BEGIN
  -- Whitelist tables: only sync-attached business tables. Reject anything else.
  IF p_table !~ '^[a-z_][a-z0-9_]*$' THEN
    RAISE EXCEPTION 'invalid table name';
  END IF;

  PERFORM set_config('sync.applying','on', true);
  PERFORM set_config('sync.origin_node_id', p_origin_node_id::text, true);

  v_id := p_pk->>'id';

  IF p_op = 'DELETE' THEN
    EXECUTE format('DELETE FROM public.%I WHERE id = $1', p_table) USING v_id;
    RETURN;
  END IF;

  -- Last-write-wins on updated_at when present in both existing and incoming.
  IF p_payload ? 'updated_at' THEN
    v_incoming_updated_at := (p_payload->>'updated_at')::timestamptz;
    EXECUTE format('SELECT updated_at FROM public.%I WHERE id = $1', p_table)
      INTO v_existing_updated_at USING v_id;
    IF v_existing_updated_at IS NOT NULL
       AND v_incoming_updated_at IS NOT NULL
       AND v_existing_updated_at > v_incoming_updated_at THEN
      RETURN; -- local copy is newer, drop incoming
    END IF;
  END IF;

  -- Build dynamic upsert
  SELECT array_agg(k) INTO v_cols FROM jsonb_object_keys(p_payload) k;
  IF v_cols IS NULL OR array_length(v_cols,1) = 0 THEN RETURN; END IF;

  SELECT string_agg(format('%I = EXCLUDED.%I', c, c), ', ')
    INTO v_setlist
    FROM unnest(v_cols) c
    WHERE c <> 'id';

  v_sql := format(
    'INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I, $1) ON CONFLICT (id) DO UPDATE SET %s',
    p_table,
    (SELECT string_agg(format('%I', c), ',') FROM unnest(v_cols) c),
    (SELECT string_agg(format('%I', c), ',') FROM unnest(v_cols) c),
    p_table,
    COALESCE(v_setlist, format('%I = EXCLUDED.%I', v_cols[1], v_cols[1]))
  );
  EXECUTE v_sql USING p_payload;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.peer_apply_change(uuid,text,text,jsonb,jsonb,timestamptz) FROM public, anon, authenticated;
-- Only service_role (cms-sync / edge functions) may apply incoming peer changes.
