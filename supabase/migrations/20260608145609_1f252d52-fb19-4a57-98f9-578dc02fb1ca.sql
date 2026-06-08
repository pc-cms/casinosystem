
-- 1. casino_servers
DROP POLICY IF EXISTS "casino_servers read auth" ON public.casino_servers;
CREATE POLICY "casino_servers read super_admin"
  ON public.casino_servers FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()));

-- 2. cloud_connection: add explicit deny for insert/delete to non-super_admin (super_admin already has UPDATE/SELECT; service_role bypasses)
CREATE POLICY "cloud_connection insert super_admin"
  ON public.cloud_connection FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "cloud_connection delete super_admin"
  ON public.cloud_connection FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 3. club_accounts: revoke column-level SELECT on credential columns from app roles
REVOKE SELECT (password_hash, totp_secret_enc) ON public.club_accounts FROM authenticated;
REVOKE SELECT (password_hash, totp_secret_enc) ON public.club_accounts FROM anon;
-- service_role retains via GRANT ALL

-- 4. fin_audit_log: restrict INSERT to super_admin / finance_manager
DROP POLICY IF EXISTS fal_ins ON public.fin_audit_log;
CREATE POLICY fal_ins ON public.fin_audit_log FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role)
           OR has_role(auth.uid(), 'finance_manager'::app_role));

-- 5. fin_category_aliases: restrict read to finance/admin roles
DROP POLICY IF EXISTS fin_aliases_read_auth ON public.fin_category_aliases;
CREATE POLICY fin_aliases_read_roles ON public.fin_category_aliases FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'finance_manager'::app_role)
      OR has_role(auth.uid(), 'account_manager'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role));

-- 6. incidents UPDATE: add casino scoping for manager/surveillance/floor_manager
DROP POLICY IF EXISTS incidents_update_followup ON public.incidents;
CREATE POLICY incidents_update_followup ON public.incidents FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'finance_manager'::app_role)
    OR ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'floor_manager'::app_role))
        AND casino_id = get_user_casino_id(auth.uid()))
    OR (has_role(auth.uid(), 'surveillance'::app_role)
        AND user_has_casino_access(auth.uid(), casino_id))
  )
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'finance_manager'::app_role)
    OR ((has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'floor_manager'::app_role))
        AND casino_id = get_user_casino_id(auth.uid()))
    OR (has_role(auth.uid(), 'surveillance'::app_role)
        AND user_has_casino_access(auth.uid(), casino_id))
  );

-- 7. lotteries: scope SELECT to casino access (anon "open" policy retained)
DROP POLICY IF EXISTS lotteries_read ON public.lotteries;
CREATE POLICY lotteries_read_scoped ON public.lotteries FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'account_manager'::app_role)
    OR casino_id = get_user_casino_id(auth.uid())
    OR user_has_casino_access(auth.uid(), casino_id)
  );

-- 8. node_identity
DROP POLICY IF EXISTS "node_identity readable to authenticated" ON public.node_identity;
CREATE POLICY "node_identity read super_admin" ON public.node_identity FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 9. player_crm write scoping
DROP POLICY IF EXISTS "crm write by manager/host" ON public.player_crm;
CREATE POLICY "crm write by manager/host" ON public.player_crm FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'account_manager'::app_role)
    OR (
      (has_role(auth.uid(), 'manager'::app_role)
       OR has_role(auth.uid(), 'floor_manager'::app_role)
       OR has_role(auth.uid(), 'finance_manager'::app_role)
       OR has_role(auth.uid(), 'reception'::app_role)
       OR has_role(auth.uid(), 'hr'::app_role))
      AND casino_id = get_user_casino_id(auth.uid())
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'account_manager'::app_role)
    OR (
      (has_role(auth.uid(), 'manager'::app_role)
       OR has_role(auth.uid(), 'floor_manager'::app_role)
       OR has_role(auth.uid(), 'finance_manager'::app_role)
       OR has_role(auth.uid(), 'reception'::app_role)
       OR has_role(auth.uid(), 'hr'::app_role))
      AND casino_id = get_user_casino_id(auth.uid())
    )
  );

-- 10. premier_promo_campaigns: restrict reads
DROP POLICY IF EXISTS "Authenticated read campaigns" ON public.premier_promo_campaigns;
CREATE POLICY "Read campaigns scoped" ON public.premier_promo_campaigns FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'account_manager'::app_role)
    OR has_role(auth.uid(), 'finance_manager'::app_role)
  );

-- 11. promo_code_redemptions: scope via player's casino
DROP POLICY IF EXISTS "AM/admin/cashier read code redemptions" ON public.promo_code_redemptions;
CREATE POLICY "Read code redemptions scoped" ON public.promo_code_redemptions FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'account_manager'::app_role)
    OR (
      (has_role(auth.uid(), 'cashier'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
      AND EXISTS (
        SELECT 1 FROM public.players p
        WHERE p.id = promo_code_redemptions.player_id
          AND p.casino_id = get_user_casino_id(auth.uid())
      )
    )
  );

-- 12. promo_grants: scope SELECT via casino_id
DROP POLICY IF EXISTS "Read promo_grants" ON public.promo_grants;
CREATE POLICY "Read promo_grants scoped" ON public.promo_grants FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'account_manager'::app_role)
    OR (
      (has_role(auth.uid(), 'cashier'::app_role)
       OR has_role(auth.uid(), 'reception'::app_role)
       OR has_role(auth.uid(), 'manager'::app_role)
       OR has_role(auth.uid(), 'finance_manager'::app_role))
      AND casino_id = get_user_casino_id(auth.uid())
    )
  );

