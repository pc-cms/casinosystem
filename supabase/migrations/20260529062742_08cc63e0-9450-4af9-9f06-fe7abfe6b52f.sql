ALTER TABLE public.cage_slots_transfers DROP CONSTRAINT cage_slots_transfers_amount_check;
ALTER TABLE public.cage_slots_transfers ADD CONSTRAINT cage_slots_transfers_amount_check CHECK (amount <> 0);
ALTER TABLE public.cage_transfers DROP CONSTRAINT IF EXISTS cage_transfers_amount_check;
ALTER TABLE public.cage_transfers ADD CONSTRAINT cage_transfers_amount_check CHECK (amount <> 0);