#!/usr/bin/env bash
#
# Casino System — On-Premises Interactive Installer
# --------------------------------------------------
# Универсальный установщик для любой локации (Arusha / Dodoma / Mbeya / ...).
#
# Режимы запуска:
#   sudo ./install.sh                           # интерактивный мастер
#   sudo ./install.sh --reconfigure             # перенастроить .env
#   sudo ./install.sh --check-update            # только проверить наличие нового образа
#   sudo ./install.sh --upgrade-to v1.5.2       # принудительно обновить до версии
#   sudo ./install.sh --skip-update-check       # не обновлять, даже если есть новый
#   sudo ./install.sh --slug arusha ...         # CLI-режим (см. ниже)
#
# Что делает мастер:
#   1. Проверяет Ubuntu 22.04+ и устанавливает Docker если нужно
#   2. Спрашивает: название, slug, IP, домен, CASINO_ID, sync_secret
#   3. ПРОВЕРКА СВЯЗИ (3 уровня):
#       • интернет (curl 1.1.1.1 / api.github.com)
#       • Cloud Supabase REST + валидация CASINO_ID в реестре casinos
#       • GitHub API + последняя версия образа (если задан GITHUB_TOKEN)
#      → Если интернета нет — продолжаем с локальными образами (с подтверждением)
#   4. Генерирует JWT/CA/server cert (включает LOCAL_IP в SAN)
#   5. Применяет миграции БД
#   6. Решает версию образа (текущая / latest / --upgrade-to) с авто-откатом при сбое
#   7. docker compose pull + up -d + health check
#   8. Устанавливает systemd unit для автозапуска

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ────────── colors / logging ──────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
log()    { echo -e "${BLUE}[install]${NC} $*"; }
ok()     { echo -e "${GREEN}[ ok ]${NC} $*"; }
warn()   { echo -e "${YELLOW}[warn]${NC} $*"; }
fail()   { echo -e "${RED}[fail]${NC} $*" >&2; exit 1; }
hr()     { echo -e "${CYAN}────────────────────────────────────────────────────────${NC}"; }
title()  { echo; hr; echo -e "${BOLD}${CYAN}  $*${NC}"; hr; }

require_root() { [[ $EUID -eq 0 ]] || fail "Запустите от root: sudo ./install.sh"; }

# ────────── 0. CLI args ──────────
RECONFIGURE=0
CHECK_UPDATE_ONLY=0
NONINTERACTIVE=0
SKIP_UPDATE_CHECK=0
declare -A CLI

while [[ $# -gt 0 ]]; do
  case "$1" in
    --reconfigure)    RECONFIGURE=1; shift ;;
    --check-update)   CHECK_UPDATE_ONLY=1; shift ;;
    --slug)           CLI[CASINO_SLUG]="$2";   NONINTERACTIVE=1; shift 2 ;;
    --name)           CLI[CASINO_NAME]="$2";   NONINTERACTIVE=1; shift 2 ;;
    --domain)         CLI[LOCAL_DOMAIN]="$2";  NONINTERACTIVE=1; shift 2 ;;
    --ip)             CLI[LOCAL_IP]="$2";      NONINTERACTIVE=1; shift 2 ;;
    --casino-id)      CLI[CASINO_ID]="$2";     NONINTERACTIVE=1; shift 2 ;;
    --sync-secret)    CLI[SYNC_SECRET]="$2";   NONINTERACTIVE=1; shift 2 ;;
    --github-owner)   CLI[GITHUB_OWNER]="$2";  NONINTERACTIVE=1; shift 2 ;;
    --upgrade-to)     CLI[UPGRADE_TO]="$2";    shift 2 ;;
    --skip-update-check) SKIP_UPDATE_CHECK=1;  shift ;;
    -h|--help)
      sed -n '4,30p' "$0"; exit 0 ;;
    *) fail "Неизвестный аргумент: $1" ;;
  esac
done

require_root

# ────────── 1. system checks ──────────
title "1/8  Проверка системы"

if ! command -v lsb_release &>/dev/null; then
  apt-get update -qq && apt-get install -y -qq lsb-release
fi
UBUNTU_VER=$(lsb_release -rs)
log "Ubuntu: $UBUNTU_VER"
[[ "${UBUNTU_VER%%.*}" -ge 22 ]] || warn "Рекомендуется Ubuntu 22.04+, у вас $UBUNTU_VER"

