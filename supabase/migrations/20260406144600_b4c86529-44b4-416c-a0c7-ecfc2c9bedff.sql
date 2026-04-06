
-- Disable ALL immutability triggers
ALTER TABLE public.breaklist_logs DISABLE TRIGGER no_delete_breaklist_logs;
ALTER TABLE public.breaklist_logs DISABLE TRIGGER no_update_breaklist_logs;
ALTER TABLE public.activity_logs DISABLE TRIGGER no_delete_logs;
ALTER TABLE public.activity_logs DISABLE TRIGGER no_update_logs;
ALTER TABLE public.transactions DISABLE TRIGGER no_delete_transactions;
ALTER TABLE public.transactions DISABLE TRIGGER no_update_transactions;
ALTER TABLE public.transactions DISABLE TRIGGER prevent_transaction_modify_trigger;
ALTER TABLE public.transactions DISABLE TRIGGER prevent_transaction_modify;
ALTER TABLE public.transactions DISABLE TRIGGER trg_auto_log_transaction;
ALTER TABLE public.wallet_transactions DISABLE TRIGGER trg_prevent_wallet_tx_update;
ALTER TABLE public.wallet_transactions DISABLE TRIGGER trg_prevent_wallet_tx_delete;
ALTER TABLE public.wallet_transactions DISABLE TRIGGER trg_update_wallet_balances;
ALTER TABLE public.budget_logs DISABLE TRIGGER prevent_budget_log_update_delete;

-- Player-related
DELETE FROM player_tags WHERE player_id IN (SELECT id FROM players WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113');
DELETE FROM player_notes WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';
DELETE FROM player_cards WHERE player_id IN (SELECT id FROM players WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113');
DELETE FROM group_members WHERE player_id IN (SELECT id FROM players WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113');
DELETE FROM client_sessions WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';
DELETE FROM casino_visits WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';
DELETE FROM transactions WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';
DELETE FROM expenses WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';
DELETE FROM players WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';

-- Dealer-related
DELETE FROM breaklist_logs WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';
DELETE FROM breaklist WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';
DELETE FROM pit_rota WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';
DELETE FROM dealer_attendance WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';
DELETE FROM dealers WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';

-- Staff-related
DELETE FROM staff_rota WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';
DELETE FROM staff_attendance WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';
DELETE FROM staff_members WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';

-- Finance-related
DELETE FROM cash_counts WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';
DELETE FROM cash_count_snapshots WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';
DELETE FROM wallet_transactions WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';
DELETE FROM daily_summaries WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';
DELETE FROM table_tracker WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';

-- Chip-related
DELETE FROM chip_snapshots WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';
DELETE FROM chip_inventory WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';
DELETE FROM chip_baseline WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';

-- CCTV & Logs
DELETE FROM cctv_observations WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';
DELETE FROM activity_logs WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';

-- Shifts
DELETE FROM shifts WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';

-- Budget
DELETE FROM budget_logs WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';
DELETE FROM budget_items WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';
DELETE FROM budget_periods WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';
DELETE FROM budget_categories WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';

-- Reset gaming tables
UPDATE gaming_tables SET status = 'closed', closing_chips = NULL, closing_result = NULL, float_amount = 0
WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';

-- Reset casino float
UPDATE casinos SET cage_float = 0, float_locked = false
WHERE id = '48f4404f-7724-418c-8365-29af3998e113';

-- Reset wallet balances
UPDATE financial_wallets SET current_balance = 0
WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';

-- Re-enable ALL triggers
ALTER TABLE public.breaklist_logs ENABLE TRIGGER no_delete_breaklist_logs;
ALTER TABLE public.breaklist_logs ENABLE TRIGGER no_update_breaklist_logs;
ALTER TABLE public.activity_logs ENABLE TRIGGER no_delete_logs;
ALTER TABLE public.activity_logs ENABLE TRIGGER no_update_logs;
ALTER TABLE public.transactions ENABLE TRIGGER no_delete_transactions;
ALTER TABLE public.transactions ENABLE TRIGGER no_update_transactions;
ALTER TABLE public.transactions ENABLE TRIGGER prevent_transaction_modify_trigger;
ALTER TABLE public.transactions ENABLE TRIGGER prevent_transaction_modify;
ALTER TABLE public.transactions ENABLE TRIGGER trg_auto_log_transaction;
ALTER TABLE public.wallet_transactions ENABLE TRIGGER trg_prevent_wallet_tx_update;
ALTER TABLE public.wallet_transactions ENABLE TRIGGER trg_prevent_wallet_tx_delete;
ALTER TABLE public.wallet_transactions ENABLE TRIGGER trg_update_wallet_balances;
ALTER TABLE public.budget_logs ENABLE TRIGGER prevent_budget_log_update_delete;
