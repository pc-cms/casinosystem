-- ============================================================
-- 1) CUMULATIVE total_bet PER VISIT
-- ============================================================
-- При reseat новая сессия наследует total_bet закрытой
-- (только если та же business-date визита, чтобы не склеивать
--  визиты разных дней).
-- ============================================================

CREATE OR REPLACE FUNCTION public.client_session_autoclose_prior()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_closed RECORD;
  v_operator uuid := COALESCE(auth.uid(), NEW.created_by);
  v_inherited_total numeric := 0;
BEGIN
  FOR v_closed IN
    UPDATE public.client_sessions
       SET stopped_at = now()
     WHERE player_id  = NEW.player_id
       AND stopped_at IS NULL
       AND id <> NEW.id
    RETURNING id, casino_id, table_id, started_at, stopped_at,
              avg_bet, total_bet, duration_minutes
  LOOP
    -- Наследуем total_bet, если закрытая сессия в том же визите
    -- (один и тот же business day Africa/Dar_es_Salaam, граница 05:00).
    IF (date_trunc('day', (v_closed.started_at AT TIME ZONE 'Africa/Dar_es_Salaam') - INTERVAL '5 hours'))
       = (date_trunc('day', (NEW.started_at      AT TIME ZONE 'Africa/Dar_es_Salaam') - INTERVAL '5 hours'))
    THEN
      v_inherited_total := v_inherited_total + COALESCE(v_closed.total_bet, 0);
    END IF;

    INSERT INTO public.activity_logs (
      casino_id, operator_id, category, action, details
    ) VALUES (
      v_closed.casino_id,
      v_operator,
      'pit'::log_category,
      'session_auto_closed',
      jsonb_build_object(
        'reason',            'reseat_to_other_table',
        'closed_session_id', v_closed.id,
        'closed_table_id',   v_closed.table_id,
        'new_session_id',    NEW.id,
        'new_table_id',      NEW.table_id,
        'player_id',         NEW.player_id,
        'started_at',        v_closed.started_at,
        'stopped_at',        v_closed.stopped_at,
        'avg_bet',           v_closed.avg_bet,
        'total_bet',         v_closed.total_bet,
        'duration_minutes',  v_closed.duration_minutes,
        'inherited_to_new',  v_inherited_total
      )
    );
  END LOOP;

  -- Передаём накопленный total_bet в новую сессию
  IF v_inherited_total > 0 THEN
    NEW.total_bet := COALESCE(NEW.total_bet, 0) + v_inherited_total;
  END IF;

  RETURN NEW;
END;
$function$;

-- Recalc должен УВАЖАТЬ inherited total_bet при INSERT
CREATE OR REPLACE FUNCTION public.client_session_recalc()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
  v_segment_minutes int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.bet_changed_at := COALESCE(NEW.bet_changed_at, NEW.started_at, v_now);
    -- НЕ обнуляем total_bet — может быть унаследован из autoclose_prior
    NEW.total_bet      := COALESCE(NEW.total_bet, 0);
    NEW.duration_minutes := 0;
    RETURN NEW;
  END IF;

  IF NEW.avg_bet IS DISTINCT FROM OLD.avg_bet THEN
    v_segment_minutes := GREATEST(
      0,
      EXTRACT(EPOCH FROM (v_now - COALESCE(OLD.bet_changed_at, OLD.started_at))) / 60
    )::int;
    NEW.total_bet      := COALESCE(OLD.total_bet, 0) + COALESCE(OLD.avg_bet, 0) * v_segment_minutes;
    NEW.bet_changed_at := v_now;
  END IF;

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
$function$;

-- ВАЖНО: порядок триггеров. autoclose_prior должен сработать ПЕРЕД recalc,
-- чтобы recalc увидел NEW.total_bet с унаследованной суммой.
-- Postgres выполняет BEFORE триггеры в алфавитном порядке имён.
-- "trg_client_session_autoclose_prior" < "trg_client_session_recalc" — OK.

-- ============================================================
-- 2) RETENTION 60 DAYS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Архивные таблицы для исторических сессий и визитов
CREATE TABLE IF NOT EXISTS public.client_sessions_archive (LIKE public.client_sessions INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.casino_visits_archive  (LIKE public.casino_visits  INCLUDING ALL);

ALTER TABLE public.client_sessions_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casino_visits_archive  ENABLE ROW LEVEL SECURITY;

-- Доступ только Super admin / Finance manager
DROP POLICY IF EXISTS "Super FM see archived sessions" ON public.client_sessions_archive;
CREATE POLICY "Super FM see archived sessions"
  ON public.client_sessions_archive FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'finance_manager'::app_role));

DROP POLICY IF EXISTS "Super FM see archived visits" ON public.casino_visits_archive;
CREATE POLICY "Super FM see archived visits"
  ON public.casino_visits_archive FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role) OR has_role(auth.uid(),'finance_manager'::app_role));

-- Главная функция очистки
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cutoff timestamptz := now() - INTERVAL '60 days';
  v_logs   bigint := 0;
  v_brk    bigint := 0;
  v_sess   bigint := 0;
  v_vis    bigint := 0;
BEGIN
  -- 1) Operational logs
  DELETE FROM public.activity_logs   WHERE created_at < v_cutoff;
  GET DIAGNOSTICS v_logs = ROW_COUNT;

  DELETE FROM public.breaklist_logs  WHERE created_at < v_cutoff;
  GET DIAGNOSTICS v_brk  = ROW_COUNT;

  -- 2) Архивация client_sessions (только закрытые > 60 дней)
  WITH moved AS (
    DELETE FROM public.client_sessions
     WHERE stopped_at IS NOT NULL AND stopped_at < v_cutoff
    RETURNING *
  )
  INSERT INTO public.client_sessions_archive SELECT * FROM moved;
  GET DIAGNOSTICS v_sess = ROW_COUNT;

  -- 3) Архивация casino_visits (только checked-out > 60 дней)
  WITH moved AS (
    DELETE FROM public.casino_visits
     WHERE checked_out_at IS NOT NULL AND checked_out_at < v_cutoff
    RETURNING *
  )
  INSERT INTO public.casino_visits_archive SELECT * FROM moved;
  GET DIAGNOSTICS v_vis = ROW_COUNT;

  -- Self-log
  INSERT INTO public.activity_logs (casino_id, operator_id, category, action, details)
  SELECT id, id, 'manager'::log_category, 'retention_cleanup',
         jsonb_build_object('cutoff', v_cutoff,
                            'activity_logs_deleted', v_logs,
                            'breaklist_logs_deleted', v_brk,
                            'sessions_archived', v_sess,
                            'visits_archived', v_vis)
    FROM public.casinos LIMIT 1;

  RETURN jsonb_build_object(
    'cutoff', v_cutoff,
    'activity_logs_deleted', v_logs,
    'breaklist_logs_deleted', v_brk,
    'sessions_archived', v_sess,
    'visits_archived', v_vis
  );
END;
$function$;

-- Cron: каждый день в 06:00 Africa/Dar_es_Salaam = 03:00 UTC
SELECT cron.unschedule('cms-retention-cleanup')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='cms-retention-cleanup');

SELECT cron.schedule(
  'cms-retention-cleanup',
  '0 3 * * *',
  $$ SELECT public.cleanup_old_data(); $$
);