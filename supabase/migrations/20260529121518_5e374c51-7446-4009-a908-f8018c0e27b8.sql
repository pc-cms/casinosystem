CREATE OR REPLACE FUNCTION public.trg_persist_slots_shift_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE j jsonb;
BEGIN
  IF (TG_OP = 'INSERT')
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.system_shift_result IS DISTINCT FROM OLD.system_shift_result
     OR NEW.cashless_final IS DISTINCT FROM OLD.cashless_final
     -- Always recompute on any update to a closed/approved shift so admin-driven
     -- formula recomputes (e.g. via a no-op UPDATE) are honored.
     OR (TG_OP = 'UPDATE' AND NEW.status IN ('ready_for_review', 'approved', 'closed')) THEN

    IF NEW.status IN ('ready_for_review', 'approved', 'closed') THEN
      j := public.compute_slots_shift_balance_from_row(NEW);
      NEW.cash_desk_result   := (j->>'cash_desk_result')::bigint;
      NEW.cards_miss         := (j->>'cards_miss')::bigint;
      NEW.slots_result       := (j->>'slots_result')::bigint;
      NEW.balance            := (j->>'balance')::bigint;
      NEW.actual_cage_result := (j->>'cash_desk_result')::bigint;
      NEW.difference_amount  := (j->>'cash_desk_result')::bigint;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Force recompute on every closed/approved/ready shift now that the trigger is fixed.
UPDATE public.cage_slots_shifts
   SET updated_at = COALESCE(updated_at, now())
 WHERE status IN ('ready_for_review', 'approved', 'closed');