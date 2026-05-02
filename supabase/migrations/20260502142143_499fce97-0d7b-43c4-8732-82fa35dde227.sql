
-- =====================================================================
-- Player position history — server-side timers for player whereabouts
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.player_position_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  player_id uuid NOT NULL REFERENCES public.players(id),
  visit_id uuid REFERENCES public.casino_visits(id) ON DELETE SET NULL,
  position text NOT NULL,                         -- 'table' | 'hall' | 'slots'
  table_id uuid REFERENCES public.gaming_tables(id), -- when position='table'
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer GENERATED ALWAYS AS (
    CASE WHEN ended_at IS NOT NULL
      THEN GREATEST(0, EXTRACT(EPOCH FROM (ended_at - started_at))::int)
      ELSE NULL
    END
  ) STORED,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pph_player ON public.player_position_history(player_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_pph_casino_open ON public.player_position_history(casino_id, position) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pph_visit ON public.player_position_history(visit_id);

ALTER TABLE public.player_position_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino users see position history"
  ON public.player_position_history FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()));

CREATE POLICY "Super admin/FM see all position history"
  ON public.player_position_history FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'finance_manager'::app_role));

CREATE POLICY "Surveillance sees assigned casino position history"
  ON public.player_position_history FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'surveillance'::app_role) AND user_has_casino_access(auth.uid(), casino_id));

-- Inserts/updates ONLY via trigger (security definer functions below).
-- No direct INSERT/UPDATE/DELETE policy.

-- =====================================================================
-- Helper: close the currently open position row for a (casino,player)
-- =====================================================================
CREATE OR REPLACE FUNCTION public._close_open_position(
  _casino_id uuid, _player_id uuid, _at timestamptz
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.player_position_history
     SET ended_at = _at
   WHERE casino_id = _casino_id
     AND player_id = _player_id
     AND ended_at IS NULL;
END $$;

-- =====================================================================
-- Trigger on casino_visits — start period on insert,
-- close on checkout, switch on position change
-- =====================================================================
CREATE OR REPLACE FUNCTION public.trg_visits_position_history()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_table uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Close any orphan open row first (safety)
    PERFORM public._close_open_position(NEW.casino_id, NEW.player_id, NEW.checked_in_at);
    INSERT INTO public.player_position_history(
      casino_id, player_id, visit_id, position, started_at, created_by
    ) VALUES (
      NEW.casino_id, NEW.player_id, NEW.id, NEW.position, NEW.checked_in_at, NEW.checked_in_by
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Checkout: close current open row
    IF NEW.checked_out_at IS NOT NULL AND OLD.checked_out_at IS NULL THEN
      PERFORM public._close_open_position(NEW.casino_id, NEW.player_id, NEW.checked_out_at);
      RETURN NEW;
    END IF;

    -- Position changed (and still inside): close + open new row
    IF NEW.position IS DISTINCT FROM OLD.position AND NEW.checked_out_at IS NULL THEN
      PERFORM public._close_open_position(NEW.casino_id, NEW.player_id, now());
      -- For 'table' rows we additionally try to attach the active table_id
      v_table := NULL;
      IF NEW.position = 'table' THEN
        SELECT table_id INTO v_table
          FROM public.client_sessions
         WHERE casino_id = NEW.casino_id AND player_id = NEW.player_id AND stopped_at IS NULL
         ORDER BY started_at DESC LIMIT 1;
      END IF;
      INSERT INTO public.player_position_history(
        casino_id, player_id, visit_id, position, table_id, started_at
      ) VALUES (
        NEW.casino_id, NEW.player_id, NEW.id, NEW.position, v_table, now()
      );
      RETURN NEW;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS visits_position_history ON public.casino_visits;
CREATE TRIGGER visits_position_history
AFTER INSERT OR UPDATE ON public.casino_visits
FOR EACH ROW EXECUTE FUNCTION public.trg_visits_position_history();

-- =====================================================================
-- Trigger on client_sessions — keep table_id fresh on the open
-- table-position row (when player is seated at a specific table)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.trg_sessions_position_table()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.player_position_history
       SET table_id = NEW.table_id
     WHERE casino_id = NEW.casino_id
       AND player_id = NEW.player_id
       AND ended_at IS NULL
       AND position = 'table'
       AND (table_id IS NULL OR table_id <> NEW.table_id);
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sessions_position_table ON public.client_sessions;
CREATE TRIGGER sessions_position_table
AFTER INSERT ON public.client_sessions
FOR EACH ROW EXECUTE FUNCTION public.trg_sessions_position_table();
