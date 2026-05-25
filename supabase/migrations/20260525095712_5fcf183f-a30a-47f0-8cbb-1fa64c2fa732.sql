
-- 1) Extend node_modes check constraint
ALTER TABLE public.node_modes DROP CONSTRAINT IF EXISTS node_modes_mode_check;
ALTER TABLE public.node_modes ADD CONSTRAINT node_modes_mode_check
  CHECK (mode = ANY (ARRAY['cloud_primary','local_primary','cloud_freeze','cloud_archive']));

-- 2) Update enforcement trigger to honor freeze/archive
CREATE OR REPLACE FUNCTION public._enforce_replication_mode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_casino uuid;
  v_mode text;
  v_applying text;
  v_role text;
BEGIN
  BEGIN v_applying := current_setting('app.sync_applying', true);
  EXCEPTION WHEN OTHERS THEN v_applying := NULL; END;
  IF v_applying = '1' THEN RETURN COALESCE(NEW, OLD); END IF;

  IF TG_OP = 'DELETE' THEN
    BEGIN v_casino := OLD.casino_id; EXCEPTION WHEN OTHERS THEN v_casino := NULL; END;
  ELSE
    BEGIN v_casino := NEW.casino_id; EXCEPTION WHEN OTHERS THEN v_casino := NULL; END;
  END IF;
  IF v_casino IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT mode INTO v_mode FROM public.node_modes WHERE casino_id = v_casino;
  IF v_mode IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  -- Shared-identity tables are never blocked: players/blacklist must flow at all times.
  v_role := public.sync_role_for_table(TG_TABLE_NAME);
  IF v_role = 'bidir_global' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- super_admin bypass for all states
  IF public.has_role(auth.uid(), 'super_admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_mode = 'local_primary' THEN
    RAISE EXCEPTION 'Casino % is currently Local-Primary. Direct Cloud writes are blocked.', v_casino
      USING HINT = 'Demote to Cloud-Primary first or perform the action on the local node.';
  ELSIF v_mode = 'cloud_freeze' THEN
    RAISE EXCEPTION 'Casino % is in CUTOVER FREEZE. Operational writes are paused while data drains.', v_casino
      USING HINT = 'Wait for the cutover wizard to complete or roll back.';
  ELSIF v_mode = 'cloud_archive' THEN
    RAISE EXCEPTION 'Casino % Cloud is ARCHIVED (read-only). Use the local node.', v_casino;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 3) cutover_sessions table
CREATE TABLE IF NOT EXISTS public.cutover_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id) ON DELETE CASCADE,
  initiated_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  state text NOT NULL DEFAULT 'seeding'
    CHECK (state IN ('seeding','catching_up','freezing','draining','promoting','dns_swap','done','rolled_back','failed')),
  source_node_id text,
  target_node_id text,
  seed_rows bigint NOT NULL DEFAULT 0,
  delta_rows bigint NOT NULL DEFAULT 0,
  drain_ms integer,
  rollback_window_until timestamptz,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cutover_sessions_casino ON public.cutover_sessions(casino_id, started_at DESC);

ALTER TABLE public.cutover_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cutover_sessions super_admin read" ON public.cutover_sessions;
DROP POLICY IF EXISTS "cutover_sessions super_admin write" ON public.cutover_sessions;
CREATE POLICY "cutover_sessions super_admin read" ON public.cutover_sessions
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'super_admin'));
CREATE POLICY "cutover_sessions super_admin write" ON public.cutover_sessions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'))
  WITH CHECK (has_role(auth.uid(),'super_admin'));

-- 4) RPCs
CREATE OR REPLACE FUNCTION public.cutover_begin(p_casino uuid, p_target_node text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid; v_src text;
BEGIN
  IF NOT has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'super_admin only'; END IF;
  SELECT node_id INTO v_src FROM public.node_identity WHERE id = true;
  INSERT INTO public.cutover_sessions(casino_id, initiated_by, source_node_id, target_node_id, state)
    VALUES (p_casino, auth.uid(), v_src, p_target_node, 'seeding')
    RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.cutover_set_state(p_session uuid, p_state text, p_notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'super_admin only'; END IF;
  UPDATE public.cutover_sessions
    SET state = p_state,
        notes = COALESCE(p_notes, notes),
        updated_at = now(),
        completed_at = CASE WHEN p_state IN ('done','rolled_back','failed') THEN now() ELSE completed_at END,
        rollback_window_until = CASE WHEN p_state = 'done' THEN now() + interval '1 hour' ELSE rollback_window_until END
    WHERE id = p_session;
END $$;

CREATE OR REPLACE FUNCTION public.cutover_freeze_cloud(p_casino uuid)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_lag bigint;
BEGIN
  IF NOT has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'super_admin only'; END IF;
  INSERT INTO public.node_modes(casino_id, mode, promoted_at, promoted_by, notes)
    VALUES (p_casino, 'cloud_freeze', now(), auth.uid(), 'cutover freeze')
    ON CONFLICT (casino_id) DO UPDATE
      SET mode='cloud_freeze', promoted_at=now(), promoted_by=auth.uid(), updated_at=now();
  SELECT COUNT(*) INTO v_lag FROM public.sync_outbox WHERE casino_id = p_casino;
  RETURN COALESCE(v_lag,0);
END $$;

CREATE OR REPLACE FUNCTION public.cutover_promote_local(p_casino uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'super_admin only'; END IF;
  INSERT INTO public.node_modes(casino_id, mode, promoted_at, promoted_by, notes)
    VALUES (p_casino, 'cloud_archive', now(), auth.uid(), 'cutover promote: local now primary')
    ON CONFLICT (casino_id) DO UPDATE
      SET mode='cloud_archive', promoted_at=now(), promoted_by=auth.uid(), updated_at=now();
END $$;

CREATE OR REPLACE FUNCTION public.cutover_rollback(p_session uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_casino uuid; v_until timestamptz;
BEGIN
  IF NOT has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'super_admin only'; END IF;
  SELECT casino_id, rollback_window_until INTO v_casino, v_until
    FROM public.cutover_sessions WHERE id = p_session;
  IF v_casino IS NULL THEN RAISE EXCEPTION 'session not found'; END IF;
  IF v_until IS NOT NULL AND v_until < now() THEN
    RAISE EXCEPTION 'Rollback window has expired';
  END IF;
  UPDATE public.node_modes
    SET mode='cloud_primary', promoted_at=now(), promoted_by=auth.uid(),
        notes='cutover rollback', updated_at=now()
    WHERE casino_id = v_casino;
  UPDATE public.cutover_sessions
    SET state='rolled_back', completed_at=now(), updated_at=now()
    WHERE id = p_session;
END $$;
