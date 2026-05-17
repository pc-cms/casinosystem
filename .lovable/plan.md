План, чтобы перестать гонять команды по одной и за один прогон понять причину:

1. Дать один read-only bash-скрипт для запуска на сервере `/opt/casino-system/deploy`.
   - Он сам прочитает `.env`, `runtime-config.json`, состояние контейнеров и nginx.
   - Подключится к `cms-postgres` и выполнит полный набор SQL-проверок.
   - Ничего не изменит в БД.

2. SQL-диагностика проверит именно проблемные цепочки:
   - активное казино `48f4404f-7724-418c-8365-29af3998e113`, slug/name;
   - профиль и роли `superadmin@cms.local`;
   - `user_casino_access`;
   - распределение `players`, `employees`, `gaming_tables`, `shifts`, `daily_summaries`, `table_tracker`, `miss_chips` по `casino_id`;
   - активные/архивные игроки и столы;
   - наличие игрока `Test` любым регистром/частичным совпадением;
   - свежие смены и `tables_result/shift_result/opened_at/status`;
   - текущую business date через RPC, если функция есть;
   - RLS/policies для `players`, `player_cards`, `player_tags`, `gaming_tables`, `shifts`, `daily_summaries`;
   - проверку видимости через роль `authenticated` и JWT claims конкретного пользователя, чтобы отличить “данные есть, RLS режет” от “UI фильтрует не тот casino_id”.

3. Скрипт сохранит полный отчёт в файл, например:
   `/tmp/cms_diag_YYYYMMDD_HHMMSS.log`
   и в конце покажет короткий блок `LIKELY_CAUSE`, где будет указано одно из:
   - wrong active casino / runtime mismatch;
   - data belongs to another casino_id;
   - RLS/policy issue;
   - archived/status/date filter issue;
   - UI/version/runtime display issue.

4. После твоего запуска ты пришлёшь сюда весь файл отчёта одной вставкой или командой `tail -n +1 /tmp/cms_diag_*.log`, и я уже по нему дам точечный fix-скрипт, а не буду угадывать.

Скрипт, который нужно будет выполнить:

