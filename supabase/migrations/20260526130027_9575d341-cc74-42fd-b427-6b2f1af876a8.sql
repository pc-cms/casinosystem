
-- Manually close yesterday's two open slots shifts for casino 48f4404f.
-- The day shift was superseded by the night shift; the night shift is closed
-- with a 41-card snapshot already inserted.
UPDATE cage_slots_shifts
SET status = 'closed',
    submitted_at = COALESCE(submitted_at, now()),
    reviewed_at = now(),
    reviewed_by = 'b2692fab-a5be-42cf-9e2f-1204bf85dcb0',
    closed_at = now(),
    closed_by = 'b2692fab-a5be-42cf-9e2f-1204bf85dcb0',
    manager_comment = 'Manual close — yesterday business day (Pit). Night shift closed with 41 cards on hand.'
WHERE id IN (
  '16682d43-bb36-4b07-94af-d0ae04172edb',
  '0208b21b-0394-41e0-9e5b-14c855643355'
)
AND status = 'open';
