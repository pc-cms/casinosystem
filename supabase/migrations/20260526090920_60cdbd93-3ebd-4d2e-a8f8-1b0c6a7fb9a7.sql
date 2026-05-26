
CREATE OR REPLACE FUNCTION public.reset_operational_dashboards(_casino_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tables_reset int := 0;
  v_cage_closed int := 0;
  v_slots_closed int := 0;
  v_sessions_stopped int := 0;
  v_visits_closed int := 0;
  v_note text := 'Auto-closed by 11:00 business-day rollover';
BEGIN
  -- Tables: clear closing draft data, mark closed. Pit will reopen.
  UPDATE public.gaming_tables
     SET closing_chips = NULL,
         closing_result = NULL,
         status = 'closed'
   WHERE casino_id = _casino_id
     AND (closing_chips IS NOT NULL OR closing_result IS NOT NULL OR status = 'open');
  GET DIAGNOSTICS v_tables_reset = ROW_COUNT;

  -- Live-game cage shifts left open → force-close with note
  UPDATE public.shifts
     SET status    = 'closed',
         closed_at = now(),
         notes     = COALESCE(NULLIF(notes,''), '') ||
                     CASE WHEN COALESCE(notes,'') = '' THEN '' ELSE E'\n' END || v_note
   WHERE casino_id = _casino_id
     AND status = 'open';
  GET DIAGNOSTICS v_cage_closed = ROW_COUNT;

  -- Cage Slots shifts left unfinalised → auto-approve with note
  UPDATE public.cage_slots_shifts
     SET status          = 'approved',
         reviewed_at     = COALESCE(reviewed_at, now()),
         closed_at       = COALESCE(closed_at,   now()),
         manager_comment = COALESCE(NULLIF(manager_comment,''), '') ||
                           CASE WHEN COALESCE(manager_comment,'') = '' THEN '' ELSE E'\n' END || v_note,
         updated_at      = now()
   WHERE casino_id = _casino_id
     AND status IN ('open','draft','ready_for_review');
  GET DIAGNOSTICS v_slots_closed = ROW_COUNT;

  -- Active player sessions still running → stop
  UPDATE public.client_sessions
     SET stopped_at = now()
   WHERE casino_id = _casino_id
     AND stopped_at IS NULL;
  GET DIAGNOSTICS v_sessions_stopped = ROW_COUNT;

  -- Casino visits not checked out → auto check-out
  UPDATE public.casino_visits
     SET checked_out_at = now()
   WHERE casino_id = _casino_id
     AND checked_out_at IS NULL;
  GET DIAGNOSTICS v_visits_closed = ROW_COUNT;

  RETURN jsonb_build_object(
    'tables_reset', v_tables_reset,
    'cage_shifts_force_closed', v_cage_closed,
    'slots_shifts_auto_approved', v_slots_closed,
    'sessions_stopped', v_sessions_stopped,
    'visits_checked_out', v_visits_closed
  );
END;
$$;
