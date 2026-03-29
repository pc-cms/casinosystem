
-- Add float_locked flag to casinos
ALTER TABLE public.casinos ADD COLUMN float_locked boolean NOT NULL DEFAULT false;

-- Allow managers to update their casino (for float_locked)
CREATE POLICY "Managers update casinos" ON public.casinos
FOR UPDATE TO authenticated
USING (id = get_user_casino_id(auth.uid()) AND has_role(auth.uid(), 'manager'::app_role));
