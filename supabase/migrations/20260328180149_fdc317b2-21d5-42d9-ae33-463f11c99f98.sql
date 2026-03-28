
-- ============================================
-- CASINO MANAGEMENT SYSTEM - FULL SCHEMA
-- ============================================

-- 1. ENUMS
CREATE TYPE public.app_role AS ENUM ('cashier', 'pit', 'manager', 'reception');
CREATE TYPE public.player_status AS ENUM ('active', 'blacklist');
CREATE TYPE public.card_type AS ENUM ('manual', 'rfid');
CREATE TYPE public.transaction_type AS ENUM ('buy', 'cashout');
CREATE TYPE public.expense_category AS ENUM ('food', 'alcohol', 'taxi', 'hotel', 'flight', 'other');
CREATE TYPE public.table_status AS ENUM ('open', 'closed');
CREATE TYPE public.shift_type AS ENUM ('M', 'N', 'A', 'S', 'E');
CREATE TYPE public.dealer_role AS ENUM ('BJ', 'BJi', 'AR1', 'AR1i', 'AR1c', 'BR');
CREATE TYPE public.log_category AS ENUM ('transaction', 'edit', 'lock', 'expense', 'player', 'system', 'breaklist', 'pit');

-- 2. CASINOS (multi-casino ready)
CREATE TABLE public.casinos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'Europe/London',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. PROFILES & ROLES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  casino_id UUID NOT NULL REFERENCES public.casinos(id),
  display_name TEXT NOT NULL,
  pin_hash TEXT,
  rfid_tag TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- 4. PLAYERS
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id UUID NOT NULL REFERENCES public.casinos(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  nickname TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  status player_status NOT NULL DEFAULT 'active',
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_players_casino ON public.players(casino_id);
CREATE INDEX idx_players_status ON public.players(casino_id, status);
CREATE INDEX idx_players_name ON public.players(casino_id, last_name, first_name);

-- 5. PLAYER CARDS
CREATE TABLE public.player_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id),
  card_number TEXT NOT NULL,
  card_type card_type NOT NULL DEFAULT 'manual',
  rfid_uid TEXT UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_player_cards_player ON public.player_cards(player_id);
CREATE INDEX idx_player_cards_rfid ON public.player_cards(rfid_uid) WHERE rfid_uid IS NOT NULL;
CREATE INDEX idx_player_cards_number ON public.player_cards(card_number);

-- 6. PLAYER TAGS
CREATE TABLE public.player_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id),
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(player_id, tag)
);

CREATE INDEX idx_player_tags_player ON public.player_tags(player_id);

-- Max 5 tags per player
CREATE OR REPLACE FUNCTION public.check_max_tags()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.player_tags WHERE player_id = NEW.player_id) >= 5 THEN
    RAISE EXCEPTION 'Maximum 5 tags per player';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_max_tags BEFORE INSERT ON public.player_tags FOR EACH ROW EXECUTE FUNCTION public.check_max_tags();

-- Tag conflicts
CREATE TABLE public.tag_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_a TEXT NOT NULL,
  tag_b TEXT NOT NULL,
  UNIQUE(tag_a, tag_b)
);

CREATE OR REPLACE FUNCTION public.check_tag_conflicts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.player_tags pt
    JOIN public.tag_conflicts tc ON (tc.tag_a = NEW.tag AND tc.tag_b = pt.tag) OR (tc.tag_b = NEW.tag AND tc.tag_a = pt.tag)
    WHERE pt.player_id = NEW.player_id
  ) THEN
    RAISE EXCEPTION 'Tag conflict: % conflicts with existing tags', NEW.tag;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_tag_conflicts BEFORE INSERT ON public.player_tags FOR EACH ROW EXECUTE FUNCTION public.check_tag_conflicts();

-- 7. GAMING TABLES
CREATE TABLE public.gaming_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id UUID NOT NULL REFERENCES public.casinos(id),
  name TEXT NOT NULL,
  game TEXT NOT NULL,
  status table_status NOT NULL DEFAULT 'open',
  float_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  denominations INTEGER[] NOT NULL DEFAULT '{5,25,100,500,1000}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gaming_tables_casino ON public.gaming_tables(casino_id);

-- 8. TRANSACTIONS (immutable)
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id UUID NOT NULL REFERENCES public.casinos(id),
  player_id UUID NOT NULL REFERENCES public.players(id),
  table_id UUID REFERENCES public.gaming_tables(id),
  type transaction_type NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  chips JSONB,
  operator_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_casino ON public.transactions(casino_id);
