ALTER TABLE public.cage_slots_transfers DISABLE TRIGGER trg_prevent_cage_slots_transfer_modify;
DELETE FROM public.cage_slots_transfers WHERE id = 'c0e3eae9-7488-430a-a9dc-023acd5d53cb';
ALTER TABLE public.cage_slots_transfers ENABLE TRIGGER trg_prevent_cage_slots_transfer_modify;