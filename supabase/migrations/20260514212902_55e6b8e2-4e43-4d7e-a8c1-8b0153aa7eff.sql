-- 1. Add source column with default 'floor' and CHECK constraint
ALTER TABLE public.player_tags ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'floor';
ALTER TABLE public.player_tags DROP CONSTRAINT IF EXISTS player_tags_source_chk;
ALTER TABLE public.player_tags ADD CONSTRAINT player_tags_source_chk CHECK (source IN ('floor','cctv'));

-- 2. Replace UNIQUE(player_id, tag) with UNIQUE(player_id, tag, source)
ALTER TABLE public.player_tags DROP CONSTRAINT IF EXISTS player_tags_player_id_tag_key;
ALTER TABLE public.player_tags DROP CONSTRAINT IF EXISTS player_tags_player_id_tag_source_key;
ALTER TABLE public.player_tags ADD CONSTRAINT player_tags_player_id_tag_source_key UNIQUE (player_id, tag, source);

-- 3. Update max-tags trigger to count per (player_id, source)
CREATE OR REPLACE FUNCTION public.check_max_tags()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.player_tags WHERE player_id = NEW.player_id AND source = NEW.source) >= 5 THEN
    RAISE EXCEPTION 'Maximum 5 tags per player per source';
  END IF;
  RETURN NEW;
END;
$$;

-- 4. RLS rewrite for INSERT/DELETE
DROP POLICY IF EXISTS "Authorized users manage tags" ON public.player_tags;
DROP POLICY IF EXISTS "Managers delete tags" ON public.player_tags;
DROP POLICY IF EXISTS "Surveillance inserts player tags" ON public.player_tags;
DROP POLICY IF EXISTS "Surveillance deletes player tags" ON public.player_tags;
DROP POLICY IF EXISTS "Users manage tags" ON public.player_tags;

-- Floor layer: super_admin, manager, floor_manager, finance_manager
CREATE POLICY "Floor tags insert" ON public.player_tags
  FOR INSERT TO authenticated
  WITH CHECK (
    source = 'floor'
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'floor_manager')
      OR public.has_role(auth.uid(), 'finance_manager')
    )
  );

CREATE POLICY "Floor tags delete" ON public.player_tags
  FOR DELETE TO authenticated
  USING (
    source = 'floor'
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'floor_manager')
      OR public.has_role(auth.uid(), 'finance_manager')
    )
  );

-- CCTV layer: surveillance + super_admin
CREATE POLICY "CCTV tags insert" ON public.player_tags
  FOR INSERT TO authenticated
  WITH CHECK (
    source = 'cctv'
    AND (
      public.has_role(auth.uid(), 'surveillance')
      OR public.has_role(auth.uid(), 'super_admin')
    )
  );

CREATE POLICY "CCTV tags delete" ON public.player_tags
  FOR DELETE TO authenticated
  USING (
    source = 'cctv'
    AND (
      public.has_role(auth.uid(), 'surveillance')
      OR public.has_role(auth.uid(), 'super_admin')
    )
  );

-- 5. RPC for category change with broader role set
CREATE OR REPLACE FUNCTION public.set_player_category(_player_id UUID, _category TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _category NOT IN ('normal','gold','platinum','diamond') THEN
    RAISE EXCEPTION 'Invalid category: %', _category;
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'floor_manager')
    OR public.has_role(auth.uid(), 'finance_manager')
  ) THEN
    RAISE EXCEPTION 'Not authorized to change player category';
  END IF;
  UPDATE public.players SET category = _category WHERE id = _player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_player_category(UUID, TEXT) TO authenticated;