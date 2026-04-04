
-- 1) Create a function to compute business date based on casino shift_end
CREATE OR REPLACE FUNCTION public.get_business_date_for_casino(_casino_id uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN CURRENT_TIME < (c.shift_end || ':00')::time
    THEN CURRENT_DATE - 1
    ELSE CURRENT_DATE
  END
  FROM casinos c
  WHERE c.id = _casino_id
$$;

-- 2) Trigger for casino_visits to set correct business date on insert
CREATE OR REPLACE FUNCTION public.trg_set_visit_business_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.date := get_business_date_for_casino(NEW.casino_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_visit_business_date ON casino_visits;
CREATE TRIGGER set_visit_business_date
  BEFORE INSERT ON casino_visits
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_visit_business_date();

-- 3) Tighten player_cards INSERT — only reception/manager
DROP POLICY IF EXISTS "Authorized users manage cards" ON player_cards;
CREATE POLICY "Authorized roles manage cards"
  ON player_cards FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'reception'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
    AND EXISTS (
      SELECT 1 FROM players p
      WHERE p.id = player_cards.player_id
        AND p.casino_id = get_user_casino_id(auth.uid())
    )
  );

-- 4) Tighten player_notes INSERT — only specific roles
DROP POLICY IF EXISTS "Users create player notes" ON player_notes;
CREATE POLICY "Authorized roles create player notes"
  ON player_notes FOR INSERT TO authenticated
  WITH CHECK (
    casino_id = get_user_casino_id(auth.uid())
    AND created_by = auth.uid()
    AND (
      has_role(auth.uid(), 'reception'::app_role)
      OR has_role(auth.uid(), 'pit'::app_role)
      OR has_role(auth.uid(), 'cashier'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
    )
  );
