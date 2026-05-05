CREATE TABLE public.player_chip_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES public.casinos(id),
  player_id uuid NOT NULL REFERENCES public.players(id),
  chip_in bigint NOT NULL DEFAULT 0,
  chip_out bigint NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  operator_id uuid NOT NULL,
  business_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pca_amounts_nonneg CHECK (chip_in >= 0 AND chip_out >= 0),
  CONSTRAINT pca_amounts_any CHECK (chip_in > 0 OR chip_out > 0)
);

CREATE INDEX idx_pca_player_created ON public.player_chip_adjustments (player_id, created_at DESC);
CREATE INDEX idx_pca_casino_created ON public.player_chip_adjustments (casino_id, created_at DESC);

ALTER TABLE public.player_chip_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino users see chip adjustments"
  ON public.player_chip_adjustments FOR SELECT TO authenticated
  USING (casino_id = public.get_user_casino_id(auth.uid()));

CREATE POLICY "Surveillance sees chip adjustments"
  ON public.player_chip_adjustments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'surveillance'::app_role) AND public.user_has_casino_access(auth.uid(), casino_id));

CREATE POLICY "Super/FM see all chip adjustments"
  ON public.player_chip_adjustments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'::app_role) OR public.has_role(auth.uid(),'finance_manager'::app_role));

CREATE POLICY "Pit/managers insert chip adjustments"
  ON public.player_chip_adjustments FOR INSERT TO authenticated
  WITH CHECK (
    casino_id = public.get_user_casino_id(auth.uid())
    AND operator_id = auth.uid()
    AND (public.has_role(auth.uid(),'pit'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  );

CREATE OR REPLACE FUNCTION public.pca_block_modify()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'player_chip_adjustments is immutable';
END;
$$;

CREATE TRIGGER trg_pca_no_update BEFORE UPDATE ON public.player_chip_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.pca_block_modify();
CREATE TRIGGER trg_pca_no_delete BEFORE DELETE ON public.player_chip_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.pca_block_modify();