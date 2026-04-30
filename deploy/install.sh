#!/usr/bin/env bash
#
# Casino System — On-Premises Interactive Installer
# --------------------------------------------------
# Универсальный установщик для любой локации (Arusha / Dodoma / Mbeya / ...).
#
# Режимы запуска:
#   sudo ./install.sh                           # интерактивный мастер
#   sudo ./install.sh --reconfigure             # перенастроить .env, перезапустить
#   sudo ./install.sh --check-update            # проверить наличие нового образа
#   sudo ./install.sh --slug arusha \           # CLI-режим (для автоматизации)
#                     --name "Premier Arusha" \
#                     --domain arusha.local \
#                     --ip 192.168.1.100 \
#                     --casino-id <UUID> \
#                     --sync-secret <secret>
#
# Что делает мастер:
#   1. Проверяет Ubuntu 22.04+ и устанавливает Docker если нужно
#   2. Спрашивает: название локации, slug, локальный IP, домен, CASINO_ID, sync_secret
#   3. Проверяет связь с Cloud и валидирует CASINO_ID (есть ли такая запись в casinos)
#   4. Генерирует JWT/CA/server cert
#   5. Применяет миграции БД
#   6. Поднимает docker compose stack
#   7. Проверяет, есть ли свежая версия образа на GitHub (если нет — пишет какая)
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

# ────────── 3. Проверка связи с Cloud + валидация CASINO_ID ──────────
title "3/8  Проверка связи с Cloud"

CLOUD_URL="${CLOUD_URL:-https://rpehngjvwcnipvkouluu.supabase.co}"
log "Cloud: $CLOUD_URL"
log "Проверяю доступ к интернету..."

if ! curl -fsS --max-time 10 -o /dev/null "$CLOUD_URL/rest/v1/?apikey=${CLOUD_ANON_KEY}"; then
  warn "Нет связи с Cloud — установка продолжится в OFFLINE-режиме"
  warn "Sync с Cloud не заработает, пока вы не подключите интернет"
  read -r -p "  Продолжить без проверки CASINO_ID? [y/N]: " yn
  [[ "${yn,,}" == "y" ]] || fail "Прерываю. Подключите интернет и запустите снова."
  CLOUD_REACHABLE=0
else
  ok "Cloud доступен"
  CLOUD_REACHABLE=1

  log "Проверяю CASINO_ID=${CASINO_ID} в реестре..."
  RESPONSE=$(curl -fsS --max-time 10 \
    -H "apikey: ${CLOUD_ANON_KEY}" \
    -H "Authorization: Bearer ${CLOUD_ANON_KEY}" \
    "${CLOUD_URL}/rest/v1/casinos?id=eq.${CASINO_ID}&select=id,name,slug" || echo "[]")

  if [[ "$RESPONSE" == "[]" || -z "$RESPONSE" ]]; then
    warn "CASINO_ID не найден в Cloud (или нет доступа к таблице casinos через anon)."
    warn "Это может быть нормально, если RLS закрывает таблицу — sync проверит позже."
  else
    REMOTE_NAME=$(echo "$RESPONSE" | jq -r '.[0].name // "unknown"')
    REMOTE_SLUG=$(echo "$RESPONSE" | jq -r '.[0].slug // "unknown"')
    ok "Локация найдена в Cloud: ${REMOTE_NAME} (${REMOTE_SLUG})"
    if [[ "$REMOTE_SLUG" != "$CASINO_SLUG" ]]; then
      warn "Slug в Cloud (${REMOTE_SLUG}) не совпадает с локальным (${CASINO_SLUG})"
    fi
  fi
fi

if [[ $CHECK_UPDATE_ONLY -eq 1 ]]; then
  title "Проверка обновлений"
  if [[ -n "${GITHUB_TOKEN:-}" && "$GITHUB_TOKEN" != "ghp_replace_me" ]]; then
    LATEST=$(curl -fsS -H "Authorization: Bearer $GITHUB_TOKEN" \
      "https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO:-casino-system}/releases/latest" \
      | jq -r '.tag_name // "none"')
    log "Установленная версия: ${FRONTEND_VERSION:-latest}"
    log "Доступная версия:     ${LATEST}"
  else
    warn "GITHUB_TOKEN не задан — пропускаю проверку обновлений"
  fi
  exit 0
fi

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

# ────────── 8. Проверка обновлений Docker-образа ──────────
title "7/8  Проверка обновлений образа"

CURRENT_VERSION="${FRONTEND_VERSION:-latest}"
LATEST_VERSION=""
if [[ $CLOUD_REACHABLE -eq 1 && -n "${GITHUB_TOKEN:-}" && "$GITHUB_TOKEN" != "ghp_replace_me" ]]; then
  LATEST_VERSION=$(curl -fsS --max-time 10 \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    "https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO:-casino-system}/releases/latest" 2>/dev/null \
    | jq -r '.tag_name // ""' 2>/dev/null || echo "")
  if [[ -n "$LATEST_VERSION" && "$LATEST_VERSION" != "$CURRENT_VERSION" && "$CURRENT_VERSION" != "latest" ]]; then
    warn "Доступна новая версия: ${LATEST_VERSION} (у вас: ${CURRENT_VERSION})"
    if [[ $NONINTERACTIVE -eq 0 ]]; then
      read -r -p "  Установить ${LATEST_VERSION}? [Y/n]: " yn
      if [[ "${yn,,}" != "n" ]]; then
        update_env FRONTEND_VERSION "$LATEST_VERSION"
        set -a; source .env; set +a
      fi
    fi
  elif [[ -n "$LATEST_VERSION" ]]; then
    ok "Версия актуальна: ${LATEST_VERSION}"
  fi
else
  log "Проверка обновлений пропущена (offline или нет GITHUB_TOKEN)"
fi

# ────────── 9. Запуск стека ──────────
title "8/8  Запуск Docker stack"

log "Pulling images..."
docker compose pull --quiet 2>&1 | tail -5 || warn "Часть образов не удалось скачать (offline?)"

log "Запуск контейнеров..."
docker compose up -d

log "Жду готовности Postgres..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" &>/dev/null; then
    ok "Postgres готов"
    break
  fi
  sleep 2
  [[ $i -eq 30 ]] && fail "Postgres не запустился за 60 сек — смотрите docker compose logs postgres"
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