# инструменты для мастера
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

# ────────── helper: интерактивный prompt с дефолтом ──────────
ask() {
  local var_name="$1" prompt="$2" default="${3:-}" current="${!var_name:-$default}"
  # CLI-аргумент имеет приоритет
  if [[ -n "${CLI[$var_name]:-}" ]]; then
    eval "$var_name=\"\${CLI[$var_name]}\""
    return
  fi
  if [[ $NONINTERACTIVE -eq 1 ]]; then
    [[ -n "$current" ]] || fail "В non-interactive режиме нужно передать --${var_name,,} (нет дефолта)"
    eval "$var_name=\"$current\""
    return
  fi
  local hint=""; [[ -n "$current" ]] && hint=" [${current}]"
  read -r -p "  ${prompt}${hint}: " input
  eval "$var_name=\"${input:-$current}\""
}

ask_secret() {
  local var_name="$1" prompt="$2" current="${!var_name:-}"
  if [[ -n "${CLI[$var_name]:-}" ]]; then
    eval "$var_name=\"\${CLI[$var_name]}\""; return
  fi
  if [[ $NONINTERACTIVE -eq 1 ]]; then
    [[ -n "$current" ]] || fail "В non-interactive режиме нужно передать --${var_name,,}"
    return
  fi
  local hint=""; [[ -n "$current" ]] && hint=" [сохранить текущий]"
  read -r -s -p "  ${prompt}${hint}: " input; echo
  eval "$var_name=\"${input:-$current}\""
}

# ────────── 2. .env ──────────
ENV_EXISTS=0
[[ -f .env ]] && ENV_EXISTS=1

if [[ $ENV_EXISTS -eq 1 && $RECONFIGURE -eq 0 && $NONINTERACTIVE -eq 0 ]]; then
  title "2/8  Найден существующий .env"
  echo "  Текущая локация: $(grep -E '^CASINO_NAME=' .env | cut -d= -f2-)"
  echo "  Домен:           $(grep -E '^LOCAL_DOMAIN=' .env | cut -d= -f2-)"
  echo
  read -r -p "  Перенастроить? [y/N]: " yn
  if [[ "${yn,,}" == "y" ]]; then RECONFIGURE=1; fi
fi

