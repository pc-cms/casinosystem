
CREATE TABLE IF NOT EXISTS public.node_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_node_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('restart_sync','repair_pairing','retry_errors','rebuild_snapshot','promote_self')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','popped','done','error')),
  issued_by uuid REFERENCES auth.users(id),
  issued_at timestamptz NOT NULL DEFAULT now(),
  popped_at timestamptz,
  completed_at timestamptz,
  result_text text
);

CREATE INDEX IF NOT EXISTS idx_node_commands_pending
  ON public.node_commands (target_node_id, issued_at) WHERE status = 'pending';

ALTER TABLE public.node_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view node_commands"
  ON public.node_commands FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager'));

CREATE POLICY "Admins issue node_commands"
  ON public.node_commands FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'manager'));
