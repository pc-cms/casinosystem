
-- Drop potentially existing triggers first (safe idempotent approach)
DROP TRIGGER IF EXISTS prevent_transaction_modify ON public.transactions;
DROP TRIGGER IF EXISTS validate_transaction_shift ON public.transactions;
DROP TRIGGER IF EXISTS check_max_tags ON public.player_tags;
DROP TRIGGER IF EXISTS check_tag_conflicts ON public.player_tags;
DROP TRIGGER IF EXISTS check_one_dealer_per_slot ON public.breaklist;
DROP TRIGGER IF EXISTS clear_future_breaklist_on_shift ON public.pit_rota;
DROP TRIGGER IF EXISTS update_players_updated_at ON public.players;
DROP TRIGGER IF EXISTS update_breaklist_updated_at ON public.breaklist;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS validate_transaction_amount ON public.transactions;
DROP TRIGGER IF EXISTS validate_expense ON public.expenses;
DROP TRIGGER IF EXISTS prevent_duplicate_player ON public.players;
DROP TRIGGER IF EXISTS validate_card_uniqueness ON public.player_cards;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- ============================================================
-- ATTACH ALL TRIGGERS
-- ============================================================

CREATE TRIGGER prevent_transaction_modify
  BEFORE UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_transaction_modify();

CREATE TRIGGER validate_transaction_shift
  BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.validate_transaction_shift();

CREATE TRIGGER check_max_tags
  BEFORE INSERT ON public.player_tags
  FOR EACH ROW EXECUTE FUNCTION public.check_max_tags();

CREATE TRIGGER check_tag_conflicts
  BEFORE INSERT ON public.player_tags
  FOR EACH ROW EXECUTE FUNCTION public.check_tag_conflicts();

CREATE TRIGGER check_one_dealer_per_slot
  BEFORE INSERT OR UPDATE ON public.breaklist
  FOR EACH ROW EXECUTE FUNCTION public.check_one_dealer_per_slot();

CREATE TRIGGER clear_future_breaklist_on_shift
  AFTER INSERT OR UPDATE ON public.pit_rota
  FOR EACH ROW EXECUTE FUNCTION public.clear_future_breaklist_on_shift();

CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_breaklist_updated_at
  BEFORE UPDATE ON public.breaklist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- NEW: Transaction amount validation
CREATE OR REPLACE FUNCTION public.validate_transaction_amount()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Transaction amount must be greater than zero';
  END IF;
  IF NEW.operator_id IS NULL THEN
    RAISE EXCEPTION 'Transaction must have an operator_id';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_transaction_amount
  BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.validate_transaction_amount();

-- NEW: Expense validation
CREATE OR REPLACE FUNCTION public.validate_expense()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Expense amount must be greater than zero';
  END IF;
  IF NEW.category IS NULL THEN
    RAISE EXCEPTION 'Expense must have a category';
  END IF;
  IF NEW.created_by IS NULL THEN
    RAISE EXCEPTION 'Expense must have a creator';
  END IF;
  IF NEW.shift_id IS NULL THEN
    SELECT id INTO NEW.shift_id
    FROM public.shifts
    WHERE casino_id = NEW.casino_id AND status = 'open'
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_expense
  BEFORE INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.validate_expense();

-- NEW: Duplicate player prevention
CREATE OR REPLACE FUNCTION public.prevent_duplicate_player()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.players
    WHERE casino_id = NEW.casino_id
      AND LOWER(TRIM(first_name)) = LOWER(TRIM(NEW.first_name))
      AND LOWER(TRIM(last_name)) = LOWER(TRIM(NEW.last_name))
      AND TRIM(phone) = TRIM(NEW.phone)
      AND phone != ''
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Player with same name and phone already exists';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_duplicate_player
  BEFORE INSERT OR UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_player();

-- NEW: Card uniqueness
CREATE OR REPLACE FUNCTION public.validate_card_uniqueness()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.rfid_uid IS NOT NULL AND NEW.is_active = true THEN
    IF EXISTS (
      SELECT 1 FROM public.player_cards
      WHERE rfid_uid = NEW.rfid_uid AND is_active = true
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'RFID tag already assigned to another active card';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_card_uniqueness
  BEFORE INSERT OR UPDATE ON public.player_cards
  FOR EACH ROW EXECUTE FUNCTION public.validate_card_uniqueness();

-- Card number unique constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'player_cards_card_number_unique'
  ) THEN
    ALTER TABLE public.player_cards ADD CONSTRAINT player_cards_card_number_unique UNIQUE (card_number);
  END IF;
END $$;

-- Handle new user (on auth.users)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- REALTIME (idempotent — ignore errors for already-added tables)
-- ============================================================
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.players; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.breaklist; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.gaming_tables; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.table_tracker; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pit_rota; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
