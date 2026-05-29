ALTER TABLE public.pos_menu_items
  ADD COLUMN IF NOT EXISTS bottle_size_ml NUMERIC,
  ADD COLUMN IF NOT EXISTS serving_size_ml NUMERIC,
  ADD COLUMN IF NOT EXISTS price_round_step_tzs BIGINT NOT NULL DEFAULT 500;

CREATE OR REPLACE FUNCTION public.pos_suggested_price(_item_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg NUMERIC;
  v_bottle NUMERIC;
  v_serv NUMERIC;
  v_step BIGINT;
  v_per_serv NUMERIC;
BEGIN
  SELECT COALESCE(avg_cost_tzs,0), bottle_size_ml, serving_size_ml, GREATEST(COALESCE(price_round_step_tzs,1),1)
    INTO v_avg, v_bottle, v_serv, v_step
    FROM public.pos_menu_items
    WHERE id = _item_id;

  IF v_avg IS NULL OR v_avg <= 0 THEN
    RETURN NULL;
  END IF;

  IF v_bottle IS NOT NULL AND v_serv IS NOT NULL AND v_bottle > 0 AND v_serv > 0 THEN
    v_per_serv := v_avg * v_serv / v_bottle;
  ELSE
    v_per_serv := v_avg;
  END IF;

  RETURN (CEIL(v_per_serv / v_step) * v_step)::BIGINT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_suggested_price(UUID) TO authenticated;