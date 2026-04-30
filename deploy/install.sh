#!/usr/bin/env bash
#
# Casino System — On-Premises installer
# -------------------------------------
# Запуск:   sudo ./install.sh
#
# Что делает:
#   1. Проверяет Ubuntu 22.04+ и наличие Docker
#   2. Генерирует криптографические ключи (JWT, ANON, SERVICE_ROLE, POSTGRES_PASSWORD)
#   3. Генерирует self-signed CA + серверный сертификат для ${LOCAL_DOMAIN}
#   4. Прописывает запись в /etc/hosts
#   5. Применяет миграции БД из supabase/migrations
#   6. Поднимает docker compose stack
#   7. Устанавливает systemd unit для автозапуска
#
# Требования:
#   - Ubuntu Desktop 22.04+ (или Server)
#   - 4 GB RAM, 50 GB SSD минимум
#   - root / sudo доступ

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ────────── вспомогательные функции ──────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()    { echo -e "${BLUE}[install]${NC} $*"; }
ok()     { echo -e "${GREEN}[ ok ]${NC} $*"; }
warn()   { echo -e "${YELLOW}[warn]${NC} $*"; }
fail()   { echo -e "${RED}[fail]${NC} $*" >&2; exit 1; }

require_root() {
  [[ $EUID -eq 0 ]] || fail "Запустите от root: sudo ./install.sh"
}

# ────────── 0. Проверки ──────────
require_root
log "Проверка системы..."

if ! command -v lsb_release &>/dev/null; then
  apt-get update -qq && apt-get install -y -qq lsb-release
fi

UBUNTU_VER=$(lsb_release -rs)
log "Ubuntu версия: $UBUNTU_VER"
[[ "${UBUNTU_VER%%.*}" -ge 22 ]] || warn "Рекомендуется Ubuntu 22.04+, у вас $UBUNTU_VER"

# Docker
if ! command -v docker &>/dev/null; then
  log "Устанавливаю Docker..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg openssl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    | tee /etc/apt/sources.list.d/docker.list >/dev/null
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  ok "Docker установлен"
else
  ok "Docker уже установлен: $(docker --version)"
fi

# ────────── 1. .env ──────────
if [[ ! -f .env ]]; then
  log "Создаю .env из env.template — отредактируйте CASINO_ID, CASINO_SLUG, LOCAL_DOMAIN перед продолжением"
  cp env.template .env
  warn "Откройте .env, заполните CASINO_ID и LOCAL_DOMAIN, затем запустите install.sh снова"
  exit 0
fi

# Загрузка переменных
set -a; source .env; set +a

[[ -n "${LOCAL_DOMAIN:-}" ]] || fail ".env: LOCAL_DOMAIN не задан (например arusha.local)"
[[ -n "${CASINO_ID:-}" ]] && [[ "$CASINO_ID" != "00000000-0000-0000-0000-000000000000" ]] \
  || fail ".env: CASINO_ID не задан (получите у Premier admin)"

# ────────── 2. Генерация секретов ──────────
gen_secret() { openssl rand -base64 48 | tr -d '\n=+/' | cut -c1-64; }

ENV_CHANGED=0
update_env() {
  local key="$1" val="$2"
  if grep -qE "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
  ENV_CHANGED=1
}

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  log "Генерирую POSTGRES_PASSWORD..."
  update_env POSTGRES_PASSWORD "$(gen_secret)"
fi
if [[ -z "${JWT_SECRET:-}" ]]; then
  log "Генерирую JWT_SECRET..."
  update_env JWT_SECRET "$(gen_secret)"
fi

# Подгрузить заново если меняли
if [[ $ENV_CHANGED -eq 1 ]]; then
  set -a; source .env; set +a
fi

# ANON и SERVICE_ROLE — JWT-токены, подписанные JWT_SECRET
gen_jwt() {
  local role="$1" secret="$2"
  local header='{"alg":"HS256","typ":"JWT"}'
  local payload="{\"iss\":\"casino-local\",\"role\":\"${role}\",\"iat\":$(date +%s),\"exp\":$(date -d '+10 years' +%s)}"
  local b64() { openssl base64 -A | tr -d '=' | tr '/+' '_-'; }
  local h=$(printf '%s' "$header"  | openssl base64 -A | tr -d '=' | tr '/+' '_-')
  local p=$(printf '%s' "$payload" | openssl base64 -A | tr -d '=' | tr '/+' '_-')
  local sig=$(printf '%s.%s' "$h" "$p" | openssl dgst -sha256 -hmac "$secret" -binary | openssl base64 -A | tr -d '=' | tr '/+' '_-')
  echo "${h}.${p}.${sig}"
}

if [[ -z "${ANON_KEY:-}" ]]; then
  log "Генерирую ANON_KEY (JWT)..."
  update_env ANON_KEY "$(gen_jwt anon "$JWT_SECRET")"
