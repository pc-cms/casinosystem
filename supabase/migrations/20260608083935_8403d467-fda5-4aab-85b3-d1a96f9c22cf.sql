-- Fix lottery_tickets cross-casino read
DROP POLICY IF EXISTS lt_read ON public.lottery_tickets;
CREATE POLICY lt_read ON public.lottery_tickets
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lotteries l
    WHERE l.id = lottery_tickets.lottery_id
      AND (
        l.casino_id = public.get_user_casino_id(auth.uid())
        OR public.has_role(auth.uid(), 'super_admin'::app_role)
        OR public.has_role(auth.uid(), 'account_manager'::app_role)
      )
  )
);

-- Fix peer_links sync_secret exposure (super_admin only)
DROP POLICY IF EXISTS "peer_links readable to authenticated" ON public.peer_links;
CREATE POLICY "peer_links super_admin read" ON public.peer_links
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Fix player_daily_avg_bets cross-casino read
DROP POLICY IF EXISTS pdab_read ON public.player_daily_avg_bets;
CREATE POLICY pdab_read ON public.player_daily_avg_bets
FOR SELECT TO authenticated
USING (
  casino_id = public.get_user_casino_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'account_manager'::app_role)
  OR public.has_role(auth.uid(), 'finance_manager'::app_role)
);

DROP POLICY IF EXISTS pdab_changes_read ON public.player_daily_avg_bet_changes;
CREATE POLICY pdab_changes_read ON public.player_daily_avg_bet_changes
FOR SELECT TO authenticated
USING (
  casino_id = public.get_user_casino_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR public.has_role(auth.uid(), 'account_manager'::app_role)
  OR public.has_role(auth.uid(), 'finance_manager'::app_role)
);