CREATE INDEX idx_transactions_player ON public.transactions(player_id);
CREATE INDEX idx_transactions_table ON public.transactions(table_id);
CREATE INDEX idx_transactions_created ON public.transactions(casino_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_transaction_modify()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Transactions are immutable and cannot be modified or deleted';
END;
$$;

CREATE TRIGGER no_update_transactions BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.prevent_transaction_modify();
CREATE TRIGGER no_delete_transactions BEFORE DELETE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.prevent_transaction_modify();

-- 9. EXPENSES
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id UUID NOT NULL REFERENCES public.casinos(id),
  category expense_category NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL DEFAULT '',
  player_id UUID REFERENCES public.players(id),
  approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_casino ON public.expenses(casino_id);
CREATE INDEX idx_expenses_player ON public.expenses(player_id) WHERE player_id IS NOT NULL;

-- 10. PLAYER GROUPS
CREATE TABLE public.player_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id UUID NOT NULL REFERENCES public.casinos(id),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.player_groups(id),
  player_id UUID NOT NULL REFERENCES public.players(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  UNIQUE(group_id, player_id, joined_at)
);

CREATE INDEX idx_group_members_group ON public.group_members(group_id);
CREATE INDEX idx_group_members_player ON public.group_members(player_id);

-- 11. DEALERS
CREATE TABLE public.dealers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id UUID NOT NULL REFERENCES public.casinos(id),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dealers_casino ON public.dealers(casino_id);

-- 12. PIT ROTA
CREATE TABLE public.pit_rota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id UUID NOT NULL REFERENCES public.casinos(id),
  dealer_id UUID NOT NULL REFERENCES public.dealers(id),
  shift shift_type NOT NULL,
  date DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(dealer_id, date)
);

CREATE INDEX idx_pit_rota_casino_date ON public.pit_rota(casino_id, date);

-- 13. BREAKLIST
CREATE TABLE public.breaklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id UUID NOT NULL REFERENCES public.casinos(id),
  date DATE NOT NULL,
  dealer_id UUID NOT NULL REFERENCES public.dealers(id),
  time_slot TEXT NOT NULL,
  role dealer_role NOT NULL DEFAULT 'BR',
  table_id UUID REFERENCES public.gaming_tables(id),
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_by UUID REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(casino_id, date, dealer_id, time_slot)
);

CREATE INDEX idx_breaklist_casino_date ON public.breaklist(casino_id, date);

-- One dealer per slot per table
CREATE OR REPLACE FUNCTION public.check_one_dealer_per_slot()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.table_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.breaklist
    WHERE casino_id = NEW.casino_id AND date = NEW.date AND time_slot = NEW.time_slot
      AND table_id = NEW.table_id AND dealer_id != NEW.dealer_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Only one dealer per table per time slot';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_one_dealer_per_slot BEFORE INSERT OR UPDATE ON public.breaklist FOR EACH ROW EXECUTE FUNCTION public.check_one_dealer_per_slot();

-- 14. TABLE TRACKER
CREATE TABLE public.table_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id UUID NOT NULL REFERENCES public.casinos(id),
  table_id UUID NOT NULL REFERENCES public.gaming_tables(id),
  date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(table_id, date, time_slot)
);

CREATE INDEX idx_table_tracker_casino_date ON public.table_tracker(casino_id, date);

-- 15. ACTIVITY LOGS (immutable)
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id UUID NOT NULL REFERENCES public.casinos(id),
  category log_category NOT NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  operator_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_casino ON public.activity_logs(casino_id, created_at DESC);
CREATE INDEX idx_activity_logs_category ON public.activity_logs(casino_id, category);

CREATE TRIGGER no_update_logs BEFORE UPDATE ON public.activity_logs FOR EACH ROW EXECUTE FUNCTION public.prevent_transaction_modify();
CREATE TRIGGER no_delete_logs BEFORE DELETE ON public.activity_logs FOR EACH ROW EXECUTE FUNCTION public.prevent_transaction_modify();

-- 16. UTILITY FUNCTIONS
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_breaklist_updated_at BEFORE UPDATE ON public.breaklist FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE SEQUENCE public.card_number_seq START 1001;

CREATE OR REPLACE FUNCTION public.generate_card_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN '0001' || LPAD(nextval('public.card_number_seq')::TEXT, 3, '0') || '+';
END;
$$;

