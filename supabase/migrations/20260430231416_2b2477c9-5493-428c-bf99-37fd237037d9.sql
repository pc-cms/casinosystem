-- ════════════════════════════════════════════════════════════════
-- 5 CRITICAL FIXES from architecture review
-- ════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────
-- CRIT #1: Fill missing FOREIGN KEYS
-- ──────────────────────────────────────────────
-- All targets are referenced from auth.users, casinos, shifts, players,
-- gaming_tables, dealers, breaklist, budget_*. Data was verified clean.

ALTER TABLE public.bank_checks            ADD CONSTRAINT bank_checks_created_by_fkey            FOREIGN KEY (created_by)            REFERENCES auth.users(id);
ALTER TABLE public.breaklist_logs         ADD CONSTRAINT breaklist_logs_new_table_id_fkey      FOREIGN KEY (new_table_id)         REFERENCES public.gaming_tables(id);
ALTER TABLE public.breaklist_logs         ADD CONSTRAINT breaklist_logs_old_table_id_fkey      FOREIGN KEY (old_table_id)         REFERENCES public.gaming_tables(id);
ALTER TABLE public.budget_categories      ADD CONSTRAINT budget_categories_created_by_fkey    FOREIGN KEY (created_by)           REFERENCES auth.users(id);
ALTER TABLE public.budget_logs            ADD CONSTRAINT budget_logs_operator_id_fkey         FOREIGN KEY (operator_id)          REFERENCES auth.users(id);
ALTER TABLE public.budget_periods         ADD CONSTRAINT budget_periods_locked_by_fkey        FOREIGN KEY (locked_by)            REFERENCES auth.users(id);
ALTER TABLE public.budget_periods         ADD CONSTRAINT budget_periods_unlocked_by_fkey      FOREIGN KEY (unlocked_by)          REFERENCES auth.users(id);
ALTER TABLE public.cage_transfers         ADD CONSTRAINT cage_transfers_casino_id_fkey        FOREIGN KEY (casino_id)            REFERENCES public.casinos(id);
ALTER TABLE public.cage_transfers         ADD CONSTRAINT cage_transfers_shift_id_fkey         FOREIGN KEY (shift_id)             REFERENCES public.shifts(id);
ALTER TABLE public.cage_transfers         ADD CONSTRAINT cage_transfers_table_id_fkey         FOREIGN KEY (table_id)             REFERENCES public.gaming_tables(id);
ALTER TABLE public.cage_transfers         ADD CONSTRAINT cage_transfers_operator_id_fkey     FOREIGN KEY (operator_id)          REFERENCES auth.users(id);
ALTER TABLE public.cage_transfers         ADD CONSTRAINT cage_transfers_approved_by_fkey     FOREIGN KEY (approved_by)          REFERENCES auth.users(id);
ALTER TABLE public.cash_count_snapshots   ADD CONSTRAINT cash_count_snapshots_counted_by_fkey FOREIGN KEY (counted_by)           REFERENCES auth.users(id);
ALTER TABLE public.cash_counts            ADD CONSTRAINT cash_counts_counted_by_fkey         FOREIGN KEY (counted_by)           REFERENCES auth.users(id);
ALTER TABLE public.casino_visits          ADD CONSTRAINT casino_visits_checked_in_by_fkey    FOREIGN KEY (checked_in_by)        REFERENCES auth.users(id);
ALTER TABLE public.cctv_observations      ADD CONSTRAINT cctv_observations_observer_id_fkey  FOREIGN KEY (observer_id)          REFERENCES auth.users(id);
ALTER TABLE public.chip_color_settings    ADD CONSTRAINT chip_color_settings_casino_id_fkey  FOREIGN KEY (casino_id)            REFERENCES public.casinos(id);
ALTER TABLE public.chip_color_settings    ADD CONSTRAINT chip_color_settings_updated_by_fkey FOREIGN KEY (updated_by)           REFERENCES auth.users(id);
ALTER TABLE public.chip_emissions         ADD CONSTRAINT chip_emissions_operator_id_fkey    FOREIGN KEY (operator_id)          REFERENCES auth.users(id);
ALTER TABLE public.chip_initial_baseline  ADD CONSTRAINT chip_initial_baseline_created_by_fkey FOREIGN KEY (created_by)         REFERENCES auth.users(id);
ALTER TABLE public.chip_inventory         ADD CONSTRAINT chip_inventory_updated_by_fkey      FOREIGN KEY (updated_by)           REFERENCES auth.users(id);
ALTER TABLE public.chip_snapshots         ADD CONSTRAINT chip_snapshots_recorded_by_fkey    FOREIGN KEY (recorded_by)          REFERENCES auth.users(id);
ALTER TABLE public.client_sessions        ADD CONSTRAINT client_sessions_created_by_fkey    FOREIGN KEY (created_by)           REFERENCES auth.users(id);
ALTER TABLE public.dealer_attendance      ADD CONSTRAINT dealer_attendance_recorded_by_fkey FOREIGN KEY (recorded_by)          REFERENCES auth.users(id);
ALTER TABLE public.player_notes           ADD CONSTRAINT player_notes_created_by_fkey       FOREIGN KEY (created_by)           REFERENCES auth.users(id);
ALTER TABLE public.wallet_transactions    ADD CONSTRAINT wallet_transactions_operator_id_fkey FOREIGN KEY (operator_id)        REFERENCES auth.users(id);

