ALTER TABLE public.cage_slots_shifts
  ADD COLUMN IF NOT EXISTS cashless_in_providers  jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cashless_out_providers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cashless_final_providers jsonb NOT NULL DEFAULT '{}'::jsonb;