-- 17. SECURITY DEFINER FUNCTIONS FOR RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_casino_id(_user_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT casino_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- 18. ROW LEVEL SECURITY

ALTER TABLE public.casinos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their casino" ON public.casinos FOR SELECT TO authenticated USING (id = public.get_user_casino_id(auth.uid()));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see profiles in their casino" ON public.profiles FOR SELECT TO authenticated USING (casino_id = public.get_user_casino_id(auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "System inserts profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Managers insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Managers delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'manager'));

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Casino users see players" ON public.players FOR SELECT TO authenticated USING (casino_id = public.get_user_casino_id(auth.uid()));
CREATE POLICY "Authorized users create players" ON public.players FOR INSERT TO authenticated WITH CHECK (casino_id = public.get_user_casino_id(auth.uid()));
CREATE POLICY "Authorized users update players" ON public.players FOR UPDATE TO authenticated USING (casino_id = public.get_user_casino_id(auth.uid()));

ALTER TABLE public.player_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Casino users see cards" ON public.player_cards FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.casino_id = public.get_user_casino_id(auth.uid())));
CREATE POLICY "Authorized users manage cards" ON public.player_cards FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.casino_id = public.get_user_casino_id(auth.uid())));
CREATE POLICY "Authorized users update cards" ON public.player_cards FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.casino_id = public.get_user_casino_id(auth.uid())));

ALTER TABLE public.player_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Casino users see tags" ON public.player_tags FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.casino_id = public.get_user_casino_id(auth.uid())));
CREATE POLICY "Users manage tags" ON public.player_tags FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.casino_id = public.get_user_casino_id(auth.uid())));
CREATE POLICY "Managers delete tags" ON public.player_tags FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'manager') AND EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id AND p.casino_id = public.get_user_casino_id(auth.uid())));

ALTER TABLE public.tag_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone sees tag conflicts" ON public.tag_conflicts FOR SELECT TO authenticated USING (true);

ALTER TABLE public.gaming_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Casino users see tables" ON public.gaming_tables FOR SELECT TO authenticated USING (casino_id = public.get_user_casino_id(auth.uid()));
CREATE POLICY "Managers insert tables" ON public.gaming_tables FOR INSERT TO authenticated WITH CHECK (casino_id = public.get_user_casino_id(auth.uid()) AND public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Managers update tables" ON public.gaming_tables FOR UPDATE TO authenticated USING (casino_id = public.get_user_casino_id(auth.uid()) AND public.has_role(auth.uid(), 'manager'));

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Casino users see transactions" ON public.transactions FOR SELECT TO authenticated USING (casino_id = public.get_user_casino_id(auth.uid()));
CREATE POLICY "Cashiers create transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (casino_id = public.get_user_casino_id(auth.uid()) AND operator_id = auth.uid() AND (public.has_role(auth.uid(), 'cashier') OR public.has_role(auth.uid(), 'manager')));

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Casino users see expenses" ON public.expenses FOR SELECT TO authenticated USING (casino_id = public.get_user_casino_id(auth.uid()));
CREATE POLICY "Users create expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (casino_id = public.get_user_casino_id(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Managers approve expenses" ON public.expenses FOR UPDATE TO authenticated USING (casino_id = public.get_user_casino_id(auth.uid()) AND public.has_role(auth.uid(), 'manager'));

ALTER TABLE public.player_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Casino users see groups" ON public.player_groups FOR SELECT TO authenticated USING (casino_id = public.get_user_casino_id(auth.uid()));
CREATE POLICY "Managers insert groups" ON public.player_groups FOR INSERT TO authenticated WITH CHECK (casino_id = public.get_user_casino_id(auth.uid()) AND public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Managers update groups" ON public.player_groups FOR UPDATE TO authenticated USING (casino_id = public.get_user_casino_id(auth.uid()) AND public.has_role(auth.uid(), 'manager'));

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Casino users see members" ON public.group_members FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.player_groups g WHERE g.id = group_id AND g.casino_id = public.get_user_casino_id(auth.uid())));
CREATE POLICY "Managers insert members" ON public.group_members FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'manager') AND EXISTS (SELECT 1 FROM public.player_groups g WHERE g.id = group_id AND g.casino_id = public.get_user_casino_id(auth.uid())));
CREATE POLICY "Managers update members" ON public.group_members FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'manager') AND EXISTS (SELECT 1 FROM public.player_groups g WHERE g.id = group_id AND g.casino_id = public.get_user_casino_id(auth.uid())));

ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Casino users see dealers" ON public.dealers FOR SELECT TO authenticated USING (casino_id = public.get_user_casino_id(auth.uid()));
CREATE POLICY "Pit managers insert dealers" ON public.dealers FOR INSERT TO authenticated WITH CHECK (casino_id = public.get_user_casino_id(auth.uid()) AND (public.has_role(auth.uid(), 'pit') OR public.has_role(auth.uid(), 'manager')));
CREATE POLICY "Pit managers update dealers" ON public.dealers FOR UPDATE TO authenticated USING (casino_id = public.get_user_casino_id(auth.uid()) AND (public.has_role(auth.uid(), 'pit') OR public.has_role(auth.uid(), 'manager')));

