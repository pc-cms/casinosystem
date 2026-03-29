
-- 1. Create dealer_attendance table
CREATE TABLE public.dealer_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  dealer_id uuid NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  date date NOT NULL,
  hours numeric NOT NULL DEFAULT 0,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(casino_id, dealer_id, date)
);

-- 2. Enable RLS
ALTER TABLE public.dealer_attendance ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies
CREATE POLICY "Casino users see attendance" ON public.dealer_attendance
  FOR SELECT TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()));

CREATE POLICY "Pit managers insert attendance" ON public.dealer_attendance
  FOR INSERT TO authenticated
  WITH CHECK (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'pit') OR has_role(auth.uid(), 'manager')));

CREATE POLICY "Pit managers update attendance" ON public.dealer_attendance
  FOR UPDATE TO authenticated
  USING (casino_id = get_user_casino_id(auth.uid()) AND (has_role(auth.uid(), 'pit') OR has_role(auth.uid(), 'manager')));

-- 4. Add L to shift_type enum (Leave)
ALTER TYPE public.shift_type ADD VALUE IF NOT EXISTS 'L';

-- 5. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.dealer_attendance;
