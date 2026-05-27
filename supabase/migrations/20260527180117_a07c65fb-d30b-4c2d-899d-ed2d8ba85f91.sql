
-- Fix opening balance for slots shift 0060d1aa-c75e-4601-a50a-623669808b22:
-- set opening cash to 1,000,000 TZS (100 × 10,000) and reflect it in both
-- the opening snapshot and the latest check snapshot.

-- 1) Insert opening cash inventory: 100 × TZS 10,000
INSERT INTO public.cage_slots_cash_inventory
  (cage_slots_shift_id, casino_id, inventory_type, currency_code, denomination, quantity, rate_to_tzs, total_currency, total_tzs)
SELECT '0060d1aa-c75e-4601-a50a-623669808b22', casino_id, 'opening', 'TZS', 10000, 100, 1, 1000000, 1000000
FROM public.cage_slots_shifts WHERE id = '0060d1aa-c75e-4601-a50a-623669808b22'
ON CONFLICT (cage_slots_shift_id, inventory_type, currency_code, denomination)
DO UPDATE SET quantity = EXCLUDED.quantity, total_currency = EXCLUDED.total_currency, total_tzs = EXCLUDED.total_tzs, updated_at = now();

-- 2) Update opening snapshot (is_opening = true): add 100×10000 TZS cash, recompute totals (cash 1,000,000 + bank 10,000 + mobile 1,566,000 = 2,576,000)
UPDATE public.cage_slots_cash_counts
SET denominations = jsonb_set(
      jsonb_set(
        jsonb_set(denominations, '{cash}', '{"TZS":{"10000":100},"USD":{},"EUR":{},"GBP":{},"KES":{}}'::jsonb, true),
        '{totals,total_tzs}', '2576000'::jsonb, true
      ),
      '{totals,is_opening}', 'true'::jsonb, true
    ),
    total_tzs = 2576000
WHERE id = '101fad89-b69f-45f9-be3a-8f4cdefbb0d2';

-- 3) Update latest check snapshot: same cash (100×10000), recompute total + delta_cash = 0
UPDATE public.cage_slots_cash_counts
SET denominations = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(denominations, '{cash}', '{"TZS":{"10000":100},"USD":{},"EUR":{},"GBP":{},"KES":{}}'::jsonb, true),
          '{totals,total_tzs}', '2576000'::jsonb, true
        ),
        '{totals,delta_cash}', '0'::jsonb, true
      ),
      '{totals,cash_desk_result}', '0'::jsonb, true
    ),
    total_tzs = 2576000
WHERE id = 'e778e6f8-f22e-4281-98a8-212d688dc620';