```bash
cat > /tmp/cms_diag.sh <<'BASH'
#!/usr/bin/env bash
set -Eeuo pipefail

OUT="/tmp/cms_diag_$(date +%Y%m%d_%H%M%S).log"
DEPLOY_DIR="/opt/casino-system/deploy"
ENV_FILE="$DEPLOY_DIR/.env"
CASINO_ID_EXPECTED="48f4404f-7724-418c-8365-29af3998e113"
SUPERADMIN_EMAIL="superadmin@cms.local"
SUPERADMIN_ID="d11f5421-ebba-44d8-b239-1cba4af20566"

exec > >(tee "$OUT") 2>&1

section(){ echo; echo "===== $* ====="; }
run(){ echo; echo "+ $*"; "$@" || true; }
psqlq(){ sudo docker exec -i cms-postgres psql -U postgres -d postgres -v ON_ERROR_STOP=0 -P pager=off -c "$1" || true; }
psqlblock(){ sudo docker exec -i cms-postgres psql -U postgres -d postgres -v ON_ERROR_STOP=0 -P pager=off <<SQL || true
$1
SQL
}

section "BASIC"
date -Is
hostname -f || hostname
whoami
pwd

section "ENV / RUNTIME"
if [ -f "$ENV_FILE" ]; then
  sudo grep -E '^(CASINO_ID|CASINO_SLUG|CASINO_NAME|LOCAL_DOMAIN|LOCAL_IP|FRONTEND_VERSION)=' "$ENV_FILE" || true
else
  echo "MISSING $ENV_FILE"
fi
run curl -sk https://arusha.local/runtime-config.json
run curl -sk https://arusha.local/healthz

section "DOCKER"
run sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
run sudo docker logs --tail=80 cms-frontend
run sudo docker logs --tail=80 cms-postgrest
run sudo docker logs --tail=80 cms-auth

section "DATABASE IDENTITY"
psqlblock "
SELECT 'db_now' AS k, now() AS v;
SELECT id, slug, name, code FROM public.casinos ORDER BY name;
SELECT * FROM public.node_identity;
"

section "SUPERADMIN PROFILE / ROLES / ACCESS"
psqlblock "
SELECT u.id AS auth_user_id, u.email, u.role AS jwt_db_role, u.aud, u.email_confirmed_at, u.last_sign_in_at
FROM auth.users u
WHERE u.email = '$SUPERADMIN_EMAIL' OR u.id = '$SUPERADMIN_ID'::uuid;

SELECT p.user_id, p.display_name, p.casino_id, c.slug, c.name, p.disabled_at
FROM public.profiles p
LEFT JOIN public.casinos c ON c.id = p.casino_id
WHERE p.user_id = '$SUPERADMIN_ID'::uuid;

SELECT ur.user_id, ur.role
FROM public.user_roles ur
WHERE ur.user_id = '$SUPERADMIN_ID'::uuid
ORDER BY ur.role;

SELECT uca.user_id, uca.casino_id, c.slug, c.name
FROM public.user_casino_access uca
LEFT JOIN public.casinos c ON c.id = uca.casino_id
WHERE uca.user_id = '$SUPERADMIN_ID'::uuid
ORDER BY c.name;
"

section "COUNTS BY CASINO"
psqlblock "
WITH table_counts AS (
  SELECT 'players' AS table_name, casino_id, count(*)::bigint AS rows FROM public.players GROUP BY casino_id
  UNION ALL SELECT 'employees', casino_id, count(*) FROM public.employees GROUP BY casino_id
  UNION ALL SELECT 'gaming_tables', casino_id, count(*) FROM public.gaming_tables GROUP BY casino_id
  UNION ALL SELECT 'shifts', casino_id, count(*) FROM public.shifts GROUP BY casino_id
  UNION ALL SELECT 'daily_summaries', casino_id, count(*) FROM public.daily_summaries GROUP BY casino_id
  UNION ALL SELECT 'table_tracker', casino_id, count(*) FROM public.table_tracker GROUP BY casino_id
  UNION ALL SELECT 'miss_chips', casino_id, count(*) FROM public.miss_chips GROUP BY casino_id
)
SELECT tc.table_name, tc.casino_id, c.slug, c.name, tc.rows
FROM table_counts tc
LEFT JOIN public.casinos c ON c.id = tc.casino_id
ORDER BY tc.table_name, c.name NULLS LAST;
"

section "EXPECTED CASINO DETAILS"
psqlblock "
SELECT 'players' AS entity,
       count(*) AS total,
       count(*) FILTER (WHERE archived_at IS NULL) AS not_archived,
       count(*) FILTER (WHERE archived_at IS NOT NULL) AS archived,
       min(created_at) AS min_created,
       max(created_at) AS max_created
FROM public.players WHERE casino_id = '$CASINO_ID_EXPECTED'::uuid;

SELECT 'gaming_tables' AS entity,
       count(*) AS total,
       count(*) FILTER (WHERE coalesce(is_archived,false)=false) AS active,
       count(*) FILTER (WHERE coalesce(is_archived,false)=true) AS archived
FROM public.gaming_tables WHERE casino_id = '$CASINO_ID_EXPECTED'::uuid;

SELECT 'shifts' AS entity,
       count(*) AS total,
       count(*) FILTER (WHERE status='open') AS open,
       count(*) FILTER (WHERE status='closed') AS closed,
       min(opened_at) AS min_opened,
       max(opened_at) AS max_opened
FROM public.shifts WHERE casino_id = '$CASINO_ID_EXPECTED'::uuid;

SELECT id, name, type, status, is_archived, closing_result, created_at, updated_at
FROM public.gaming_tables
WHERE casino_id = '$CASINO_ID_EXPECTED'::uuid
ORDER BY name;

SELECT id, shift_type, status, opened_at, closed_at, cash_result, tables_result, shift_result
FROM public.shifts
WHERE casino_id = '$CASINO_ID_EXPECTED'::uuid
ORDER BY opened_at DESC
LIMIT 30;
"

section "PLAYER SEARCH TEST"
psqlblock "
SELECT id, casino_id, first_name, last_name, nickname, phone, status, archived_at, created_at
FROM public.players
WHERE first_name ILIKE '%test%'
   OR last_name ILIKE '%test%'
   OR nickname ILIKE '%test%'
   OR phone ILIKE '%test%'
ORDER BY created_at DESC
LIMIT 50;

SELECT id, casino_id, first_name, last_name, nickname, phone, status, archived_at, created_at
FROM public.players
WHERE casino_id = '$CASINO_ID_EXPECTED'::uuid
ORDER BY created_at DESC
LIMIT 20;
"

section "TABLE RESULT DATE WINDOWS"
psqlblock "
DO \$\$
DECLARE d date;
BEGIN
  BEGIN
    SELECT public.get_current_business_date('$CASINO_ID_EXPECTED'::uuid) INTO d;
    RAISE NOTICE 'get_current_business_date=%', d;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'get_current_business_date failed: %', SQLERRM;
    d := (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date;
  END;
END \$\$;

WITH dates AS (
  SELECT (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date AS d
  UNION SELECT ((now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date - 1)
  UNION SELECT opened_at::date FROM public.shifts WHERE casino_id = '$CASINO_ID_EXPECTED'::uuid ORDER BY 1 DESC LIMIT 10
)
SELECT d.d AS ui_date_window,
       count(s.*) AS shifts,
       sum(coalesce(s.tables_result, s.shift_result, 0)) AS ui_tables_result_sum,
       min(s.opened_at) AS first_opened,
       max(s.opened_at) AS last_opened
FROM dates d
LEFT JOIN public.shifts s
  ON s.casino_id = '$CASINO_ID_EXPECTED'::uuid
 AND s.opened_at >= d.d::timestamp
 AND s.opened_at < (d.d + 1)::timestamp
GROUP BY d.d
ORDER BY d.d DESC;

SELECT date, tables_result, cash_result, miss_chips, created_at, updated_at
FROM public.daily_summaries
WHERE casino_id = '$CASINO_ID_EXPECTED'::uuid
ORDER BY date DESC
LIMIT 30;
"

section "RLS / POLICIES"
psqlblock "
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname='public'
  AND tablename IN ('players','player_cards','player_tags','gaming_tables','shifts','daily_summaries','table_tracker','miss_chips','profiles','user_roles','user_casino_access','casinos')
ORDER BY tablename;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('players','player_cards','player_tags','gaming_tables','shifts','daily_summaries','table_tracker','miss_chips','profiles','user_roles','user_casino_access','casinos')
ORDER BY tablename, policyname;
"

section "SIMULATED AUTHENTICATED USER VISIBILITY"
psqlblock "
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '$SUPERADMIN_ID';
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.email = '$SUPERADMIN_EMAIL';

SELECT 'auth.uid()' AS k, auth.uid() AS v;
SELECT 'players_visible' AS k, count(*) AS v FROM public.players;
SELECT 'players_expected_casino_visible' AS k, count(*) AS v FROM public.players WHERE casino_id = '$CASINO_ID_EXPECTED'::uuid;
SELECT 'player_cards_visible' AS k, count(*) AS v FROM public.player_cards;
SELECT 'player_tags_visible' AS k, count(*) AS v FROM public.player_tags;
SELECT 'gaming_tables_expected_visible' AS k, count(*) AS v FROM public.gaming_tables WHERE casino_id = '$CASINO_ID_EXPECTED'::uuid AND coalesce(is_archived,false)=false;
SELECT 'shifts_expected_visible' AS k, count(*) AS v FROM public.shifts WHERE casino_id = '$CASINO_ID_EXPECTED'::uuid;
SELECT 'daily_summaries_expected_visible' AS k, count(*) AS v FROM public.daily_summaries WHERE casino_id = '$CASINO_ID_EXPECTED'::uuid;

SELECT id, first_name, last_name, nickname, phone, casino_id
FROM public.players
ORDER BY last_name
LIMIT 10;

ROLLBACK;
"

section "POSTGREST API DIRECT CHECK"
ANON_KEY=""
if [ -f "$ENV_FILE" ]; then
  ANON_KEY=$(sudo awk -F= '/^ANON_KEY=/{gsub(/^'"'"'|^"|\r|'","",$2); print $2}' "$ENV_FILE" | tail -1)
fi
if [ -n "$ANON_KEY" ]; then
  echo "ANON_KEY present: yes"
  run curl -sk "https://arusha.local/api/rest/v1/players?select=id,first_name,last_name,nickname,casino_id&limit=5" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
  run curl -sk "https://arusha.local/api/rest/v1/gaming_tables?select=id,name,casino_id,is_archived&casino_id=eq.$CASINO_ID_EXPECTED" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
else
  echo "ANON_KEY missing in env"
fi

section "LIKELY_CAUSE QUICK SIGNALS"
psqlblock "
WITH expected AS (SELECT '$CASINO_ID_EXPECTED'::uuid AS cid),
raw AS (
  SELECT
    (SELECT count(*) FROM public.players p, expected e WHERE p.casino_id=e.cid) AS players_expected,
    (SELECT count(*) FROM public.players) AS players_total,
    (SELECT count(*) FROM public.gaming_tables t, expected e WHERE t.casino_id=e.cid AND coalesce(t.is_archived,false)=false) AS active_tables_expected,
    (SELECT count(*) FROM public.gaming_tables) AS tables_total,
    (SELECT count(*) FROM public.shifts s, expected e WHERE s.casino_id=e.cid) AS shifts_expected,
    (SELECT count(*) FROM public.miss_chips m, expected e WHERE m.casino_id=e.cid) AS miss_expected,
    (SELECT count(*) FROM public.user_casino_access u, expected e WHERE u.user_id='$SUPERADMIN_ID'::uuid AND u.casino_id=e.cid) AS super_access_expected,
    (SELECT count(*) FROM public.profiles p, expected e WHERE p.user_id='$SUPERADMIN_ID'::uuid AND p.casino_id=e.cid) AS super_profile_expected
)
SELECT *,
  CASE
    WHEN players_total > 0 AND players_expected = 0 THEN 'DATA_CASINO_ID_MISMATCH_FOR_PLAYERS'
    WHEN super_profile_expected = 0 OR super_access_expected = 0 THEN 'SUPERADMIN_ACCESS_MISMATCH'
    WHEN active_tables_expected = 0 AND tables_total > 0 THEN 'TABLES_ARCHIVED_OR_WRONG_CASINO'
    WHEN shifts_expected = 0 AND miss_expected > 0 THEN 'SHIFTS_WRONG_CASINO_OR_NOT_SYNCED_BUT_MISS_EXISTS'
    ELSE 'NEED_RLS_OR_UI_FILTER_CHECK_FROM_SECTIONS_ABOVE'
  END AS likely_cause
FROM raw;
"

echo
echo "REPORT_FILE=$OUT"
echo "Send me this file output: sudo cat $OUT"
BASH
chmod +x /tmp/cms_diag.sh
sudo /tmp/cms_diag.sh
```

После отчёта следующий шаг будет один из двух:
- если это данные/локальная БД — дам безопасный SQL-fix под `SET LOCAL cms.applying='on'`;
- если это UI/runtime/version — дам точечный патч в коде, чтобы версия и активный casinoId отображались и диагностировались прямо в интерфейсе.