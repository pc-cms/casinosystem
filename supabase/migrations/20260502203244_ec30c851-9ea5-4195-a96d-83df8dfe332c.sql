DROP VIEW IF EXISTS public.player_economy;

CREATE VIEW public.player_economy
WITH (security_invoker = true)
AS
SELECT 
  p.id AS player_id,
  p.casino_id,
  p.first_name,
  p.last_name,
  p.nickname,
  p.status,
  COALESCE(buy.total, 0)  AS total_drop,
  COALESCE(cash.total, 0) AS total_cashout,
  COALESCE(exp.total, 0)  AS total_expenses,
  -- Чистая игра, перспектива игрока
  COALESCE(cash.total, 0) - COALESCE(buy.total, 0)                          AS result,
  -- Итог с учётом expenses/comps
  COALESCE(cash.total, 0) - COALESCE(buy.total, 0) - COALESCE(exp.total, 0) AS total,
  -- LEGACY (то же самое, что total)
  COALESCE(cash.total, 0) - COALESCE(buy.total, 0) - COALESCE(exp.total, 0) AS real_result
FROM public.players p
LEFT JOIN LATERAL (
  SELECT SUM(amount) AS total FROM public.transactions WHERE player_id = p.id AND type = 'buy'
) buy ON true
LEFT JOIN LATERAL (
  SELECT SUM(amount) AS total FROM public.transactions WHERE player_id = p.id AND type = 'cashout'
) cash ON true
LEFT JOIN LATERAL (
  SELECT SUM(amount) AS total FROM public.expenses WHERE player_id = p.id AND approved = true
) exp ON true;