ALTER TABLE public.pit_rota ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Casino users see rota" ON public.pit_rota FOR SELECT TO authenticated USING (casino_id = public.get_user_casino_id(auth.uid()));
CREATE POLICY "Pit managers insert rota" ON public.pit_rota FOR INSERT TO authenticated WITH CHECK (casino_id = public.get_user_casino_id(auth.uid()) AND (public.has_role(auth.uid(), 'pit') OR public.has_role(auth.uid(), 'manager')));
CREATE POLICY "Pit managers update rota" ON public.pit_rota FOR UPDATE TO authenticated USING (casino_id = public.get_user_casino_id(auth.uid()) AND (public.has_role(auth.uid(), 'pit') OR public.has_role(auth.uid(), 'manager')));
CREATE POLICY "Pit managers delete rota" ON public.pit_rota FOR DELETE TO authenticated USING (casino_id = public.get_user_casino_id(auth.uid()) AND (public.has_role(auth.uid(), 'pit') OR public.has_role(auth.uid(), 'manager')));

ALTER TABLE public.breaklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Casino users see breaklist" ON public.breaklist FOR SELECT TO authenticated USING (casino_id = public.get_user_casino_id(auth.uid()));
CREATE POLICY "Pit managers insert breaklist" ON public.breaklist FOR INSERT TO authenticated WITH CHECK (casino_id = public.get_user_casino_id(auth.uid()) AND (public.has_role(auth.uid(), 'pit') OR public.has_role(auth.uid(), 'manager')));
CREATE POLICY "Breaklist update policy" ON public.breaklist FOR UPDATE TO authenticated USING (casino_id = public.get_user_casino_id(auth.uid()) AND ((NOT is_locked AND (public.has_role(auth.uid(), 'pit') OR public.has_role(auth.uid(), 'manager'))) OR public.has_role(auth.uid(), 'manager')));

ALTER TABLE public.table_tracker ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Casino users see tracker" ON public.table_tracker FOR SELECT TO authenticated USING (casino_id = public.get_user_casino_id(auth.uid()));
CREATE POLICY "Pit managers insert tracker" ON public.table_tracker FOR INSERT TO authenticated WITH CHECK (casino_id = public.get_user_casino_id(auth.uid()) AND (public.has_role(auth.uid(), 'pit') OR public.has_role(auth.uid(), 'manager')));
CREATE POLICY "Pit managers update tracker" ON public.table_tracker FOR UPDATE TO authenticated USING (casino_id = public.get_user_casino_id(auth.uid()) AND (public.has_role(auth.uid(), 'pit') OR public.has_role(auth.uid(), 'manager')));

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Casino users see logs" ON public.activity_logs FOR SELECT TO authenticated USING (casino_id = public.get_user_casino_id(auth.uid()));
CREATE POLICY "Users create logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (casino_id = public.get_user_casino_id(auth.uid()) AND operator_id = auth.uid());

-- 19. PLAYER ECONOMY VIEW
CREATE OR REPLACE VIEW public.player_economy AS
SELECT 
  p.id AS player_id, p.casino_id, p.first_name, p.last_name, p.nickname, p.status,
  COALESCE(buy.total, 0) AS total_drop,
  COALESCE(cash.total, 0) AS total_cashout,
  COALESCE(exp.total, 0) AS total_expenses,
  COALESCE(cash.total, 0) - COALESCE(buy.total, 0) - COALESCE(exp.total, 0) AS real_result
FROM public.players p
LEFT JOIN LATERAL (SELECT SUM(amount) AS total FROM public.transactions WHERE player_id = p.id AND type = 'buy') buy ON true
LEFT JOIN LATERAL (SELECT SUM(amount) AS total FROM public.transactions WHERE player_id = p.id AND type = 'cashout') cash ON true
LEFT JOIN LATERAL (SELECT SUM(amount) AS total FROM public.expenses WHERE player_id = p.id AND approved = true) exp ON true;

-- 20. AUTO-CREATE PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE default_casino_id UUID;
BEGIN
  SELECT id INTO default_casino_id FROM public.casinos LIMIT 1;
  INSERT INTO public.profiles (user_id, casino_id, display_name)
  VALUES (NEW.id, default_casino_id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 21. SEED DATA
INSERT INTO public.casinos (name, code) VALUES ('Main Casino', 'MAIN');
INSERT INTO public.tag_conflicts (tag_a, tag_b) VALUES ('No Alcohol', 'Free Drinks'), ('VIP', 'Watch List');
