
GRANT SELECT ON public.shop_items TO anon;
GRANT SELECT ON public.lotteries TO anon;

DROP POLICY IF EXISTS "shop_items_anon_read" ON public.shop_items;
CREATE POLICY "shop_items_anon_read" ON public.shop_items
  FOR SELECT TO anon USING (is_active = true);

DROP POLICY IF EXISTS "lotteries_anon_read" ON public.lotteries;
CREATE POLICY "lotteries_anon_read" ON public.lotteries
  FOR SELECT TO anon USING (status = 'open');
