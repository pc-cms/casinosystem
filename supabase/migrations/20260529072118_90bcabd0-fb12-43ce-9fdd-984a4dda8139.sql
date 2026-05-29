
-- 1. Compute Z-report for a POS shift (read-only)
CREATE OR REPLACE FUNCTION public.pos_compute_z_report(_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift public.pos_shifts%ROWTYPE;
  v_totals jsonb;
  v_by_category jsonb;
  v_by_item jsonb;
  v_counts jsonb;
  v_cash bigint := 0;
  v_expected bigint := 0;
BEGIN
  SELECT * INTO v_shift FROM public.pos_shifts WHERE id = _shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pos_compute_z_report: shift not found';
  END IF;

  -- Payment totals across closed tabs of the shift
  WITH closed_tabs AS (
    SELECT total_tzs, COALESCE(payment_split, '{}'::jsonb) AS ps
      FROM public.pos_tabs
     WHERE shift_id = _shift_id AND status = 'closed'
  )
  SELECT jsonb_build_object(
    'gross_tzs',  COALESCE(SUM(total_tzs), 0),
    'cash',       COALESCE(SUM(COALESCE((ps->>'cash')::bigint, 0)), 0),
    'card',       COALESCE(SUM(COALESCE((ps->>'card')::bigint, 0)), 0),
    'comp_player',COALESCE(SUM(COALESCE((ps->>'comp_player')::bigint, 0)), 0),
    'comp_house', COALESCE(SUM(COALESCE((ps->>'comp_house')::bigint, 0)), 0)
  )
  INTO v_totals
  FROM closed_tabs;

  v_cash := COALESCE((v_totals->>'cash')::bigint, 0);
  v_expected := COALESCE(v_shift.opening_cash, 0) + v_cash;

  -- Items aggregated from non-void orders of closed tabs
  WITH lines AS (
    SELECT poi.item_id, poi.item_name, poi.qty, poi.line_total_tzs,
           pi.category_id, pc.name AS category_name
      FROM public.pos_order_items poi
      JOIN public.pos_orders po ON po.id = poi.order_id
      JOIN public.pos_tabs   pt ON pt.id = po.tab_id
      LEFT JOIN public.pos_items pi      ON pi.id = poi.item_id
      LEFT JOIN public.pos_categories pc ON pc.id = pi.category_id
     WHERE pt.shift_id = _shift_id
       AND pt.status = 'closed'
       AND po.status <> 'void'
  )
  SELECT
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'category_name', COALESCE(category_name,'—'),
        'qty', SUM(qty),
        'total_tzs', SUM(line_total_tzs)
      ) ORDER BY SUM(line_total_tzs) DESC)
      FROM (SELECT category_name, SUM(qty) AS qty, SUM(line_total_tzs) AS line_total_tzs
              FROM lines GROUP BY category_name) c), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'item_id', item_id,
        'item_name', item_name,
        'qty', qty,
        'total_tzs', total_tzs
      ) ORDER BY total_tzs DESC)
      FROM (SELECT item_id, item_name, SUM(qty) AS qty, SUM(line_total_tzs) AS total_tzs
              FROM lines GROUP BY item_id, item_name) i), '[]'::jsonb)
  INTO v_by_category, v_by_item;

  -- Counts
  SELECT jsonb_build_object(
    'tabs_closed',  (SELECT COUNT(*) FROM public.pos_tabs   WHERE shift_id = _shift_id AND status = 'closed'),
    'tabs_voided',  (SELECT COUNT(*) FROM public.pos_tabs   WHERE shift_id = _shift_id AND status = 'voided'),
    'orders_total', (SELECT COUNT(*) FROM public.pos_orders WHERE shift_id = _shift_id),
    'orders_void',  (SELECT COUNT(*) FROM public.pos_orders WHERE shift_id = _shift_id AND status = 'void')
  ) INTO v_counts;

  RETURN jsonb_build_object(
    'shift_id',        v_shift.id,
    'casino_id',       v_shift.casino_id,
    'waiter_user_id',  v_shift.waiter_user_id,
    'opened_at',       v_shift.opened_at,
    'closed_at',       v_shift.closed_at,
    'opening_cash',    COALESCE(v_shift.opening_cash, 0),
    'closing_cash',    v_shift.closing_cash,
    'totals',          v_totals,
    'expected_cash',   v_expected,
    'cash_delta',      COALESCE(v_shift.closing_cash, 0) - v_expected,
    'counts',          v_counts,
    'by_category',     v_by_category,
    'by_item',         v_by_item,
    'computed_at',     now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_compute_z_report(uuid) TO authenticated;

-- 2. Close a POS shift atomically
CREATE OR REPLACE FUNCTION public.pos_close_shift(_shift_id uuid, _closing_cash bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift public.pos_shifts%ROWTYPE;
  v_open_tabs int;
  v_z jsonb;
BEGIN
  IF _closing_cash IS NULL OR _closing_cash < 0 THEN
    RAISE EXCEPTION 'pos_close_shift: closing_cash must be >= 0';
  END IF;

  SELECT * INTO v_shift FROM public.pos_shifts WHERE id = _shift_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pos_close_shift: shift not found';
  END IF;
  IF v_shift.closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'pos_close_shift: shift already closed';
  END IF;

  -- Permission: shift owner, pos_manager, or super_admin
  IF NOT (
    v_shift.waiter_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'pos_manager')
    OR public.has_role(auth.uid(), 'super_admin')
  ) THEN
    RAISE EXCEPTION 'pos_close_shift: not permitted';
  END IF;

  -- No open tabs allowed
  SELECT COUNT(*) INTO v_open_tabs
    FROM public.pos_tabs
   WHERE shift_id = _shift_id AND status = 'open';
  IF v_open_tabs > 0 THEN
    RAISE EXCEPTION 'pos_close_shift: % open tab(s) must be closed first', v_open_tabs;
  END IF;

  -- Stamp close fields, then compute z_report against the closed snapshot
  UPDATE public.pos_shifts
     SET closed_at    = now(),
         closing_cash = _closing_cash
   WHERE id = _shift_id;

  v_z := public.pos_compute_z_report(_shift_id);

  UPDATE public.pos_shifts
     SET z_report = v_z
   WHERE id = _shift_id;

  RETURN v_z;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_close_shift(uuid, bigint) TO authenticated;

-- 3. Immutability guard: once closed, the shift snapshot cannot change
CREATE OR REPLACE FUNCTION public.pos_shifts_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.closed_at IS NOT NULL THEN
    -- After close, nothing may change
    IF ROW(NEW.opened_at, NEW.closed_at, NEW.opening_cash, NEW.closing_cash,
           NEW.waiter_user_id, NEW.casino_id, NEW.z_report)
       IS DISTINCT FROM
       ROW(OLD.opened_at, OLD.closed_at, OLD.opening_cash, OLD.closing_cash,
           OLD.waiter_user_id, OLD.casino_id, OLD.z_report)
    THEN
      RAISE EXCEPTION 'pos_shifts: closed shift is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pos_shifts_guard ON public.pos_shifts;
CREATE TRIGGER trg_pos_shifts_guard
BEFORE UPDATE ON public.pos_shifts
FOR EACH ROW EXECUTE FUNCTION public.pos_shifts_guard();
