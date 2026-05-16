CREATE OR REPLACE FUNCTION public.export_full_schema_ddl()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $func$
DECLARE
  v_out text := '';
  r record;
  c record;
  v_col_defs text[];
  v_pk_cols text;
  v_enum_vals text;
  v_default text;
BEGIN
  -- 1) Enums
  FOR r IN
    SELECT t.typname,
           string_agg(quote_literal(e.enumlabel), ',' ORDER BY e.enumsortorder) AS labels
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public'
    GROUP BY t.typname
    ORDER BY t.typname
  LOOP
    v_out := v_out
      || 'DO $E$ BEGIN CREATE TYPE public.' || quote_ident(r.typname)
      || ' AS ENUM (' || r.labels || '); '
      || 'EXCEPTION WHEN duplicate_object THEN NULL; END $E$;' || E'\n';
    -- Add any missing labels (idempotent)
    FOR c IN
      SELECT e.enumlabel
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE n.nspname='public' AND t.typname = r.typname
      ORDER BY e.enumsortorder
    LOOP
      v_out := v_out
        || 'ALTER TYPE public.' || quote_ident(r.typname)
        || ' ADD VALUE IF NOT EXISTS ' || quote_literal(c.enumlabel) || ';' || E'\n';
    END LOOP;
  END LOOP;

  -- 2) Tables
  FOR r IN
    SELECT cls.oid, cls.relname
    FROM pg_class cls
    JOIN pg_namespace n ON n.oid = cls.relnamespace
    WHERE n.nspname = 'public'
      AND cls.relkind = 'r'
      AND cls.relname NOT LIKE 'pg_%'
    ORDER BY cls.relname
  LOOP
    v_col_defs := ARRAY[]::text[];
    FOR c IN
      SELECT a.attname,
             pg_catalog.format_type(a.atttypid, a.atttypmod) AS typ,
             a.attnotnull,
             pg_get_expr(d.adbin, d.adrelid) AS deflt
      FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = r.oid AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attnum
    LOOP
      -- Skip sequence-based defaults (nextval) to avoid missing-sequence errors;
      -- seeded INSERTs provide id explicitly so this is safe.
      v_default := CASE
        WHEN c.deflt IS NOT NULL AND c.deflt NOT ILIKE 'nextval(%'
          THEN ' DEFAULT ' || c.deflt
        ELSE ''
      END;
      v_col_defs := v_col_defs || (
        quote_ident(c.attname) || ' ' || c.typ || v_default
        || CASE WHEN c.attnotnull AND c.deflt IS NOT NULL THEN ' NOT NULL' ELSE '' END
      );
    END LOOP;

    SELECT string_agg(quote_ident(att.attname), ',')
      INTO v_pk_cols
    FROM pg_index i
    JOIN pg_attribute att ON att.attrelid = i.indrelid AND att.attnum = ANY(i.indkey)
    WHERE i.indrelid = r.oid AND i.indisprimary;

    IF v_pk_cols IS NOT NULL THEN
      v_col_defs := v_col_defs || ('PRIMARY KEY (' || v_pk_cols || ')');
    END IF;

    v_out := v_out
      || 'CREATE TABLE IF NOT EXISTS public.' || quote_ident(r.relname)
      || ' (' || array_to_string(v_col_defs, ', ') || ');' || E'\n';

    -- Idempotent column additions for already-existing tables with older schemas
    FOR c IN
      SELECT a.attname,
             pg_catalog.format_type(a.atttypid, a.atttypmod) AS typ,
             pg_get_expr(d.adbin, d.adrelid) AS deflt
      FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = r.oid AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attnum
    LOOP
      v_default := CASE
        WHEN c.deflt IS NOT NULL AND c.deflt NOT ILIKE 'nextval(%'
          THEN ' DEFAULT ' || c.deflt
        ELSE ''
      END;
      v_out := v_out
        || 'ALTER TABLE public.' || quote_ident(r.relname)
        || ' ADD COLUMN IF NOT EXISTS ' || quote_ident(c.attname)
        || ' ' || c.typ || v_default || ';' || E'\n';
    END LOOP;
  END LOOP;

  RETURN v_out;
END
$func$;

REVOKE EXECUTE ON FUNCTION public.export_full_schema_ddl() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.export_full_schema_ddl() TO service_role;