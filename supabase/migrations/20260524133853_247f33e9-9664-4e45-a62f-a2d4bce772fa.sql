
-- 1. Players: scope SELECT to casino access (+ super_admin/finance_manager)
DROP POLICY IF EXISTS "All authenticated users see all players" ON public.players;
CREATE POLICY "Players visible within casino access"
ON public.players FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'finance_manager'::app_role)
  OR user_has_casino_access(auth.uid(), casino_id)
);

-- 2. player_cards: scope to player's casino
DROP POLICY IF EXISTS "All authenticated users see cards" ON public.player_cards;
CREATE POLICY "Player cards visible within casino access"
ON public.player_cards FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'finance_manager'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = player_cards.player_id
      AND user_has_casino_access(auth.uid(), p.casino_id)
  )
);

-- 3. player_tags
DROP POLICY IF EXISTS "All authenticated users see tags" ON public.player_tags;
CREATE POLICY "Player tags visible within casino access"
ON public.player_tags FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'finance_manager'::app_role)
  OR has_role(auth.uid(), 'surveillance'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = player_tags.player_id
      AND user_has_casino_access(auth.uid(), p.casino_id)
  )
);

-- 4. player_notes
DROP POLICY IF EXISTS "All authenticated users see player notes" ON public.player_notes;
CREATE POLICY "Player notes visible within casino access"
ON public.player_notes FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'finance_manager'::app_role)
  OR has_role(auth.uid(), 'surveillance'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = player_notes.player_id
      AND user_has_casino_access(auth.uid(), p.casino_id)
  )
);

-- 5. Remove sensitive infra table from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.pending_server_registrations;

-- 6. Infra tables: restrict SELECT to super_admin
DROP POLICY IF EXISTS "cutover read auth" ON public.mirror_cutover_state;
CREATE POLICY "cutover read super_admin"
ON public.mirror_cutover_state FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "apply_errors read auth" ON public.sync_apply_errors;
CREATE POLICY "apply_errors read super_admin"
ON public.sync_apply_errors FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "probe_events read auth" ON public.sync_probe_events;
CREATE POLICY "probe_events read super_admin"
ON public.sync_probe_events FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "snapshot_state read auth" ON public.sync_snapshot_state;
CREATE POLICY "snapshot_state read super_admin"
ON public.sync_snapshot_state FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()));

-- 7. onprem_channels: scope to casino for non-super_admin roles
DROP POLICY IF EXISTS "fm_manager_view_onprem_channels" ON public.onprem_channels;
CREATE POLICY "fm_manager_view_onprem_channels_scoped"
ON public.onprem_channels FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    (
      has_role(auth.uid(), 'finance_manager'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'surveillance'::app_role)
    )
    AND user_has_casino_access(auth.uid(), casino_id)
  )
);

-- 8. Storage: drop overly broad policies on player-documents and employee-photos
DROP POLICY IF EXISTS "Casino users upload player docs" ON storage.objects;
DROP POLICY IF EXISTS "Casino users view player docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users select player documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload player documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users update player documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users delete player documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update employee photos" ON storage.objects;

-- Add a casino-scoped DELETE for player documents (was missing)
CREATE POLICY "Authorized roles delete player documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'player-documents'
  AND (storage.foldername(name))[1] = (
    SELECT casino_id::text FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
  )
  AND (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);
