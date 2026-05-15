#!/usr/bin/env bash
#
# Casino System — On-Premises Installer (pairing edition)
# --------------------------------------------------------
# Минимальный мастер: 4 вопроса → pairing code → ждём аппрува в Cloud →
# автоматически загружаем все данные казино + собираем frontend локально.
#
# Запуск:
#   sudo ./deploy/install.sh                   # обычная установка
#   sudo ./deploy/install.sh --reset           # начать pairing заново
#   sudo ./deploy/install.sh --rebuild         # пересобрать frontend
#   sudo ./deploy/install.sh --reconfigure     # перенастроить .env (имя/IP/домен)
#
set -euo pipefail

INSTALLER_VERSION="1.0.182"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "\033[1;36m╔════════════════════════════════════════════════╗\033[0m"
echo -e "\033[1;36m║  Casino System Installer  v${INSTALLER_VERSION}              ║\033[0m"
echo -e "\033[1;36m╚════════════════════════════════════════════════╝\033[0m"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
log()    { echo -e "${BLUE}[install]${NC} $*"; }
ok()     { echo -e "${GREEN}[ ok ]${NC} $*"; }
warn()   { echo -e "${YELLOW}[warn]${NC} $*"; }
fail()   { echo -e "${RED}[fail]${NC} $*" >&2; exit 1; }
hr()     { echo -e "${CYAN}────────────────────────────────────────────────────────${NC}"; }
title()  { echo; hr; echo -e "${BOLD}${CYAN}  $*${NC}"; hr; }

require_root() { [[ $EUID -eq 0 ]] || fail "Запустите от root: sudo ./deploy/install.sh"; }

# ── CLI ──
RESET=0; REBUILD=0; RECONFIGURE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --reset)        RESET=1; shift ;;
    --rebuild)      REBUILD=1; shift ;;
    --reconfigure)  RECONFIGURE=1; shift ;;
    -h|--help)      sed -n '4,16p' "$0"; exit 0 ;;
    *) fail "Неизвестный аргумент: $1" ;;
  esac
done

require_root

# ────────── 1. Система ──────────
title "1/5  Проверка системы"

if ! command -v lsb_release &>/dev/null; then
  apt-get update -qq && apt-get install -y -qq lsb-release
fi
UBUNTU_VER=$(lsb_release -rs)
log "Ubuntu: $UBUNTU_VER"
[[ "${UBUNTU_VER%%.*}" -ge 22 ]] || fail "Нужен Ubuntu 22.04+ (у вас $UBUNTU_VER)"

for pkg in curl jq openssl ca-certificates; do
  command -v "$pkg" &>/dev/null || apt-get install -y -qq "$pkg" 2>&1 | tail -2
done

if ! command -v docker &>/dev/null; then
  log "Устанавливаю Docker..."
  apt-get install -y -qq gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  ok "Docker установлен"
else
  ok "Docker: $(docker --version | awk '{print $3}' | tr -d ',')"
fi

# Проверка интернета
if ! curl -fsS --max-time 8 -o /dev/null https://1.1.1.1 2>/dev/null; then
  fail "Нет интернета. На сервере должен быть доступ к Cloud (хотя бы на момент установки)."
fi
ok "Интернет доступен"