-- ──────────────────────────────────────────────
-- CRIT #2: Move client_sessions math from UI → DB trigger
-- ──────────────────────────────────────────────
-- Computes duration_minutes when session is closed.
-- Computes total_bet segment-by-segment when avg_bet changes:
--   delta = old_avg_bet * minutes_since_last_change
-- This makes the calculation source-of-truth even if UI is bypassed.

CREATE OR REPLACE FUNCTION public.client_session_recalc()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_segment_minutes int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.bet_changed_at := COALESCE(NEW.bet_changed_at, NEW.started_at, v_now);
    NEW.total_bet      := COALESCE(NEW.total_bet, 0);
    NEW.duration_minutes := 0;
    RETURN NEW;
  END IF;

  -- UPDATE
  -- 1) avg_bet change → close previous segment, accumulate total_bet
  IF NEW.avg_bet IS DISTINCT FROM OLD.avg_bet THEN
    v_segment_minutes := GREATEST(
      0,
      EXTRACT(EPOCH FROM (v_now - COALESCE(OLD.bet_changed_at, OLD.started_at))) / 60
    )::int;
    NEW.total_bet      := COALESCE(OLD.total_bet, 0) + COALESCE(OLD.avg_bet, 0) * v_segment_minutes;
    NEW.bet_changed_at := v_now;
  END IF;

  -- 2) session closing → finalize total_bet + duration
  IF NEW.stopped_at IS NOT NULL AND OLD.stopped_at IS NULL THEN
    v_segment_minutes := GREATEST(
      0,
      EXTRACT(EPOCH FROM (NEW.stopped_at - COALESCE(NEW.bet_changed_at, OLD.bet_changed_at, NEW.started_at))) / 60
    )::int;
    NEW.total_bet := COALESCE(NEW.total_bet, OLD.total_bet, 0)
                   + COALESCE(NEW.avg_bet, OLD.avg_bet, 0) * v_segment_minutes;
    NEW.duration_minutes := GREATEST(
      0,
      EXTRACT(EPOCH FROM (NEW.stopped_at - NEW.started_at)) / 60
    )::int;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_session_recalc ON public.client_sessions;
CREATE TRIGGER trg_client_session_recalc
  BEFORE INSERT OR UPDATE ON public.client_sessions
  FOR EACH ROW EXECUTE FUNCTION public.client_session_recalc();

-- ──────────────────────────────────────────────
-- CRIT #3: Visit concurrency at DB level (network-wide one open visit per player)
-- ──────────────────────────────────────────────
-- First, auto-close stale duplicate open visits (keep latest).
WITH ranked AS (
  SELECT id, player_id,
         row_number() OVER (PARTITION BY player_id ORDER BY checked_in_at DESC) AS rn
  FROM public.casino_visits
  WHERE checked_out_at IS NULL
)
UPDATE public.casino_visits v
SET checked_out_at = now()
FROM ranked r
WHERE v.id = r.id AND r.rn > 1;

-- Partial unique index → blocks future concurrent open visits.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_casino_visits_open_per_player
  ON public.casino_visits (player_id)
  WHERE checked_out_at IS NULL;

-- Same idea for client_sessions: one open session per (player, table)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_client_sessions_open_per_player_table
  ON public.client_sessions (player_id, table_id)
  WHERE stopped_at IS NULL;

-- ──────────────────────────────────────────────
-- CRIT #5a: Drop duplicate triggers on breaklist
-- ──────────────────────────────────────────────
-- Three triggers ran the "one dealer per slot" check (check_one_dealer_per_slot,
-- check_one_dealer_per_slot_trigger, enforce_one_dealer_per_slot) — keep only one.
DROP TRIGGER IF EXISTS check_one_dealer_per_slot         ON public.breaklist;
DROP TRIGGER IF EXISTS check_one_dealer_per_slot_trigger ON public.breaklist;
-- enforce_one_dealer_per_slot is the canonical name — kept.

-- ──────────────────────────────────────────────
-- CRIT #5b: activity_logs growth control (BRIN index for time-range scans)
-- ──────────────────────────────────────────────
-- Full partitioning requires data migration window; for now add BRIN
-- (cheap, perfect for append-only logs) + retention helper.
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at_brin
  ON public.activity_logs USING BRIN (created_at);

-- Retention: callable from cron later (not scheduled here).
CREATE OR REPLACE FUNCTION public.activity_logs_purge(p_days int DEFAULT 60)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_deleted bigint;
BEGIN
  DELETE FROM public.activity_logs
   WHERE created_at < now() - make_interval(days => p_days);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.activity_logs_purge(int) FROM PUBLIC;