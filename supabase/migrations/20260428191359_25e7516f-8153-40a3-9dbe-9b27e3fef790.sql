
DROP VIEW IF EXISTS public.chip_conservation_status;

CREATE VIEW public.chip_conservation_status
WITH (security_invoker = true) AS
SELECT
  cib.casino_id,
  cib.denomination,
  cib.initial_quantity,
  COALESCE((SELECT SUM(quantity) FROM public.chip_inventory ci
            WHERE ci.casino_id = cib.casino_id AND ci.denomination = cib.denomination), 0) AS in_locations,
  COALESCE((SELECT SUM(quantity) FROM public.miss_chips mc
            WHERE mc.casino_id = cib.casino_id AND mc.denomination = cib.denomination), 0) AS archived_miss,
  cib.initial_quantity
    - COALESCE((SELECT SUM(quantity) FROM public.chip_inventory ci
                WHERE ci.casino_id = cib.casino_id AND ci.denomination = cib.denomination), 0)
    - COALESCE((SELECT SUM(quantity) FROM public.miss_chips mc
                WHERE mc.casino_id = cib.casino_id AND mc.denomination = cib.denomination), 0) AS live_floor
FROM public.chip_initial_baseline cib;
