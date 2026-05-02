-- Part 1: deferred shift settings on casinos
ALTER TABLE public.casinos
  ADD COLUMN IF NOT EXISTS shift_end_pending text,
  ADD COLUMN IF NOT EXISTS shift_end_pending_from date,
  ADD COLUMN IF NOT EXISTS breaklist_lock_pending text,
  ADD COLUMN IF NOT EXISTS breaklist_lock_pending_from date;

-- Part 2: third color for chip color settings (edge / inserts)
ALTER TABLE public.chip_color_settings
  ADD COLUMN IF NOT EXISTS edge_color text NOT NULL DEFAULT '#FFFFFF';

-- Part 3: function to fetch effective shift settings, auto-promoting pending → active
CREATE OR REPLACE FUNCTION public.get_effective_shift_settings(_casino_id uuid)
RETURNS TABLE(shift_end text, breaklist_lock text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today date;
  _row casinos%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.casinos WHERE id = _casino_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Compute today's business date in EAT (UTC+3) using current shift_end
  _today := (
    (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date
    - CASE
        WHEN EXTRACT(HOUR FROM (now() AT TIME ZONE 'Africa/Dar_es_Salaam')) <
             COALESCE(split_part(_row.shift_end, ':', 1)::int, 5)
        THEN 1 ELSE 0
      END
  );

  -- Promote shift_end_pending if its activation date has arrived
  IF _row.shift_end_pending IS NOT NULL
     AND _row.shift_end_pending_from IS NOT NULL
     AND _today >= _row.shift_end_pending_from THEN
    UPDATE public.casinos
       SET shift_end = _row.shift_end_pending,
           shift_end_pending = NULL,
           shift_end_pending_from = NULL
     WHERE id = _casino_id;
    _row.shift_end := _row.shift_end_pending;
  END IF;

  -- Promote breaklist_lock_pending if its activation date has arrived
  IF _row.breaklist_lock_pending IS NOT NULL
     AND _row.breaklist_lock_pending_from IS NOT NULL
     AND _today >= _row.breaklist_lock_pending_from THEN
    UPDATE public.casinos
       SET breaklist_lock = _row.breaklist_lock_pending,
           breaklist_lock_pending = NULL,
           breaklist_lock_pending_from = NULL
     WHERE id = _casino_id;
    _row.breaklist_lock := _row.breaklist_lock_pending;
  END IF;

  RETURN QUERY SELECT _row.shift_end, _row.breaklist_lock;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_shift_settings(uuid) TO authenticated;