# ────────── helper ──────────
update_env() {
  local key="$1" val="$2"
  if grep -qE "^${key}=" .env 2>/dev/null; then
    local esc=$(printf '%s\n' "$val" | sed -e 's/[\/&|]/\\&/g')
    sed -i "s|^${key}=.*|${key}=${esc}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}
gen_secret() { openssl rand -base64 48 | tr -d '\n=+/' | cut -c1-64; }

# ────────── 2. Конфигурация / сопряжение ──────────
SEED_DONE_FILE="${SCRIPT_DIR}/.pairing-done"

if [[ $RESET -eq 1 ]]; then
  rm -f "$SEED_DONE_FILE" .env
fi
[[ -f .env ]] || cp env.template .env
set -a; source .env; set +a

NEED_PAIRING=1
[[ -f "$SEED_DONE_FILE" && -n "${CASINO_ID:-}" && -n "${SYNC_SECRET:-}" ]] && NEED_PAIRING=0

if [[ $NEED_PAIRING -eq 1 || $RECONFIGURE -eq 1 ]]; then
  title "2/5  Параметры локации"

  # Helper: read из /dev/tty (если доступен) или из stdin.
  ask() {
    local _prompt="$1" _var="$2" _default="${3:-}"
    local _input=""
    if [[ -e /dev/tty ]]; then
      read -r -p "$_prompt" _input </dev/tty
    else
      read -r -p "$_prompt" _input
    fi
    printf -v "$_var" '%s' "${_input:-$_default}"
  }

  # Название — обязательное, спрашиваем пока не введут.
  CASINO_NAME=""
  while [[ -z "$CASINO_NAME" ]]; do
    ask "  Название локации (например: Premier Arusha): " CASINO_NAME ""
    [[ -z "$CASINO_NAME" ]] && warn "Название обязательно — введите хотя бы одно слово."
  done

  DEFAULT_SLUG=$(echo "${CASINO_SLUG:-${CASINO_NAME,,}}" | tr ' ' '-' | tr -cd 'a-z0-9-')
  CASINO_SLUG=""
  while [[ ! "$CASINO_SLUG" =~ ^[a-z0-9-]+$ ]]; do
    ask "  Slug (a-z, 0-9, дефис) [${DEFAULT_SLUG}]: " CASINO_SLUG "$DEFAULT_SLUG"
    [[ "$CASINO_SLUG" =~ ^[a-z0-9-]+$ ]] || warn "Только латиница, цифры и дефис."
  done

  DEFAULT_IP=$(hostname -I | awk '{print $1}')
  LOCAL_IP=""
  while [[ ! "$LOCAL_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; do
    ask "  Локальный IP сервера [${DEFAULT_IP}]: " LOCAL_IP "$DEFAULT_IP"
    [[ "$LOCAL_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || warn "IP в формате X.X.X.X."
  done

  DEFAULT_DOMAIN="${LOCAL_DOMAIN:-${CASINO_SLUG}.local}"
  ask "  Домен в LAN [${DEFAULT_DOMAIN}]: " LOCAL_DOMAIN "$DEFAULT_DOMAIN"

  update_env CASINO_NAME   "$CASINO_NAME"
  update_env CASINO_SLUG   "$CASINO_SLUG"
  update_env LOCAL_IP      "$LOCAL_IP"
  update_env LOCAL_DOMAIN  "$LOCAL_DOMAIN"
  ok "Параметры сохранены"
fi


set -a; source .env; set +a

# ────────── 3. Pairing (если нужно) ──────────
if [[ $NEED_PAIRING -eq 1 ]]; then
  title "3/5  Сопряжение с Cloud"

  HOSTNAME_VAL=$(hostname)
  RAM_GB=$(awk '/MemTotal/ {printf "%d", $2/1024/1024}' /proc/meminfo)
  DISK_GB=$(df -BG --output=size / | tail -1 | tr -dc '0-9')
  DOCKER_VER=$(docker --version 2>/dev/null | awk '{print $3}' | tr -d ',')

  log "Регистрирую сервер в Cloud..."
  REG_PAYLOAD=$(jq -n \
    --arg name "$CASINO_NAME" --arg slug "$CASINO_SLUG" \
    --arg ip "$LOCAL_IP" --arg host "$HOSTNAME_VAL" \
    --arg ubuntu "$UBUNTU_VER" --arg docker "$DOCKER_VER" \
    --argjson ram "$RAM_GB" --argjson disk "$DISK_GB" \
    '{server_name:$name, server_slug:$slug, server_ip:$ip, hostname:$host,
      system_info:{ubuntu:$ubuntu, docker:$docker, ram_gb:$ram, disk_gb:$disk}}')

  REG_RESP=$(curl -fsS --max-time 15 -X POST \
    "${CLOUD_URL}/functions/v1/register-local-server" \
    -H "apikey: ${CLOUD_ANON_KEY}" \
    -H "Authorization: Bearer ${CLOUD_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "$REG_PAYLOAD") || fail "Не удалось зарегистрировать сервер в Cloud"

  PAIRING_CODE=$(echo "$REG_RESP" | jq -r '.pairing_code // empty')
  EXPIRES_AT=$(echo "$REG_RESP" | jq -r '.expires_at // empty')
  [[ -n "$PAIRING_CODE" ]] || fail "Cloud вернул: $REG_RESP"

  echo
  echo "  ┌────────────────────────────────────────┐"
  echo "  │                                        │"
  printf "  │      ${BOLD}PAIRING CODE:  %s — %s${NC}      │\n" "${PAIRING_CODE:0:4}" "${PAIRING_CODE:4:4}"
  echo "  │                                        │"
  echo "  │  Откройте в Cloud-админке:             │"
  echo "  │    Admin → Network → Pending Servers   │"
  echo "  │  Найдите этот код, выберите казино     │"
  echo "  │  и нажмите Approve.                    │"
  echo "  │                                        │"
  echo "  │  Код действителен до: ${EXPIRES_AT:11:5} UTC      │"
  echo "  └────────────────────────────────────────┘"
  echo

  log "Жду аппрува (polling каждые 5 сек, до 30 минут)..."
  APPROVED_JSON=""
  for i in $(seq 1 360); do
    POLL=$(curl -fsS --max-time 10 \
      "${CLOUD_URL}/functions/v1/register-local-server?code=${PAIRING_CODE}" \
      -H "apikey: ${CLOUD_ANON_KEY}" \
      -H "Authorization: Bearer ${CLOUD_ANON_KEY}" 2>/dev/null || echo '{}')
    STATUS=$(echo "$POLL" | jq -r '.status // "unknown"')
    case "$STATUS" in
      approved)  APPROVED_JSON="$POLL"; break ;;
      rejected)  fail "Запрос отклонён super_admin'ом" ;;
      expired)   fail "Pairing-код истёк. Запустите снова: sudo ./deploy/install.sh --reset" ;;
      pending)   printf "."; sleep 5 ;;
      *)         printf "?"; sleep 5 ;;
    esac
  done
  echo
  [[ -n "$APPROVED_JSON" ]] || fail "Время ожидания истекло (30 мин)"

  CASINO_ID=$(echo "$APPROVED_JSON" | jq -r '.casino_id')
  SYNC_SECRET=$(echo "$APPROVED_JSON" | jq -r '.sync_secret')
  SEED_TOKEN=$(echo "$APPROVED_JSON" | jq -r '.seed_token')
  ok "Аппрув получен. casino_id=${CASINO_ID:0:8}..."
  update_env CASINO_ID   "$CASINO_ID"
  update_env SYNC_SECRET "$SYNC_SECRET"
  set -a; source .env; set +a
fi

# ────────── 4. Секреты + сертификаты ──────────
title "4/5  Секреты и сертификаты"

[[ -z "${POSTGRES_PASSWORD:-}" ]] && { update_env POSTGRES_PASSWORD "$(gen_secret)"; ok "POSTGRES_PASSWORD"; }
[[ -z "${JWT_SECRET:-}" ]]        && { update_env JWT_SECRET        "$(gen_secret)"; ok "JWT_SECRET"; }
set -a; source .env; set +a

gen_jwt() {
  local role="$1" secret="$2"
  local header='{"alg":"HS256","typ":"JWT"}'
  local payload="{\"iss\":\"casino-local\",\"role\":\"${role}\",\"iat\":$(date +%s),\"exp\":$(date -d '+10 years' +%s)}"
  local h=$(printf '%s' "$header"  | openssl base64 -A | tr -d '=' | tr '/+' '_-')
  local p=$(printf '%s' "$payload" | openssl base64 -A | tr -d '=' | tr '/+' '_-')
  local sig=$(printf '%s.%s' "$h" "$p" | openssl dgst -sha256 -hmac "$secret" -binary | openssl base64 -A | tr -d '=' | tr '/+' '_-')
  echo "${h}.${p}.${sig}"
}
[[ -z "${ANON_KEY:-}" ]]         && { update_env ANON_KEY         "$(gen_jwt anon "$JWT_SECRET")";          ok "ANON_KEY"; }
[[ -z "${SERVICE_ROLE_KEY:-}" ]] && { update_env SERVICE_ROLE_KEY "$(gen_jwt service_role "$JWT_SECRET")"; ok "SERVICE_ROLE_KEY"; }
set -a; source .env; set +a

mkdir -p certs
if [[ ! -f certs/ca.crt ]]; then
  openssl genrsa -out certs/ca.key 4096 2>/dev/null
  openssl req -x509 -new -nodes -key certs/ca.key -sha256 -days 3650 \
    -out certs/ca.crt -subj "/C=TZ/O=${CASINO_NAME}/CN=Casino System Local CA" 2>/dev/null
  ok "CA создан"
fi
if [[ ! -f certs/server.crt ]] || ! openssl x509 -in certs/server.crt -noout -text 2>/dev/null | grep -q "DNS:${LOCAL_DOMAIN}"; then
  openssl genrsa -out certs/server.key 2048 2>/dev/null
  cat > certs/server.cnf <<EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no
[req_distinguished_name]
C = TZ
O = ${CASINO_NAME}
CN = ${LOCAL_DOMAIN}
[v3_req]
keyUsage = keyEncipherment, dataEncipherment, digitalSignature
extendedKeyUsage = serverAuth
subjectAltName = @alt_names
[alt_names]
DNS.1 = ${LOCAL_DOMAIN}
DNS.2 = *.${LOCAL_DOMAIN}
DNS.3 = localhost
IP.1  = 127.0.0.1
IP.2  = ${LOCAL_IP}
EOF
  openssl req -new -key certs/server.key -out certs/server.csr -config certs/server.cnf 2>/dev/null
  openssl x509 -req -in certs/server.csr -CA certs/ca.crt -CAkey certs/ca.key -CAcreateserial \
    -out certs/server.crt -days 3650 -sha256 -extensions v3_req -extfile certs/server.cnf 2>/dev/null
  rm -f certs/server.csr certs/server.cnf certs/ca.srl
  chmod 600 certs/*.key
  ok "Server cert для ${LOCAL_DOMAIN}"
fi

grep -qE "^[^#]*\s${LOCAL_DOMAIN}(\s|$)" /etc/hosts \
  || echo "127.0.0.1  ${LOCAL_DOMAIN}" >> /etc/hosts

# ────────── 4.5. Миграции + seed ──────────
mkdir -p postgres/migrations postgres/init
if [[ -d ../supabase/migrations ]]; then
  cp ../supabase/migrations/*.sql postgres/migrations/ 2>/dev/null || true
  cp ../supabase/migrations/*.sql postgres/init/      2>/dev/null || true
  ok "Скопировано $(ls postgres/migrations/*.sql 2>/dev/null | wc -l) миграций"
fi

if [[ ! -f "$SEED_DONE_FILE" && -n "${SEED_TOKEN:-}" ]]; then
  log "Запускаю postgres для seed-импорта..."
  docker compose up -d postgres
  for i in $(seq 1 30); do
    docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" &>/dev/null && break
    sleep 2
    [[ $i -eq 30 ]] && fail "Postgres не стартовал"
  done
  ok "Postgres готов"

  # Sanity-check пароля: если volume инициализирован ранее с другим паролем,
  # ALTER USER через локальный сокет (peer auth для OS-user "postgres" внутри контейнера).
  # Если и это не помогло — а seed ещё не делали — безопасно пересоздать том (данных нет).
  log "Проверяю пароль postgres..."
  PG_OK=0
  if docker compose exec -T -e PGPASSWORD="${POSTGRES_PASSWORD}" postgres \
       psql -h 127.0.0.1 -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" -tAc "SELECT 1" &>/dev/null; then
    PG_OK=1
    ok "Пароль postgres валиден"
  fi

  if [[ $PG_OK -eq 0 ]]; then
    warn "Пароль postgres не совпадает с .env. Пробую ALTER USER через локальный сокет..."
    PG_ESCAPED=$(printf "%s" "${POSTGRES_PASSWORD}" | sed "s/'/''/g")
    ALTER_OUT=$(docker compose exec -T -u postgres postgres \
         psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" \
         -c "ALTER USER \"${POSTGRES_USER:-postgres}\" WITH PASSWORD '${PG_ESCAPED}';" 2>&1)
    ALTER_RC=$?
    if [[ $ALTER_RC -eq 0 ]]; then
      docker compose restart postgres &>/dev/null || true
      for i in $(seq 1 30); do
        docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" &>/dev/null && break
        sleep 2
      done
      if docker compose exec -T -e PGPASSWORD="${POSTGRES_PASSWORD}" postgres \
           psql -h 127.0.0.1 -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" -tAc "SELECT 1" &>/dev/null; then
        PG_OK=1
        ok "Пароль postgres синхронизирован с .env"
      fi
    else
      warn "ALTER USER не сработал: ${ALTER_OUT}"
    fi
  fi

  if [[ $PG_OK -eq 0 ]]; then
    warn "Не удалось синхронизировать пароль. Seed ещё не выполнен — пересоздаю том postgres (данных там нет)."
    docker compose down postgres &>/dev/null || true
    PG_VOLUME=$(docker volume ls --format '{{.Name}}' | grep -E "$(basename "$SCRIPT_DIR")_postgres-data$" | head -1)
    [[ -n "$PG_VOLUME" ]] || PG_VOLUME="$(basename "$SCRIPT_DIR")_postgres-data"
    docker volume rm "$PG_VOLUME" &>/dev/null || warn "Не удалось удалить volume $PG_VOLUME (возможно уже удалён)"
    log "Поднимаю postgres заново с чистым томом..."
    docker compose up -d postgres
    for i in $(seq 1 60); do
      docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" &>/dev/null && break
      sleep 2
      [[ $i -eq 60 ]] && fail "Postgres не стартовал после пересоздания тома"
    done
    if docker compose exec -T -e PGPASSWORD="${POSTGRES_PASSWORD}" postgres \
         psql -h 127.0.0.1 -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" -tAc "SELECT 1" &>/dev/null; then
      ok "Postgres пересоздан с правильным паролем"
      PG_OK=1
    else
      fail "Даже после пересоздания тома пароль не работает. Проверьте POSTGRES_PASSWORD в ${SCRIPT_DIR}/.env"
    fi
  fi

  log "Загружаю полные данные казино из Cloud..."
  COMPOSE_NET=$(docker network ls --format '{{.Name}}' | grep -E "^$(basename "$SCRIPT_DIR")_cms-net$" | head -1)
  [[ -n "$COMPOSE_NET" ]] || COMPOSE_NET="cms-net"

  set +e
  mkdir -p "${SCRIPT_DIR}/postgres/seed-data"
  SEED_FILE="${SCRIPT_DIR}/postgres/seed-data/seed.json"
  SEED_TMP="${SEED_FILE}.part"
  SEED_HEADERS="${SCRIPT_DIR}/postgres/seed-data/seed.headers"
  MIN_SEED_BYTES=1024

  SEED_OK=0
  for attempt in 1 2 3; do
    log "Скачиваю seed-данные (попытка ${attempt}/3, может занять несколько минут)..."
    rm -f "$SEED_TMP" "$SEED_HEADERS"
    HTTP_CODE=$(curl -sS --fail-with-body \
      --connect-timeout 30 --max-time 1800 \
      --retry 3 --retry-delay 5 --retry-all-errors \
      -D "$SEED_HEADERS" \
      -o "$SEED_TMP" \
      -w "%{http_code}" \
      -H "x-seed-token: ${SEED_TOKEN}" \
      -H "Accept: application/json" \
      "${CLOUD_URL}/functions/v1/cloud-seed-export?days=all")
    CURL_RC=$?
    SEED_SIZE=$(stat -c%s "$SEED_TMP" 2>/dev/null || echo 0)

    if [[ "$HTTP_CODE" != "200" ]]; then
      echo "  ✗ HTTP $HTTP_CODE (size=${SEED_SIZE}B)"
      [[ -s "$SEED_TMP" ]] && { echo "  ── тело:"; head -c 500 "$SEED_TMP"; echo; }
      sleep 5; continue
    fi
    if [[ "$SEED_SIZE" -lt "$MIN_SEED_BYTES" ]]; then
      echo "  ✗ Файл слишком маленький (${SEED_SIZE}B < ${MIN_SEED_BYTES}B) — вероятно пустой ответ"
      [[ -s "$SEED_TMP" ]] && head -c 500 "$SEED_TMP" && echo
      sleep 5; continue
    fi
    FIRST_CHAR=$(head -c 1 "$SEED_TMP")
    if [[ "$FIRST_CHAR" != "{" && "$FIRST_CHAR" != "[" ]]; then
      echo "  ✗ Ответ не похож на JSON (начало: '$FIRST_CHAR')"
      head -c 500 "$SEED_TMP"; echo
      sleep 5; continue
    fi
    if [[ $CURL_RC -ne 0 ]]; then
      warn "curl вернул код $CURL_RC, но seed-файл уже скачан и прошёл проверки (http=$HTTP_CODE, size=${SEED_SIZE}B). Продолжаю импорт."
    fi

    mv -f "$SEED_TMP" "$SEED_FILE"
    SEED_OK=1
    ok "Seed скачан ($((SEED_SIZE/1024)) KB, http=$HTTP_CODE)"
    break
  done

  rm -f "$SEED_HEADERS"
  if [[ $SEED_OK -ne 1 ]]; then
    set -e
    fail "Не удалось скачать seed после 3 попыток. Проверьте интернет/CLOUD_URL/SEED_TOKEN и запустите ./install.sh ещё раз."
  fi

  log "Импортирую данные в Postgres..."
  docker run --rm \
      --network "$COMPOSE_NET" \
      -v "${SCRIPT_DIR}/postgres/seed-import.js:/seed-import.js:ro" \
      -v "${SEED_FILE}:/seed.json:ro" \
      -e PGHOST=postgres \
      -e PGUSER="${POSTGRES_USER:-postgres}" \
      -e PGPASSWORD="${POSTGRES_PASSWORD}" \
      -e PGDATABASE="${POSTGRES_DB:-postgres}" \
      -e SEED_FILE=/seed.json \
      -e NODE_PATH=/work/node_modules \
      node:20-alpine sh -c "set -e; mkdir -p /work && cd /work && echo '{\"type\":\"module\"}' > package.json && npm i --no-fund --no-audit --loglevel=error pg 2>&1 | tail -20 && cp /seed-import.js /work/seed-import.mjs && node /work/seed-import.mjs /seed.json"
  SEED_RC=$?
  set -e
  [[ $SEED_RC -eq 0 ]] || fail "Seed-импорт завершился с ошибкой ($SEED_RC). Файл сохранён: $SEED_FILE. Запустите ./install.sh ещё раз."
  touch "$SEED_DONE_FILE"
  ok "Данные загружены"
fi

# ────────── 5. Сборка frontend + старт ──────────
title "5/5  Сборка frontend и запуск стека"

if [[ $REBUILD -eq 1 ]] || ! docker image inspect "cms-frontend:${FRONTEND_VERSION:-local}" &>/dev/null; then
  log "Собираю cms-frontend (3-7 минут)..."
  docker compose build cms-frontend
  ok "Frontend собран"
else
  ok "Frontend образ уже есть (используем кэш). --rebuild чтобы пересобрать."
fi

log "Запуск всех контейнеров..."
docker compose up -d

log "Жду готовности frontend (до 30 сек)..."
for i in $(seq 1 15); do
  docker compose exec -T cms-frontend curl -fsS http://localhost/ -o /dev/null 2>/dev/null && { ok "Frontend запущен"; break; }
  sleep 2
done

# systemd
SYSTEMD_UNIT=/etc/systemd/system/casino-system.service
if [[ ! -f "$SYSTEMD_UNIT" ]]; then
  cat > "$SYSTEMD_UNIT" <<EOF
[Unit]
Description=Casino System (${CASINO_NAME})
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target
[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${SCRIPT_DIR}
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=600
[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable casino-system.service
  ok "systemd unit установлен"
fi

# ── финал ──
echo; hr
echo -e "${GREEN}${BOLD}  ✓ Установка завершена!${NC}"
hr; echo
echo -e "  📍 ${BOLD}${CASINO_NAME}${NC} (slug: ${CASINO_SLUG})"
echo -e "  🌐 URL:        ${BOLD}https://${LOCAL_DOMAIN}${NC}"
echo -e "  🖥️  IP:         ${LOCAL_IP}"
echo -e "  🔑 CA:         ${SCRIPT_DIR}/certs/ca.crt"
echo
echo -e "  Следующие шаги:"
echo -e "    1. Скопируйте ${BOLD}certs/ca.crt${NC} на каждое устройство и установите как Trusted Root"
echo -e "    2. Пропишите DNS:  ${LOCAL_IP}  ${LOCAL_DOMAIN}  на роутере"
echo -e "    3. Откройте https://${LOCAL_DOMAIN} → Установить приложение"
echo
echo -e "  📊 Статус:     ${CYAN}docker compose ps${NC}"
echo -e "  📜 Логи:       ${CYAN}docker compose logs -f${NC}"
echo -e "  🔄 Пересборка: ${CYAN}sudo ./deploy/install.sh --rebuild${NC}"
echo -e "  ⚙️  Заново:     ${CYAN}sudo ./deploy/install.sh --reset${NC}"
echo
