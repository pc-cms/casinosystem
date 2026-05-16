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
  v_id_type text;
BEGIN
  IF p_table !~ '^[a-z_][a-z0-9_]*$' THEN
    RAISE EXCEPTION 'invalid table name';
  END IF;

  IF to_regclass(format('public.%I', p_table)) IS NULL THEN
    RETURN;
  END IF;

  SELECT data_type INTO v_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = p_table
    AND column_name = 'id'
  LIMIT 1;

  IF v_id_type IS NULL THEN
    RETURN;
  END IF;

  PERFORM set_config('sync.applying','on', true);
  PERFORM set_config('sync.origin_node_id', p_origin_node_id::text, true);

  v_id := p_pk->>'id';

  IF p_op = 'DELETE' THEN
    IF v_id_type = 'uuid' THEN
      EXECUTE format('DELETE FROM public.%I WHERE id = $1::uuid', p_table) USING v_id;
    ELSE
      EXECUTE format('DELETE FROM public.%I WHERE id = $1', p_table) USING v_id;
    END IF;
    RETURN;
  END IF;

  IF p_payload ? 'updated_at' THEN
    BEGIN
      v_incoming_updated_at := (p_payload->>'updated_at')::timestamptz;
      IF v_id_type = 'uuid' THEN
        EXECUTE format('SELECT updated_at FROM public.%I WHERE id = $1::uuid', p_table)
          INTO v_existing_updated_at USING v_id;
      ELSE
        EXECUTE format('SELECT updated_at FROM public.%I WHERE id = $1', p_table)
          INTO v_existing_updated_at USING v_id;
      END IF;
      IF v_existing_updated_at IS NOT NULL
         AND v_incoming_updated_at IS NOT NULL
         AND v_existing_updated_at > v_incoming_updated_at THEN
        RETURN;
      END IF;
    EXCEPTION WHEN undefined_column OR invalid_text_representation THEN
      NULL;
    END;
  END IF;

  SELECT array_agg(k) INTO v_cols
  FROM jsonb_object_keys(p_payload) k
  WHERE EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = p_table
      AND c.column_name = k
  );

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

  BEGIN
    EXECUTE v_sql USING p_payload;
  EXCEPTION WHEN undefined_column OR datatype_mismatch OR invalid_text_representation THEN
    RETURN;
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.peer_apply_change(uuid,text,text,jsonb,jsonb,timestamptz) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.peer_apply_change(uuid,text,text,jsonb,jsonb,timestamptz) TO service_role;

NOTIFY pgrst, 'reload schema';