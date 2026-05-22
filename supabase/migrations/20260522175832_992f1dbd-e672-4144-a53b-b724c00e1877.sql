ALTER TABLE public.breaklist_logs DROP CONSTRAINT breaklist_logs_breaklist_id_fkey;
ALTER TABLE public.breaklist_logs ADD CONSTRAINT breaklist_logs_breaklist_id_fkey FOREIGN KEY (breaklist_id) REFERENCES public.breaklist(id) ON DELETE CASCADE;

ALTER TABLE public.breaklist_logs DISABLE TRIGGER no_delete_breaklist_logs;
DELETE FROM public.breaklist WHERE id IN ('1c99e614-6253-4775-866d-8c940171ae8e','9c39f339-9b91-47d8-bd03-908cb36f18a8');
ALTER TABLE public.breaklist_logs ENABLE TRIGGER no_delete_breaklist_logs;