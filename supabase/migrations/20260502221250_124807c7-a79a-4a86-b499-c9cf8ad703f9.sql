CREATE INDEX IF NOT EXISTS idx_chip_snapshots_casino_date_created_id
ON public.chip_snapshots (casino_id, date, created_at DESC, id ASC);