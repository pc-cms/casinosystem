
-- Temporarily disable immutable trigger to allow nullifying table references
ALTER TABLE public.transactions DISABLE TRIGGER no_update_transactions;

-- Nullify old table references
UPDATE public.transactions SET table_id = NULL WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113' AND table_id IS NOT NULL;

-- Re-enable trigger
ALTER TABLE public.transactions ENABLE TRIGGER no_update_transactions;

-- Clean up related data
DELETE FROM public.breaklist WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';
DELETE FROM public.table_tracker WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';
DELETE FROM public.chip_inventory WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';

-- Delete old gaming tables
DELETE FROM public.gaming_tables WHERE casino_id = '48f4404f-7724-418c-8365-29af3998e113';

-- Insert new tables
INSERT INTO public.gaming_tables (casino_id, name, game, denominations, float_amount, status) VALUES
('48f4404f-7724-418c-8365-29af3998e113', 'P1', 'Texas Holdem', '{500,1000,2000,5000,10000,25000,50000,100000,500000,1000000,5000000}', 0, 'open'),
('48f4404f-7724-418c-8365-29af3998e113', 'P2', 'Texas Holdem', '{500,1000,2000,5000,10000,25000,50000,100000,500000,1000000,5000000}', 0, 'open'),
('48f4404f-7724-418c-8365-29af3998e113', 'P3', 'Texas Holdem', '{500,1000,2000,5000,10000,25000,50000,100000,500000,1000000,5000000}', 0, 'open'),
('48f4404f-7724-418c-8365-29af3998e113', 'P4', 'Texas Holdem', '{500,1000,2000,5000,10000,25000,50000,100000,500000,1000000,5000000}', 0, 'open'),
('48f4404f-7724-418c-8365-29af3998e113', 'P5', 'Texas Holdem', '{500,1000,2000,5000,10000,25000,50000,100000,500000,1000000,5000000}', 0, 'open'),
('48f4404f-7724-418c-8365-29af3998e113', 'BJ1', 'Blackjack', '{500,1000,2000,5000,10000,25000,50000,100000,500000,1000000,5000000}', 0, 'open'),
('48f4404f-7724-418c-8365-29af3998e113', 'AR1', 'American Roulette', '{500,1000,2000,5000,10000,25000,50000,100000,500000,1000000,5000000}', 0, 'open'),
('48f4404f-7724-418c-8365-29af3998e113', 'AR2', 'American Roulette', '{500,1000,2000,5000,10000,25000,50000,100000,500000,1000000,5000000}', 0, 'open'),
('48f4404f-7724-418c-8365-29af3998e113', 'AR3', 'American Roulette', '{500,1000,2000,5000,10000,25000,50000,100000,500000,1000000,5000000}', 0, 'open');
