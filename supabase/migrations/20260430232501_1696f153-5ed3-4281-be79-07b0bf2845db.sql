-- Replace autoclose with a version that logs every auto-closed session.
-- The recalc trigger (already in place) will finalize total_bet + duration_minutes
-- when stopped_at flips from NULL to a value, so we just need to UPDATE and log.

CREATE OR REPLACE FUNCTION public.client_session_autoclose_prior()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closed RECORD;
  v_operator uuid := COALESCE(auth.uid(), NEW.created_by);
BEGIN
  FOR v_closed IN
    UPDATE public.client_sessions
       SET stopped_at = now()
     WHERE player_id  = NEW.player_id
       AND stopped_at IS NULL
       AND id <> NEW.id
    RETURNING id, casino_id, table_id, started_at, stopped_at, avg_bet, total_bet, duration_minutes
  LOOP
    -- One log row per auto-closed session. casino_id is required by RLS,
    -- operator_id falls back to created_by if no auth context (e.g. sync).
    INSERT INTO public.activity_logs (
      casino_id, operator_id, category, action, details
    ) VALUES (
      v_closed.casino_id,
      v_operator,
      'pit'::log_category,
      'session_auto_closed',
      jsonb_build_object(
        'reason',            'reseat_to_other_table',
        'closed_session_id', v_closed.id,
        'closed_table_id',   v_closed.table_id,
        'new_session_id',    NEW.id,
        'new_table_id',      NEW.table_id,
        'player_id',         NEW.player_id,
        'started_at',        v_closed.started_at,
        'stopped_at',        v_closed.stopped_at,
        'avg_bet',           v_closed.avg_bet,
        'total_bet',         v_closed.total_bet,
        'duration_minutes',  v_closed.duration_minutes
      )
    );
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.client_session_autoclose_prior() FROM PUBLIC;