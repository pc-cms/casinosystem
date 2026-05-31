-- Manual Drop Slots field — manager-entered per slots shift (Total tab).
ALTER TABLE public.cage_slots_shifts
  ADD COLUMN IF NOT EXISTS manual_drop_slots numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.cage_slots_shifts.manual_drop_slots IS
  'Manual drop slots value entered by manager in Closings → Total tab. Not auto-computed.';