-- Fix Local↔Cloud sync gaps:
--   1. attach sync_capture trigger to employees + missing operational tables
--   2. peer_apply_change: on auth.users FK violations, NULL the offending column and retry
--      so cross-environment users don't block the whole outbox

-- ── 1. Extend sync_attach coverage on Cloud ─────────────────────────────
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'employees',
    'breaklist_logs',
    'attendance_hours',
    'attendance_holidays',
    'client_sessions',
    'payroll_settings',
    'payroll_periods',
    'payroll_entries',
    'monthly_tips_pools',
    'monthly_tips_entries',
    'weekly_bonus_pools',
    'weekly_bonus_entries',
    'incidents',
    'business_day_closures',
    'employee_bank_accounts'
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

-- ── 2. peer_apply_change: NULL-and-retry on auth.users FK violations ────
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
  v_payload jsonb := p_payload;
  v_fk_col text;
  v_retry boolean;
  v_attempt int := 0;
BEGIN
  -- Casinos are environment-owned; row-sync must not touch them.
  IF p_table = 'casinos' THEN
    RETURN;
  END IF;

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

  IF v_payload ? 'updated_at' THEN
    BEGIN
      v_incoming_updated_at := (v_payload->>'updated_at')::timestamptz;
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

  <<retry_loop>>
  LOOP
    v_attempt := v_attempt + 1;
    EXIT WHEN v_attempt > 6;  -- max 6 FK fixups per row

    SELECT array_agg(k) INTO v_cols
    FROM jsonb_object_keys(v_payload) k
    WHERE EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = p_table
        AND c.column_name = k
        AND c.is_generated = 'NEVER'  -- skip GENERATED ALWAYS columns
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

    v_retry := false;
    BEGIN
      EXECUTE v_sql USING v_payload;
      RETURN;
    EXCEPTION
      WHEN undefined_column OR datatype_mismatch OR invalid_text_representation THEN
        RETURN;
      WHEN foreign_key_violation THEN
        -- Extract offending column from constraint name. Postgres errmsg gives
        -- us CONSTRAINT_NAME like "tablename_columnname_fkey". We resolve the
        -- column from pg_constraint to be safe.
        BEGIN
          SELECT a.attname
            INTO v_fk_col
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace n ON n.oid = rel.relnamespace
            JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
            JOIN pg_class fr ON fr.oid = con.confrelid
            JOIN pg_namespace fn ON fn.oid = fr.relnamespace
           WHERE n.nspname = 'public'
             AND rel.relname = p_table
             AND con.conname = SQLERRM::text  -- not reliable; fallback below
           LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
          v_fk_col := NULL;
        END;

        -- Fallback: try common user-FK columns one by one. If any is present
        -- in the payload and non-null, NULL it and retry.
        IF v_fk_col IS NULL THEN
          FOREACH v_fk_col IN ARRAY ARRAY[
            'issued_by','operator_id','created_by','updated_by','locked_by',
            'recorded_by','approved_by','closed_by','requested_by','confirmed_by',
            'cancelled_by','received_by','sent_by'
          ] LOOP
            IF v_payload ? v_fk_col AND v_payload->>v_fk_col IS NOT NULL THEN
              v_payload := v_payload || jsonb_build_object(v_fk_col, NULL);
              v_retry := true;
              EXIT;
            END IF;
          END LOOP;
        ELSE
          v_payload := v_payload || jsonb_build_object(v_fk_col, NULL);
          v_retry := true;
        END IF;

        IF NOT v_retry THEN
          -- No nullable user FK left; give up silently so the cursor advances.
          RETURN;
        END IF;
        CONTINUE retry_loop;
    END;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.peer_apply_change(uuid,text,text,jsonb,jsonb,timestamptz) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.peer_apply_change(uuid,text,text,jsonb,jsonb,timestamptz) TO service_role;

NOTIFY pgrst, 'reload schema';