#!/usr/bin/env bash
#
# e2e-test.sh — автотест полного развёртывания Casino System on-prem
# ────────────────────────────────────────────────────────────────────
# Запускает install.sh внутри Ubuntu 22.04 контейнера с docker-in-docker
# и проверяет что все 13 сервисов поднялись и health-эндпоинты отвечают.
#
# Требования на хосте:
#   - docker >= 24
#   - ~6 GB свободной памяти, ~10 GB диска
#
# Запуск:
#   ./deploy/e2e-test.sh
#
# Длительность: ~10–15 минут (билд образов + первый старт стека).
#
set -euo pipefail

CYAN='\033[0;36m'; GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
say()  { echo -e "${CYAN}[e2e]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC}  $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER=cms-e2e-runner

cleanup() {
  say "cleanup runner container..."
  docker rm -f $CONTAINER >/dev/null 2>&1 || true
}
trap cleanup EXIT

say "1/6 launching dind runner (Ubuntu 22.04 + docker)..."
docker rm -f $CONTAINER >/dev/null 2>&1 || true
docker run -d --privileged \
  --name $CONTAINER \
  -v "$REPO_ROOT":/src:ro \
  -e CASINO_SLUG=e2etest \
  -e CASINO_NAME="E2E Test Casino" \
  -e LOCAL_DOMAIN=e2e.local \
  ubuntu:22.04 \
  sleep infinity >/dev/null

docker exec $CONTAINER bash -c '
  set -e
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    curl ca-certificates gnupg lsb-release iproute2 jq >/dev/null
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    docker-ce docker-ce-cli containerd.io docker-compose-plugin >/dev/null
  dockerd > /var/log/dockerd.log 2>&1 &
  for i in $(seq 1 30); do docker info >/dev/null 2>&1 && break || sleep 2; done
  docker info >/dev/null
' || fail "dind bootstrap failed"
ok "dind ready"

say "2/6 copy /src → /opt/cms (writable)..."
docker exec $CONTAINER bash -c "cp -r /src /opt/cms && cd /opt/cms/deploy && ls"
ok "code copied"

say "3/6 run install.sh in non-interactive mode..."
docker exec -e CI=1 -e NONINTERACTIVE=1 $CONTAINER bash -c '
  cd /opt/cms/deploy
  # Если install.sh умеет --no-tui — использовать. Иначе — заранее сгенерить .env.
  if grep -q "NONINTERACTIVE" install.sh; then
    bash install.sh --no-tui
  else
    cp env.template .env
    sed -i "s/^CASINO_SLUG=.*/CASINO_SLUG=e2etest/" .env
    sed -i "s/^CASINO_NAME=.*/CASINO_NAME=E2E Test Casino/" .env
    sed -i "s/^LOCAL_DOMAIN=.*/LOCAL_DOMAIN=e2e.local/" .env
    sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 16)/" .env
    sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
    docker compose --env-file .env up -d
  fi
' || fail "install.sh failed"
ok "stack started"

say "4/6 wait for services to become healthy (max 180 s)..."
docker exec $CONTAINER bash -c '
  cd /opt/cms/deploy
  for i in $(seq 1 90); do
    UNHEALTHY=$(docker compose ps --format json 2>/dev/null | jq -r ". | select(.Health==\"unhealthy\" or .State!=\"running\") | .Name" | wc -l)
    TOTAL=$(docker compose ps --format json 2>/dev/null | jq -r ".Name" | wc -l)
    echo "  tick $i: total=$TOTAL not-ready=$UNHEALTHY"
    [ "$UNHEALTHY" = "0" ] && [ "$TOTAL" -ge "10" ] && exit 0
    sleep 2
  done
  docker compose ps
  exit 1
' || fail "services did not become healthy"
ok "all services running"

say "5/6 verify expected services exist..."
EXPECTED="postgres postgrest gotrue realtime storage imgproxy cms-frontend nginx cms-sync cms-updater cms-monitor cms-vpn cms-backup"
for svc in $EXPECTED; do
  docker exec $CONTAINER docker ps --format '{{.Names}}' | grep -q "^${svc}$" \
    && ok "service ${svc} running" \
    || fail "service ${svc} MISSING"
done

say "6/6 smoke-test endpoints..."
docker exec $CONTAINER bash -c '
  set -e
  curl -fsk https://localhost/healthz || curl -fs http://localhost/healthz
  curl -fs http://localhost:8088/admin/health
' && ok "health endpoints respond" || fail "health endpoints DOWN"

ok "e2e PASSED — все 13 сервисов запущены и отвечают"
