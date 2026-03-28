
-- Create chip_inventory table to track chip distribution across locations
CREATE TABLE public.chip_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  location_type text NOT NULL CHECK (location_type IN ('table', 'cashier', 'safe')),
  location_id uuid REFERENCES public.gaming_tables(id),
  denomination integer NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Create daily chip snapshots for MISS tracking
CREATE TABLE public.chip_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  date date NOT NULL,
  location_type text NOT NULL CHECK (location_type IN ('table', 'cashier', 'safe')),
  location_id uuid REFERENCES public.gaming_tables(id),
  denomination integer NOT NULL,
  expected_quantity integer NOT NULL DEFAULT 0,
  actual_quantity integer NOT NULL DEFAULT 0,
  miss integer GENERATED ALWAYS AS (actual_quantity - expected_quantity) STORED,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for chip_inventory
ALTER TABLE public.chip_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino users see chip inventory" ON public.chip_inventory
  FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()));

CREATE POLICY "Cashiers update chip inventory" ON public.chip_inventory
  FOR UPDATE TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'cashier') OR has_role(auth.uid(), 'manager')));

CREATE POLICY "Managers insert chip inventory" ON public.chip_inventory
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = get_user_casino_id(auth.uid()) AND has_role(auth.uid(), 'manager'));

-- RLS for chip_snapshots
ALTER TABLE public.chip_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino users see snapshots" ON public.chip_snapshots
  FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()));

CREATE POLICY "Users create snapshots" ON public.chip_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = get_user_casino_id(auth.uid()) AND recorded_by = auth.uid());

-- Unique constraint for chip_inventory per location/denomination
CREATE UNIQUE INDEX chip_inventory_unique ON public.chip_inventory (casino_id, location_type, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'), denomination);
