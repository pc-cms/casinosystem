
-- 1. Add sync_role column
ALTER TABLE public.sync_outbox
  ADD COLUMN IF NOT EXISTS sync_role text NOT NULL DEFAULT 'push_to_premier';

ALTER TABLE public.sync_outbox
  DROP CONSTRAINT IF EXISTS sync_outbox_sync_role_check;

ALTER TABLE public.sync_outbox
  ADD CONSTRAINT sync_outbox_sync_role_check
  CHECK (sync_role IN ('push_to_premier', 'bidir_global'));

-- 2. Classification helper
CREATE OR REPLACE FUNCTION public.sync_role_for_table(p_table text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_table IN (
      'players',
      'player_cards',
      'player_tags',
      'player_notes',
      'tag_conflicts'
    ) THEN 'bidir_global'
    ELSE 'push_to_premier'
  END
$$;

-- 3. Update capture trigger to stamp role
CREATE OR REPLACE FUNCTION public.sync_capture_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_casino_id UUID;
  v_row       JSONB;
  v_payload   JSONB;
  v_origin    UUID;
  v_supplied  TEXT;
  v_role      TEXT;
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

  v_role := public.sync_role_for_table(TG_TABLE_NAME);

  INSERT INTO public.sync_outbox (casino_id, table_name, op, pk, payload, origin_node_id, sync_role)
  VALUES (
    v_casino_id, TG_TABLE_NAME, TG_OP,
    jsonb_build_object('id', v_row->'id'), v_payload, v_origin, v_role
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 4. Backfill existing rows
UPDATE public.sync_outbox
   SET sync_role = public.sync_role_for_table(table_name)
 WHERE sync_role = 'push_to_premier'
   AND table_name IN ('players','player_cards','player_tags','player_notes','tag_conflicts');

-- 5. Index for sync engine fan-out queries
CREATE INDEX IF NOT EXISTS idx_sync_outbox_role_id
  ON public.sync_outbox (sync_role, id);