-- 13. promo_wallet_ledger: scope via player's casino
DROP POLICY IF EXISTS "Read wallet ledger" ON public.promo_wallet_ledger;
CREATE POLICY "Read wallet ledger scoped" ON public.promo_wallet_ledger FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'account_manager'::app_role)
    OR (
      (has_role(auth.uid(), 'cashier'::app_role)
       OR has_role(auth.uid(), 'reception'::app_role)
       OR has_role(auth.uid(), 'manager'::app_role)
       OR has_role(auth.uid(), 'finance_manager'::app_role))
      AND EXISTS (
        SELECT 1 FROM public.players p
        WHERE p.id = promo_wallet_ledger.player_id
          AND p.casino_id = get_user_casino_id(auth.uid())
      )
    )
  );

-- 14. shop_items: scope authenticated read to casino (anon active retained)
DROP POLICY IF EXISTS shop_items_read ON public.shop_items;
CREATE POLICY shop_items_read_scoped ON public.shop_items FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'account_manager'::app_role)
    OR casino_id = get_user_casino_id(auth.uid())
    OR user_has_casino_access(auth.uid(), casino_id)
  );

-- 15. sync_outbox: explicit deny for authenticated
CREATE POLICY sync_outbox_no_auth_select ON public.sync_outbox FOR SELECT TO authenticated USING (false);
CREATE POLICY sync_outbox_no_auth_write ON public.sync_outbox FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 16. sync_peer_health
DROP POLICY IF EXISTS "peer_health read auth" ON public.sync_peer_health;
CREATE POLICY "peer_health read super_admin" ON public.sync_peer_health FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'finance_manager'::app_role));

-- 17. sync_table_registry
DROP POLICY IF EXISTS "registry read auth" ON public.sync_table_registry;
CREATE POLICY "registry read super_admin" ON public.sync_table_registry FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 18. transaction_cancellations: add casino scoping
DROP POLICY IF EXISTS tx_cancel_select_authorized ON public.transaction_cancellations;
CREATE POLICY tx_cancel_select_authorized ON public.transaction_cancellations FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'finance_manager'::app_role)
    OR (
      (has_role(auth.uid(), 'manager'::app_role)
       OR has_role(auth.uid(), 'floor_manager'::app_role)
       OR has_role(auth.uid(), 'surveillance'::app_role)
       OR has_role(auth.uid(), 'cashier'::app_role))
      AND casino_id = get_user_casino_id(auth.uid())
    )
  );

-- 19. Storage: incident-photos add casino-folder scoping
DROP POLICY IF EXISTS "Incident photos authed staff read" ON storage.objects;
CREATE POLICY "Incident photos staff read scoped" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'incident-photos'
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR has_role(auth.uid(), 'finance_manager'::app_role)
      OR (
        (has_role(auth.uid(), 'manager'::app_role)
         OR has_role(auth.uid(), 'surveillance'::app_role)
         OR has_role(auth.uid(), 'hr'::app_role))
        AND (storage.foldername(name))[1] = (
          SELECT profiles.casino_id::text FROM profiles
          WHERE profiles.user_id = auth.uid() LIMIT 1
        )
      )
    )
  );

DROP POLICY IF EXISTS "Incident photos staff upload" ON storage.objects;
CREATE POLICY "Incident photos staff upload scoped" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'incident-photos'
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR (
        (has_role(auth.uid(), 'manager'::app_role)
         OR has_role(auth.uid(), 'surveillance'::app_role))
        AND (storage.foldername(name))[1] = (
          SELECT profiles.casino_id::text FROM profiles
          WHERE profiles.user_id = auth.uid() LIMIT 1
        )
      )
    )
  );

-- 20. Storage: player-photos upload scoping (read remains; upload restricted)
DROP POLICY IF EXISTS "Authenticated users upload player photos" ON storage.objects;
CREATE POLICY "Authorized roles upload player photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'player-photos'
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR (
        (has_role(auth.uid(), 'reception'::app_role)
         OR has_role(auth.uid(), 'manager'::app_role)
         OR has_role(auth.uid(), 'cashier'::app_role))
        AND (storage.foldername(name))[1] = (
          SELECT profiles.casino_id::text FROM profiles
          WHERE profiles.user_id = auth.uid() LIMIT 1
        )
      )
    )
  );

-- 21. Storage: player-documents read tighten with role restriction
DROP POLICY IF EXISTS "Authenticated users read player documents" ON storage.objects;
CREATE POLICY "Authorized roles read player documents" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'player-documents'
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR (
        (has_role(auth.uid(), 'reception'::app_role)
         OR has_role(auth.uid(), 'manager'::app_role)
         OR has_role(auth.uid(), 'surveillance'::app_role))
        AND (storage.foldername(name))[1] = (
          SELECT profiles.casino_id::text FROM profiles
          WHERE profiles.user_id = auth.uid() LIMIT 1
        )
      )
    )
  );
