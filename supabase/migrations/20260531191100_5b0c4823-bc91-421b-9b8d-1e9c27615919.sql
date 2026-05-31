ALTER TABLE public.cage_transfers DISABLE TRIGGER USER;
ALTER TABLE public.cage_slots_transfers DISABLE TRIGGER USER;

-- Clear mutual links so FKs allow deletion
UPDATE public.cage_slots_transfers SET counterpart_lg_transfer_id = NULL
WHERE transfer_type IN ('lg_in','lg_out')
  AND created_at >= ((date_trunc('day', (now() AT TIME ZONE 'Africa/Dar_es_Salaam')) + interval '7 hours') AT TIME ZONE 'Africa/Dar_es_Salaam');

UPDATE public.cage_transfers SET counterpart_slots_transfer_id = NULL
WHERE transfer_type IN ('slots_in','slots_out')
  AND created_at >= ((date_trunc('day', (now() AT TIME ZONE 'Africa/Dar_es_Salaam')) + interval '7 hours') AT TIME ZONE 'Africa/Dar_es_Salaam');

DELETE FROM public.cage_slots_transfers
WHERE transfer_type IN ('lg_in','lg_out')
  AND created_at >= ((date_trunc('day', (now() AT TIME ZONE 'Africa/Dar_es_Salaam')) + interval '7 hours') AT TIME ZONE 'Africa/Dar_es_Salaam');

DELETE FROM public.cage_transfers
WHERE transfer_type IN ('slots_in','slots_out')
  AND created_at >= ((date_trunc('day', (now() AT TIME ZONE 'Africa/Dar_es_Salaam')) + interval '7 hours') AT TIME ZONE 'Africa/Dar_es_Salaam');

ALTER TABLE public.cage_transfers ENABLE TRIGGER USER;
ALTER TABLE public.cage_slots_transfers ENABLE TRIGGER USER;