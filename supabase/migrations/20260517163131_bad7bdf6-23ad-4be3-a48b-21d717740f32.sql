ALTER TABLE public.sync_exchange_logs DROP CONSTRAINT IF EXISTS sync_exchange_logs_direction_check;
ALTER TABLE public.sync_exchange_logs ADD CONSTRAINT sync_exchange_logs_direction_check
  CHECK (direction = ANY (ARRAY['pull','push','clone','heartbeat','handshake','probe']));