fi
if [[ -z "${SERVICE_ROLE_KEY:-}" ]]; then
  log "Генерирую SERVICE_ROLE_KEY (JWT)..."
  update_env SERVICE_ROLE_KEY "$(gen_jwt service_role "$JWT_SECRET")"
fi

set -a; source .env; set +a
ok "Секреты готовы"

# ────────── 3. Self-signed CA + серверный сертификат ──────────
mkdir -p certs
if [[ ! -f certs/ca.crt ]]; then
  log "Генерирую self-signed CA (срок 10 лет)..."
  openssl genrsa -out certs/ca.key 4096 2>/dev/null
  openssl req -x509 -new -nodes -key certs/ca.key -sha256 -days 3650 \
    -out certs/ca.crt \
    -subj "/C=TZ/O=Casino System/CN=Casino System Local CA" 2>/dev/null
  ok "CA создан: certs/ca.crt"
  warn "Скопируйте certs/ca.crt на каждое устройство (Windows/Android/iOS) и установите в Trusted Root"
fi

if [[ ! -f certs/server.crt ]] || ! openssl x509 -in certs/server.crt -noout -subject 2>/dev/null | grep -q "${LOCAL_DOMAIN}"; then
  log "Генерирую серверный сертификат для ${LOCAL_DOMAIN}..."
  openssl genrsa -out certs/server.key 2048 2>/dev/null

  cat > certs/server.cnf <<EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no
[req_distinguished_name]
C  = TZ
O  = Casino System
CN = ${LOCAL_DOMAIN}
[v3_req]
keyUsage = keyEncipherment, dataEncipherment, digitalSignature
extendedKeyUsage = serverAuth
subjectAltName = @alt_names
[alt_names]
DNS.1 = ${LOCAL_DOMAIN}
DNS.2 = *.${LOCAL_DOMAIN}
DNS.3 = localhost
IP.1 = 127.0.0.1
EOF

  openssl req -new -key certs/server.key -out certs/server.csr -config certs/server.cnf 2>/dev/null
  openssl x509 -req -in certs/server.csr \
    -CA certs/ca.crt -CAkey certs/ca.key -CAcreateserial \
    -out certs/server.crt -days 3650 -sha256 \
    -extensions v3_req -extfile certs/server.cnf 2>/dev/null
  rm -f certs/server.csr certs/server.cnf certs/ca.srl
  chmod 600 certs/*.key
  ok "Серверный сертификат создан: certs/server.crt"
fi

# ────────── 4. /etc/hosts ──────────
if ! grep -q " ${LOCAL_DOMAIN}" /etc/hosts; then
  log "Добавляю запись в /etc/hosts: 127.0.0.1 ${LOCAL_DOMAIN}"
  echo "127.0.0.1  ${LOCAL_DOMAIN}" >> /etc/hosts
fi

# ────────── 5. Миграции БД (копируем supabase/migrations) ──────────
mkdir -p postgres/migrations postgres/init
if [[ -d ../supabase/migrations ]]; then
  log "Копирую supabase/migrations → postgres/migrations"
  cp ../supabase/migrations/*.sql postgres/migrations/ 2>/dev/null || true
  # Все миграции применяются как часть init при первом запуске Postgres
  cp ../supabase/migrations/*.sql postgres/init/ 2>/dev/null || true
  ok "Скопировано $(ls postgres/migrations/*.sql 2>/dev/null | wc -l) миграций"
else
  warn "Каталог ../supabase/migrations не найден — БД будет пустой"
fi

# ────────── 6. Поднимаем стек ──────────
log "Запускаю docker compose stack..."
docker compose pull --quiet 2>/dev/null || true
docker compose up -d

log "Жду готовности Postgres..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" &>/dev/null; then
    ok "Postgres готов"
    break
  fi
  sleep 2
done

# ────────── 7. systemd unit ──────────
SYSTEMD_UNIT=/etc/systemd/system/casino-system.service
if [[ ! -f "$SYSTEMD_UNIT" ]]; then
  log "Устанавливаю systemd сервис для автозапуска..."
  cat > "$SYSTEMD_UNIT" <<EOF
[Unit]
Description=Casino System (Docker Compose)
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
  ok "systemd unit установлен и включён"
fi

# ────────── финал ──────────
echo ""
ok "═══════════════════════════════════════════════════════════"
ok "  Установка завершена!"
ok "═══════════════════════════════════════════════════════════"
echo ""
echo "  🌐 Откройте: ${BLUE}https://${LOCAL_DOMAIN}${NC}"
echo "  🔑 Сначала установите CA на устройства:"
echo "     ${SCRIPT_DIR}/certs/ca.crt"
echo ""
echo "  📊 Статус:    docker compose ps"
echo "  📜 Логи:      docker compose logs -f"
echo "  🔄 Рестарт:   systemctl restart casino-system"
echo ""
warn "Следующие этапы (B/C/D) реализуются отдельными prompt'ами:"
echo "  B — фронт билд + локальная PWA"
echo "  C — реальный sync с Cloud (cms-sync)"
echo "  D — авто-обновления через GitHub Releases (cms-updater)"
