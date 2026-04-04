
-- Add is_archived to gaming_tables
ALTER TABLE public.gaming_tables ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- Fix casinos RLS: super_admin and finance_manager see ALL casinos
CREATE POLICY "Super admins see all casinos"
ON public.casinos FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'finance_manager'));

-- Super admin can insert casinos
CREATE POLICY "Super admins insert casinos"
ON public.casinos FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Super admin can update any casino
CREATE POLICY "Super admins update casinos"
ON public.casinos FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- gaming_tables: super_admin sees all
CREATE POLICY "Super admins see all tables"
ON public.gaming_tables FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- gaming_tables: super_admin can insert to any casino
CREATE POLICY "Super admins insert tables"
ON public.gaming_tables FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- gaming_tables: super_admin can update any table
CREATE POLICY "Super admins update tables"
ON public.gaming_tables FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- players: super_admin sees all
CREATE POLICY "Super admins see all players"
ON public.players FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- transactions: super_admin sees all
CREATE POLICY "Super admins see all transactions"
ON public.transactions FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- expenses: super_admin sees all
CREATE POLICY "Super admins see all expenses"
ON public.expenses FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- shifts: super_admin sees all
CREATE POLICY "Super admins see all shifts"
ON public.shifts FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- casino_visits: super_admin sees all
CREATE POLICY "Super admins see all visits"
ON public.casino_visits FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- dealers: super_admin sees all
CREATE POLICY "Super admins see all dealers"
ON public.dealers FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- staff_members: super_admin sees all
CREATE POLICY "Super admins see all staff"
ON public.staff_members FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- activity_logs: super_admin sees all
CREATE POLICY "Super admins see all logs"
ON public.activity_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- daily_summaries: super_admin sees all
CREATE POLICY "Super admins see all summaries"
ON public.daily_summaries FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- financial_wallets: super_admin sees all
CREATE POLICY "Super admins see all wallets"
ON public.financial_wallets FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- profiles: super_admin sees all
CREATE POLICY "Super admins see all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- breaklist: super_admin sees all
CREATE POLICY "Super admins see all breaklist"
ON public.breaklist FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- chip_inventory: super_admin sees all
CREATE POLICY "Super admins see all chip inventory"
ON public.chip_inventory FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- chip_snapshots: super_admin sees all
CREATE POLICY "Super admins see all chip snapshots"
ON public.chip_snapshots FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- cash_counts: super_admin sees all
CREATE POLICY "Super admins see all cash counts"
ON public.cash_counts FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- cash_count_snapshots: super_admin sees all
CREATE POLICY "Super admins see all cash count snapshots"
ON public.cash_count_snapshots FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- wallet_transactions: super_admin sees all
CREATE POLICY "Super admins see all wallet transactions"
ON public.wallet_transactions FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- client_sessions: super_admin sees all
CREATE POLICY "Super admins see all client sessions"
ON public.client_sessions FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- dealer_attendance: super_admin sees all
CREATE POLICY "Super admins see all dealer attendance"
ON public.dealer_attendance FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- staff_attendance: super_admin sees all
CREATE POLICY "Super admins see all staff attendance"
ON public.staff_attendance FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- pit_rota: super_admin sees all
CREATE POLICY "Super admins see all pit rota"
ON public.pit_rota FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- staff_rota: super_admin sees all
CREATE POLICY "Super admins see all staff rota"
ON public.staff_rota FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- chip_baseline: super_admin sees all
CREATE POLICY "Super admins see all chip baseline"
ON public.chip_baseline FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- player_groups: super_admin sees all
CREATE POLICY "Super admins see all groups"
ON public.player_groups FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- group_members: super_admin sees all
CREATE POLICY "Super admins see all group members"
ON public.group_members FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- player_notes: super_admin sees all
CREATE POLICY "Super admins see all player notes"
ON public.player_notes FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- player_tags: super_admin sees all
CREATE POLICY "Super admins see all player tags"
ON public.player_tags FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- player_cards: super_admin sees all
CREATE POLICY "Super admins see all player cards"
ON public.player_cards FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- budget tables: super_admin sees all
CREATE POLICY "Super admins see all budget categories"
ON public.budget_categories FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins see all budget items"
ON public.budget_items FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins see all budget periods"
ON public.budget_periods FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins see all budget logs"
ON public.budget_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- breaklist_logs: super_admin sees all
CREATE POLICY "Super admins see all breaklist logs"
ON public.breaklist_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- table_tracker: super_admin sees all
CREATE POLICY "Super admins see all table tracker"
ON public.table_tracker FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'));
