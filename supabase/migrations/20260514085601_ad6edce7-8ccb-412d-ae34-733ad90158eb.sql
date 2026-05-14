
-- Drop sanity view first (depends on employees.dealer_id).
DROP VIEW IF EXISTS public.v_staff_master_legacy_map;

-- 1. New uniqueness on (casino_id, employee_id, …)
ALTER TABLE public.breaklist            ADD CONSTRAINT breaklist_casino_date_employee_slot_key  UNIQUE (casino_id, date, employee_id, time_slot);
ALTER TABLE public.pit_rota             ADD CONSTRAINT pit_rota_casino_employee_date_key        UNIQUE (casino_id, employee_id, date);
ALTER TABLE public.dealer_attendance    ADD CONSTRAINT dealer_attendance_casino_employee_date_key UNIQUE (casino_id, employee_id, date);
ALTER TABLE public.staff_rota           ADD CONSTRAINT staff_rota_casino_employee_date_key       UNIQUE (casino_id, employee_id, date);
ALTER TABLE public.staff_attendance     ADD CONSTRAINT staff_attendance_casino_employee_date_key UNIQUE (casino_id, employee_id, date);
ALTER TABLE public.weekly_bonus_entries ADD CONSTRAINT weekly_bonus_entries_casino_employee_week_key UNIQUE (casino_id, employee_id, week_start);

-- 2. Drop dual-write triggers + functions.
DROP TRIGGER IF EXISTS trg_breaklist_sync_employee_id          ON public.breaklist;
DROP TRIGGER IF EXISTS trg_pit_rota_sync_employee_id           ON public.pit_rota;
DROP TRIGGER IF EXISTS trg_dealer_attendance_sync_employee_id  ON public.dealer_attendance;
DROP TRIGGER IF EXISTS trg_staff_rota_sync_employee_id         ON public.staff_rota;
DROP TRIGGER IF EXISTS trg_staff_attendance_sync_employee_id   ON public.staff_attendance;
DROP TRIGGER IF EXISTS trg_weekly_bonus_sync_employee_id       ON public.weekly_bonus_entries;

DROP FUNCTION IF EXISTS public.breaklist_sync_employee_id();
DROP FUNCTION IF EXISTS public.pit_rota_sync_employee_id();
DROP FUNCTION IF EXISTS public.dealer_attendance_sync_employee_id();
DROP FUNCTION IF EXISTS public.staff_rota_sync_employee_id();
DROP FUNCTION IF EXISTS public.staff_attendance_sync_employee_id();
DROP FUNCTION IF EXISTS public.weekly_bonus_sync_employee_id();

-- 3. NOT NULL on employee_id.
ALTER TABLE public.breaklist            ALTER COLUMN employee_id SET NOT NULL;
ALTER TABLE public.pit_rota             ALTER COLUMN employee_id SET NOT NULL;
ALTER TABLE public.dealer_attendance    ALTER COLUMN employee_id SET NOT NULL;
ALTER TABLE public.staff_rota           ALTER COLUMN employee_id SET NOT NULL;
ALTER TABLE public.staff_attendance     ALTER COLUMN employee_id SET NOT NULL;
ALTER TABLE public.weekly_bonus_entries ALTER COLUMN employee_id SET NOT NULL;

-- 4. Drop legacy uniques + FKs.
ALTER TABLE public.breaklist            DROP CONSTRAINT IF EXISTS breaklist_casino_id_date_dealer_id_time_slot_key;
ALTER TABLE public.breaklist            DROP CONSTRAINT IF EXISTS breaklist_dealer_id_fkey;
ALTER TABLE public.pit_rota             DROP CONSTRAINT IF EXISTS pit_rota_dealer_id_date_key;
ALTER TABLE public.pit_rota             DROP CONSTRAINT IF EXISTS pit_rota_dealer_id_fkey;
ALTER TABLE public.dealer_attendance    DROP CONSTRAINT IF EXISTS dealer_attendance_casino_id_dealer_id_date_key;
ALTER TABLE public.dealer_attendance    DROP CONSTRAINT IF EXISTS dealer_attendance_dealer_id_fkey;
ALTER TABLE public.staff_rota           DROP CONSTRAINT IF EXISTS staff_rota_casino_id_staff_id_date_key;
ALTER TABLE public.staff_rota           DROP CONSTRAINT IF EXISTS staff_rota_staff_id_fkey;
ALTER TABLE public.staff_attendance     DROP CONSTRAINT IF EXISTS staff_attendance_casino_id_staff_id_date_key;
ALTER TABLE public.staff_attendance     DROP CONSTRAINT IF EXISTS staff_attendance_staff_id_fkey;
ALTER TABLE public.weekly_bonus_entries DROP CONSTRAINT IF EXISTS weekly_bonus_entries_casino_id_dealer_id_week_start_key;
ALTER TABLE public.weekly_bonus_entries DROP CONSTRAINT IF EXISTS weekly_bonus_entries_dealer_id_fkey;

ALTER TABLE public.breaklist_logs       DROP CONSTRAINT IF EXISTS breaklist_logs_dealer_id_fkey;
COMMENT ON COLUMN public.breaklist_logs.dealer_id IS 'Audit-only. Stores employees.id since Phase 3; FK dropped Phase 4.';

-- 5. Drop legacy id columns.
ALTER TABLE public.breaklist            DROP COLUMN dealer_id;
ALTER TABLE public.pit_rota             DROP COLUMN dealer_id;
ALTER TABLE public.dealer_attendance    DROP COLUMN dealer_id;
ALTER TABLE public.staff_rota           DROP COLUMN staff_id;
ALTER TABLE public.staff_attendance     DROP COLUMN staff_id;
ALTER TABLE public.weekly_bonus_entries DROP COLUMN dealer_id;

-- 6. Detach employees from legacy parents and drop those columns.
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_dealer_id_fkey;
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_staff_member_id_fkey;
ALTER TABLE public.employees DROP COLUMN IF EXISTS dealer_id;
ALTER TABLE public.employees DROP COLUMN IF EXISTS staff_member_id;

-- 7. Drop legacy parent tables.
DROP TABLE IF EXISTS public.dealers       CASCADE;
DROP TABLE IF EXISTS public.staff_members CASCADE;
