
-- Add dealer_category enum
CREATE TYPE public.dealer_category AS ENUM ('trainee', 'dealer', 'inspector', 'expert');

-- Add HR fields to dealers
ALTER TABLE public.dealers
  ADD COLUMN salary numeric DEFAULT 0,
  ADD COLUMN contract_start date,
  ADD COLUMN contract_end date,
  ADD COLUMN category public.dealer_category NOT NULL DEFAULT 'dealer',
  ADD COLUMN is_pit_boss boolean NOT NULL DEFAULT false;

-- Add HR fields to staff_members
ALTER TABLE public.staff_members
  ADD COLUMN salary numeric DEFAULT 0,
  ADD COLUMN contract_start date,
  ADD COLUMN contract_end date;

-- Seed 3 pit bosses (using a known casino)
INSERT INTO public.dealers (casino_id, name, category, is_pit_boss)
SELECT c.id, pit.name, 'expert'::public.dealer_category, true
FROM public.casinos c
CROSS JOIN (
  VALUES ('James Morton'), ('Sarah Chen'), ('Viktor Petrov')
) AS pit(name)
LIMIT 3;
