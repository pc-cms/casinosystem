
-- 1. Notes table for the Employee Playlist (CCTV/Manager/Floor Manager comments)
CREATE TABLE IF NOT EXISTS public.employee_playlist_notes (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  casino_id uuid NOT NULL,
  note text NOT NULL DEFAULT '',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS employee_playlist_notes_casino_idx
  ON public.employee_playlist_notes(casino_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_playlist_notes TO authenticated;
GRANT ALL ON public.employee_playlist_notes TO service_role;

ALTER TABLE public.employee_playlist_notes ENABLE ROW LEVEL SECURITY;

-- Surveillance, Manager, Floor Manager, Super Admin can read notes in their casino
CREATE POLICY "playlist_notes_select"
  ON public.employee_playlist_notes
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      casino_id = get_user_casino_id(auth.uid())
      AND (
        has_role(auth.uid(), 'manager'::app_role)
        OR has_role(auth.uid(), 'floor_manager'::app_role)
        OR has_role(auth.uid(), 'surveillance'::app_role)
      )
    )
    OR (
      has_role(auth.uid(), 'surveillance'::app_role)
      AND user_has_casino_access(auth.uid(), casino_id)
    )
  );

CREATE POLICY "playlist_notes_write"
  ON public.employee_playlist_notes
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      casino_id = get_user_casino_id(auth.uid())
      AND (
        has_role(auth.uid(), 'manager'::app_role)
        OR has_role(auth.uid(), 'floor_manager'::app_role)
        OR has_role(auth.uid(), 'surveillance'::app_role)
      )
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      casino_id = get_user_casino_id(auth.uid())
      AND (
        has_role(auth.uid(), 'manager'::app_role)
        OR has_role(auth.uid(), 'floor_manager'::app_role)
        OR has_role(auth.uid(), 'surveillance'::app_role)
      )
    )
  );

-- 2. Register new module + role defaults
INSERT INTO public.role_module_defaults (role, module_key, can_view) VALUES
  ('super_admin',   'employee_playlist', true),
  ('manager',       'employee_playlist', true),
  ('floor_manager', 'employee_playlist', true),
  ('surveillance',  'employee_playlist', true)
ON CONFLICT (role, module_key) DO UPDATE SET can_view = EXCLUDED.can_view;