if [[ $ENV_EXISTS -eq 0 || $RECONFIGURE -eq 1 ]]; then
  title "2/8  Настройка казино"
  [[ $ENV_EXISTS -eq 1 ]] && set -a && source .env && set +a
  [[ $ENV_EXISTS -eq 0 ]] && cp env.template .env

  echo "  Введите параметры новой локации (Enter — оставить по умолчанию)"
  echo
  ask CASINO_NAME    "Название локации (например: Premier Arusha)" "${CASINO_NAME:-}"
  ask CASINO_SLUG    "Slug (только латиница, нижний регистр)"      "${CASINO_SLUG:-arusha}"
  ask LOCAL_IP       "Локальный IP сервера в сети казино"          "${LOCAL_IP:-$(hostname -I | awk '{print $1}')}"
  ask LOCAL_DOMAIN   "Локальный домен (для PWA в LAN)"             "${LOCAL_DOMAIN:-${CASINO_SLUG}.local}"
  ask CASINO_ID      "CASINO_ID (UUID, выдаёт Premier admin)"      "${CASINO_ID:-}"
  ask_secret SYNC_SECRET "SYNC_SECRET (выдаёт Premier admin)"

  ask GITHUB_OWNER   "GitHub owner (для авто-обновлений образа)"   "${GITHUB_OWNER:-your-github-org}"

  # Валидация
  [[ "$CASINO_SLUG" =~ ^[a-z0-9-]+$ ]] || fail "Неверный slug: только a-z, 0-9, дефис"
  [[ "$CASINO_ID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]] \
    || fail "Неверный CASINO_ID — должен быть UUID v4"
  [[ "$LOCAL_DOMAIN" =~ ^[a-zA-Z0-9.-]+$ ]] || fail "Неверный домен"
  [[ "$LOCAL_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "Неверный IP"
  [[ ${#SYNC_SECRET} -ge 16 ]] || fail "SYNC_SECRET слишком короткий (минимум 16 символов)"

  # Запись в .env
  update_env() {
    local key="$1" val="$2"
    if grep -qE "^${key}=" .env; then
      # экранируем спец-символы в значении
      local esc=$(printf '%s\n' "$val" | sed -e 's/[\/&|]/\\&/g')
      sed -i "s|^${key}=.*|${key}=${esc}|" .env
    else
      echo "${key}=${val}" >> .env
    fi
  }
  update_env CASINO_NAME   "$CASINO_NAME"
  update_env CASINO_SLUG   "$CASINO_SLUG"
  update_env CASINO_ID     "$CASINO_ID"
  update_env LOCAL_DOMAIN  "$LOCAL_DOMAIN"
  update_env LOCAL_IP      "$LOCAL_IP"
  update_env SYNC_SECRET   "$SYNC_SECRET"
  update_env GITHUB_OWNER  "$GITHUB_OWNER"

  ok "Конфигурация сохранена в .env"
fi

set -a; source .env; set +a

# ────────── 3. Проверка связи: интернет → Cloud → GitHub Registry ──────────
title "3/8  Проверка связи с внешними сервисами"

CLOUD_URL="${CLOUD_URL:-https://rpehngjvwcnipvkouluu.supabase.co}"
GHCR_HOST="ghcr.io"
GH_API="https://api.github.com"
GH_REPO="${GITHUB_REPO:-casino-system}"

INTERNET_OK=0
CLOUD_OK=0
REGISTRY_OK=0
LATEST_VERSION=""
CURRENT_VERSION="${FRONTEND_VERSION:-latest}"

# 3.1 — Интернет (DNS + HTTPS)
log "Проверка интернет-соединения..."
if curl -fsS --max-time 8 -o /dev/null https://1.1.1.1 2>/dev/null \
   || curl -fsS --max-time 8 -o /dev/null https://api.github.com 2>/dev/null; then
  ok "Интернет доступен"
  INTERNET_OK=1
else
  warn "Интернет недоступен"
fi

# 3.2 — Cloud Supabase + валидация CASINO_ID
if [[ $INTERNET_OK -eq 1 ]]; then
  log "Проверка Cloud (${CLOUD_URL})..."
  if curl -fsS --max-time 10 -o /dev/null \
       -H "apikey: ${CLOUD_ANON_KEY}" \
       "${CLOUD_URL}/rest/v1/?apikey=${CLOUD_ANON_KEY}" 2>/dev/null; then
    ok "Cloud REST API доступен"
    CLOUD_OK=1

    log "Проверка CASINO_ID=${CASINO_ID:0:8}... в реестре casinos..."
    RESPONSE=$(curl -fsS --max-time 10 \
      -H "apikey: ${CLOUD_ANON_KEY}" \
      -H "Authorization: Bearer ${CLOUD_ANON_KEY}" \
      "${CLOUD_URL}/rest/v1/casinos?id=eq.${CASINO_ID}&select=id,name,slug" 2>/dev/null || echo "[]")
    if [[ "$RESPONSE" == "[]" || -z "$RESPONSE" ]]; then
      warn "CASINO_ID не найден через anon (возможно RLS закрыт — sync проверит позже)"
    else
      REMOTE_NAME=$(echo "$RESPONSE" | jq -r '.[0].name // "unknown"')
      REMOTE_SLUG=$(echo "$RESPONSE" | jq -r '.[0].slug // "unknown"')
      ok "Локация в Cloud: ${REMOTE_NAME} (${REMOTE_SLUG})"
      [[ "$REMOTE_SLUG" != "$CASINO_SLUG" ]] && warn "Slug в Cloud (${REMOTE_SLUG}) ≠ локальный (${CASINO_SLUG})"
    fi
  else
    warn "Cloud недоступен"
  fi
fi

# 3.3 — GitHub Registry + последняя версия образа
GH_AUTH=()
[[ -n "${GITHUB_TOKEN:-}" && "$GITHUB_TOKEN" != "ghp_replace_me" ]] \
  && GH_AUTH=(-H "Authorization: Bearer ${GITHUB_TOKEN}")

if [[ $INTERNET_OK -eq 1 ]]; then
  log "Проверка GitHub (${GHCR_HOST})..."
  if curl -fsS --max-time 8 -o /dev/null "${GH_API}/zen" 2>/dev/null; then
    ok "GitHub API доступен"
    REGISTRY_OK=1
    if [[ ${#GH_AUTH[@]} -gt 0 ]]; then
      RELEASE_JSON=$(curl -fsS --max-time 10 "${GH_AUTH[@]}" \
        "${GH_API}/repos/${GITHUB_OWNER}/${GH_REPO}/releases/latest" 2>/dev/null || echo "{}")
      LATEST_VERSION=$(echo "$RELEASE_JSON" | jq -r '.tag_name // ""')
      [[ -n "$LATEST_VERSION" ]] && ok "Последний релиз: ${LATEST_VERSION}" \
                                || warn "Релизов не найдено (или нет прав у токена)"
    else
      warn "GITHUB_TOKEN не задан — версия в реестре не проверяется"
    fi
  else
    warn "GitHub недоступен"
  fi

  # 3.4 — docker login в ghcr.io (нужен для приватного репо/пакета)
  if [[ ${#GH_AUTH[@]} -gt 0 && $REGISTRY_OK -eq 1 ]]; then
    log "Логин в ghcr.io..."
    if echo "$GITHUB_TOKEN" | docker login ghcr.io -u "${GITHUB_OWNER}" --password-stdin >/dev/null 2>&1; then
      ok "docker login ghcr.io OK (как ${GITHUB_OWNER})"
    else
      warn "docker login ghcr.io не удался — приватный pull будет недоступен"
    fi
  fi
fi

# Сводка
echo
echo "  ┌──────────────────────────────────────┐"
printf "  │ Интернет:           %-16s │\n" "$([[ $INTERNET_OK -eq 1 ]] && echo '✓ ONLINE' || echo '✗ OFFLINE')"
printf "  │ Cloud Supabase:     %-16s │\n" "$([[ $CLOUD_OK    -eq 1 ]] && echo '✓ ONLINE' || echo '✗ OFFLINE')"
printf "  │ GitHub Registry:    %-16s │\n" "$([[ $REGISTRY_OK -eq 1 ]] && echo '✓ ONLINE' || echo '✗ OFFLINE')"
echo "  └──────────────────────────────────────┘"
echo

# Полный offline — нужны уже скачанные образы
if [[ $INTERNET_OK -eq 0 ]]; then
  warn "Полностью OFFLINE. Допустимо только если Docker-образы уже скачаны ранее."
  if [[ $NONINTERACTIVE -eq 0 ]]; then
    read -r -p "  Продолжить установку без интернета? [y/N]: " yn
    [[ "${yn,,}" == "y" ]] || fail "Прерываю. Подключите интернет и запустите снова."
  fi
fi

# Режим только-проверка
if [[ $CHECK_UPDATE_ONLY -eq 1 ]]; then
  title "Результат проверки обновлений"
  echo "  Установлено:  ${CURRENT_VERSION}"
  echo "  Доступно:     ${LATEST_VERSION:-неизвестно}"
  if [[ -n "$LATEST_VERSION" && "$LATEST_VERSION" != "$CURRENT_VERSION" ]]; then
    echo; warn "Доступна новая версия! Для обновления:"
    echo "    sudo ./install.sh --upgrade-to ${LATEST_VERSION}"
  fi
  exit 0
fi

# CLI --upgrade-to
[[ -n "${CLI[UPGRADE_TO]:-}" ]] && { LATEST_VERSION="${CLI[UPGRADE_TO]}"; log "Принудительное обновление до ${LATEST_VERSION}"; }

# ────────── 4. Генерация секретов ──────────
title "4/8  Генерация криптографических ключей"

gen_secret() { openssl rand -base64 48 | tr -d '\n=+/' | cut -c1-64; }
update_env() {
  local key="$1" val="$2"
  if grep -qE "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}

[[ -z "${POSTGRES_PASSWORD:-}" ]] && { update_env POSTGRES_PASSWORD "$(gen_secret)"; ok "POSTGRES_PASSWORD сгенерирован"; }
[[ -z "${JWT_SECRET:-}" ]]        && { update_env JWT_SECRET        "$(gen_secret)"; ok "JWT_SECRET сгенерирован"; }
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

[[ -z "${ANON_KEY:-}" ]]         && { update_env ANON_KEY         "$(gen_jwt anon "$JWT_SECRET")";          ok "ANON_KEY (JWT) сгенерирован"; }
[[ -z "${SERVICE_ROLE_KEY:-}" ]] && { update_env SERVICE_ROLE_KEY "$(gen_jwt service_role "$JWT_SECRET")"; ok "SERVICE_ROLE_KEY (JWT) сгенерирован"; }
set -a; source .env; set +a

# ────────── 5. CA + серверный сертификат ──────────
title "5/8  TLS сертификаты"

mkdir -p certs
if [[ ! -f certs/ca.crt ]]; then
  log "Генерирую self-signed CA (10 лет)..."
  openssl genrsa -out certs/ca.key 4096 2>/dev/null
  openssl req -x509 -new -nodes -key certs/ca.key -sha256 -days 3650 \
    -out certs/ca.crt \
    -subj "/C=TZ/O=${CASINO_NAME}/CN=Casino System Local CA" 2>/dev/null
  ok "CA создан: certs/ca.crt"
fi

if [[ ! -f certs/server.crt ]] || ! openssl x509 -in certs/server.crt -noout -text 2>/dev/null | grep -q "DNS:${LOCAL_DOMAIN}"; then
  log "Генерирую серверный сертификат для ${LOCAL_DOMAIN} + IP ${LOCAL_IP}..."
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
  openssl x509 -req -in certs/server.csr \
    -CA certs/ca.crt -CAkey certs/ca.key -CAcreateserial \
    -out certs/server.crt -days 3650 -sha256 \
    -extensions v3_req -extfile certs/server.cnf 2>/dev/null
  rm -f certs/server.csr certs/server.cnf certs/ca.srl
  chmod 600 certs/*.key
  ok "Сертификат для ${LOCAL_DOMAIN} (включает IP ${LOCAL_IP})"
fi

# ────────── 6. /etc/hosts ──────────
if ! grep -qE "^[^#]*\s${LOCAL_DOMAIN}(\s|$)" /etc/hosts; then
  log "Добавляю в /etc/hosts: 127.0.0.1 ${LOCAL_DOMAIN}"
  echo "127.0.0.1  ${LOCAL_DOMAIN}" >> /etc/hosts
fi

# ────────── 7. Миграции ──────────
title "6/8  Миграции БД"
mkdir -p postgres/migrations postgres/init
if [[ -d ../supabase/migrations ]]; then
  cp ../supabase/migrations/*.sql postgres/migrations/ 2>/dev/null || true
  cp ../supabase/migrations/*.sql postgres/init/ 2>/dev/null || true
  COUNT=$(ls postgres/migrations/*.sql 2>/dev/null | wc -l)
  ok "Скопировано ${COUNT} миграций"
else
  warn "Каталог ../supabase/migrations не найден"
fi

# ────────── 6.5. Seed from Cloud (опционально, только при первой установке) ──────────
# Если локальная БД пуста — предлагаем перенести данные этого казино из Cloud.
# Маркер «уже сделано» — файл .seed-done в каталоге установки.
SEED_DONE_FILE="${SCRIPT_DIR}/.seed-done"
if [[ ! -f "$SEED_DONE_FILE" && $NONINTERACTIVE -eq 0 && $INTERNET_OK -eq 1 ]]; then
  title "6.5/8  Перенос данных из Cloud (первая установка)"
  echo "  Cloud-сервер уже содержит данные этого казино (config + транзакции)?"
  echo "  Скрипт может загрузить их сейчас в локальную БД (~30-90 МБ)."
  echo
  read -r -p "  Перенести данные из Cloud? [Y/n]: " seed_yn
  if [[ "${seed_yn,,}" != "n" ]]; then
    # Стартуем postgres заранее (миграции уже скопированы в init/, накатятся при первом старте)
    log "Запускаю postgres для импорта..."
    docker compose up -d postgres
    for i in $(seq 1 30); do
      docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" &>/dev/null && break
      sleep 2
      [[ $i -eq 30 ]] && fail "Postgres не стартовал — docker compose logs postgres"
    done
    ok "Postgres готов"

    read -r -p "  Cloud Supabase URL (например https://abc.supabase.co): " CLOUD_URL
    read -r -s -p "  Service-role key (вставьте и Enter): " CLOUD_KEY; echo
    DAYS_DEFAULT=90
    read -r -p "  Сколько дней операционных данных перенести? [${DAYS_DEFAULT}]: " DAYS_INPUT
    DAYS=${DAYS_INPUT:-$DAYS_DEFAULT}

    if [[ -z "$CLOUD_URL" || -z "$CLOUD_KEY" ]]; then
      warn "URL или ключ не указаны — пропускаю seed"
    else
      log "Запрашиваю поток NDJSON из ${CLOUD_URL} ..."
      # Стрим NDJSON прямо в node-импортёр внутри отдельного контейнера node:20.
      # Контейнер видит postgres по docker-сети compose (имя сервиса = postgres).
      set +e
      curl -fsSL --max-time 600 \
        "${CLOUD_URL%/}/functions/v1/cloud-seed-export?casino_id=${CASINO_ID}&days=${DAYS}" \
        -H "x-service-key: ${CLOUD_KEY}" \
      | docker run --rm -i \
          --network "$(docker compose ps --format json postgres 2>/dev/null | jq -r '.Networks // empty' | head -1 || echo casino-net)" \
          -v "${SCRIPT_DIR}/postgres/seed-import.js:/seed-import.js:ro" \
          -e PGHOST=postgres \
          -e PGUSER="${POSTGRES_USER:-postgres}" \
          -e PGPASSWORD="${POSTGRES_PASSWORD}" \
          -e PGDATABASE="${POSTGRES_DB:-postgres}" \
          node:20-alpine sh -c "npm i --silent --no-fund --no-audit pg >/dev/null && node /seed-import.js"
      SEED_RC=$?
      set -e
      if [[ $SEED_RC -eq 0 ]]; then
        touch "$SEED_DONE_FILE"
        ok "Данные перенесены, маркер ${SEED_DONE_FILE} установлен"
      else
        warn "Seed завершился с ошибкой (код $SEED_RC). Можно запустить повторно: sudo ./install.sh"
      fi
    fi
  else
    log "Пропускаю seed — БД останется пустой (или будет наполнена через cms-sync)"
  fi
fi

# ────────── 7. Решение по версии Docker-образа ──────────
title "7/8  Версия Docker-образа"

PREVIOUS_VERSION="$CURRENT_VERSION"
TARGET_VERSION="$CURRENT_VERSION"

if [[ -n "$LATEST_VERSION" && "$LATEST_VERSION" != "$CURRENT_VERSION" ]]; then
  warn "Установлено: ${CURRENT_VERSION}    Доступно: ${LATEST_VERSION}"
  if [[ $SKIP_UPDATE_CHECK -eq 1 ]]; then
    log "--skip-update-check — остаюсь на ${CURRENT_VERSION}"
  elif [[ -n "${CLI[UPGRADE_TO]:-}" ]]; then
    TARGET_VERSION="${CLI[UPGRADE_TO]}"
    log "Использую версию из --upgrade-to: ${TARGET_VERSION}"
  elif [[ $NONINTERACTIVE -eq 0 ]]; then
    read -r -p "  Обновиться до ${LATEST_VERSION}? [Y/n]: " yn
    [[ "${yn,,}" != "n" ]] && TARGET_VERSION="$LATEST_VERSION"
  else
    log "Non-interactive — остаюсь на ${CURRENT_VERSION} (передайте --upgrade-to для апгрейда)"
  fi
elif [[ -n "$LATEST_VERSION" ]]; then
  ok "Образ актуален: ${CURRENT_VERSION}"
else
  log "Реестр недоступен — использую локальную версию: ${CURRENT_VERSION}"
fi

if [[ "$TARGET_VERSION" != "$CURRENT_VERSION" ]]; then
  update_env FRONTEND_VERSION "$TARGET_VERSION"
  set -a; source .env; set +a
  CURRENT_VERSION="$TARGET_VERSION"
  ok "FRONTEND_VERSION обновлён → ${TARGET_VERSION}"
fi

# ────────── 8. Pull образов и запуск ──────────
title "8/8  Запуск Docker stack"

PULL_OK=1
if [[ $INTERNET_OK -eq 1 ]]; then
  log "Pulling images (target version: ${TARGET_VERSION})..."
  if ! docker compose pull 2>&1 | tail -10; then
    warn "Не все образы удалось скачать"
    PULL_OK=0
  fi
else
  log "Offline — pull пропущен, использую локально доступные образы"
  PULL_OK=0
fi

# Проверка: есть ли образ frontend в локальном кэше
FRONTEND_IMAGE="ghcr.io/${GITHUB_OWNER}/cms-frontend:${TARGET_VERSION}"
if ! docker image inspect "$FRONTEND_IMAGE" >/dev/null 2>&1; then
  if [[ "$PREVIOUS_VERSION" != "$TARGET_VERSION" ]] && \
     docker image inspect "ghcr.io/${GITHUB_OWNER}/cms-frontend:${PREVIOUS_VERSION}" >/dev/null 2>&1; then
    warn "Образ ${TARGET_VERSION} не скачан — откатываюсь на предыдущую версию ${PREVIOUS_VERSION}"
    update_env FRONTEND_VERSION "$PREVIOUS_VERSION"
    set -a; source .env; set +a
    TARGET_VERSION="$PREVIOUS_VERSION"
  elif [[ "$TARGET_VERSION" == "latest" ]]; then
    warn "Образ :latest не найден локально — продолжаю, docker compose попытается скачать сам"
  else
    fail "Образ ${FRONTEND_IMAGE} не найден ни в реестре, ни в локальном кэше. Подключите интернет или передайте --upgrade-to <известная-локально-версия>."
  fi
fi

log "Запуск контейнеров..."
docker compose up -d

log "Жду готовности Postgres (до 60 сек)..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" &>/dev/null; then
    ok "Postgres готов"
    break
  fi
  sleep 2
  [[ $i -eq 30 ]] && fail "Postgres не запустился за 60 сек — docker compose logs postgres"
done

# Health check фронта
log "Жду готовности frontend (до 30 сек)..."
for i in $(seq 1 15); do
  if docker compose exec -T cms-frontend curl -fsS http://localhost/ -o /dev/null 2>/dev/null; then
    ok "Frontend ${TARGET_VERSION} запущен"
    break
  fi
  sleep 2
  if [[ $i -eq 15 ]]; then
    warn "Frontend не отвечает за 30 сек"
    if [[ "$PREVIOUS_VERSION" != "$TARGET_VERSION" ]]; then
      warn "Откатываюсь на предыдущую версию ${PREVIOUS_VERSION}..."
      update_env FRONTEND_VERSION "$PREVIOUS_VERSION"
      set -a; source .env; set +a
      docker compose up -d cms-frontend
      ok "Откат выполнен"
    fi
  fi
done

# ────────── 10. systemd ──────────
SYSTEMD_UNIT=/etc/systemd/system/casino-system.service
if [[ ! -f "$SYSTEMD_UNIT" ]]; then
  log "Устанавливаю systemd unit..."
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
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable casino-system.service
  ok "systemd unit установлен"
fi

# ────────── финал ──────────
echo
hr
echo -e "${GREEN}${BOLD}  ✓ Установка завершена!${NC}"
hr
echo
echo -e "  📍 ${BOLD}${CASINO_NAME}${NC} (slug: ${CASINO_SLUG})"
echo -e "  🌐 URL:        ${BOLD}https://${LOCAL_DOMAIN}${NC}"
echo -e "  🖥️  IP:         ${LOCAL_IP}"
echo -e "  🔑 CA для устройств: ${SCRIPT_DIR}/certs/ca.crt"
echo
echo -e "  ${YELLOW}Следующие шаги:${NC}"
echo -e "    1. Скопируйте ${BOLD}certs/ca.crt${NC} на каждое устройство (Win/Android/iOS) и установите как Trusted Root"
echo -e "    2. Пропишите DNS:  ${LOCAL_IP}  ${LOCAL_DOMAIN}  на роутере или /etc/hosts клиентов"
echo -e "    3. Откройте https://${LOCAL_DOMAIN} в Chrome → ${BOLD}Установить приложение${NC}"
echo
echo -e "  📊 Статус:     ${CYAN}docker compose ps${NC}"
echo -e "  📜 Логи:       ${CYAN}docker compose logs -f${NC}"
echo -e "  🔄 Рестарт:    ${CYAN}systemctl restart casino-system${NC}"
echo -e "  ⚙️  Перенастр.: ${CYAN}sudo ./install.sh --reconfigure${NC}"
echo -e "  ⬆️  Обновл.:    ${CYAN}sudo ./install.sh --check-update${NC}"
echo
