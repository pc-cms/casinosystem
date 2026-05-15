#!/usr/bin/env bash
#
# Casino System — One-line bootstrap installer
# ----------------------------------------------
# Usage:
#   curl -fsSL https://casinosystem.app/install | sudo bash
#   curl -fsSL https://casinosystem.app/install | sudo bash -s -- --reset
#   curl -fsSL https://casinosystem.app/install | sudo bash -s -- --rebuild
#   curl -fsSL https://casinosystem.app/install | sudo bash -s -- --reconfigure
#
# Что делает:
#   1. Качает свежий tarball репозитория pms-cms/casinosystem (ветка main) с GitHub.
#   2. Бэкапит существующий /opt/casino-system → /opt/casino-system.bak.<timestamp>
#   3. Распаковывает в /opt/casino-system.
#   4. Запускает deploy/install.sh с теми же аргументами, что переданы в bash.
#
set -euo pipefail

BOOTSTRAP_VERSION="1.0.0"
REPO="pms-cms/casinosystem"
BRANCH="${CASINO_BRANCH:-main}"
TARGET="/opt/casino-system"
TARBALL_URL="https://codeload.github.com/${REPO}/tar.gz/refs/heads/${BRANCH}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${CYAN}[bootstrap]${NC} $*"; }
ok()   { echo -e "${GREEN}[ ok ]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
fail() { echo -e "${RED}[fail]${NC} $*" >&2; exit 1; }

echo -e "${CYAN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Casino System Bootstrap  v${BOOTSTRAP_VERSION}                ║${NC}"
echo -e "${CYAN}║  repo: ${REPO}@${BRANCH}             ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════╝${NC}"

[[ $EUID -eq 0 ]] || fail "Запустите от root: curl -fsSL https://casinosystem.app/install | sudo bash"

command -v curl >/dev/null 2>&1 || { log "Устанавливаю curl..."; apt-get update -qq && apt-get install -y -qq curl; }
command -v tar  >/dev/null 2>&1 || { log "Устанавливаю tar...";  apt-get update -qq && apt-get install -y -qq tar; }

TMP="$(mktemp -d /tmp/casino-bootstrap.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

log "Скачиваю свежий код: ${TARBALL_URL}"
HTTP=$(curl -fsSL --retry 3 --retry-delay 2 -w "%{http_code}" -o "$TMP/src.tar.gz" "$TARBALL_URL" || echo "000")
[[ "$HTTP" == "200" ]] || fail "Не удалось скачать tarball (HTTP=$HTTP). Проверь интернет / доступ к GitHub."
SIZE=$(stat -c%s "$TMP/src.tar.gz" 2>/dev/null || stat -f%z "$TMP/src.tar.gz")
[[ "$SIZE" -gt 100000 ]] || fail "Скачанный архив подозрительно мал ($SIZE байт)."
ok "Архив скачан: $((SIZE/1024)) KB"

log "Распаковываю..."
tar -xzf "$TMP/src.tar.gz" -C "$TMP"
SRC_DIR=$(find "$TMP" -maxdepth 1 -type d -name "casinosystem-*" | head -n1)
[[ -d "$SRC_DIR" ]] || fail "Не найдена распакованная папка"
[[ -f "$SRC_DIR/deploy/install.sh" ]] || fail "В архиве нет deploy/install.sh"

if [[ -d "$TARGET" ]]; then
  BAK="${TARGET}.bak.$(date +%Y%m%d-%H%M%S)"
  log "Бэкаплю существующую папку → $BAK"
  # Сохраняем только важное (.env, runtime-config), сам код заменим
  if [[ -f "$TARGET/.env" ]]; then cp -f "$TARGET/.env" "$TMP/.env.preserve"; fi
  if [[ -d "$TARGET/data" ]]; then mv "$TARGET/data" "$TMP/data.preserve"; fi
  mv "$TARGET" "$BAK"
  ok "Старая версия → $BAK"
fi

log "Устанавливаю в $TARGET"
mkdir -p "$(dirname "$TARGET")"
mv "$SRC_DIR" "$TARGET"

# Восстанавливаем сохранённое
if [[ -f "$TMP/.env.preserve" ]]; then
  cp -f "$TMP/.env.preserve" "$TARGET/.env"
  ok "Восстановлен .env"
fi
if [[ -d "$TMP/data.preserve" ]]; then
  mv "$TMP/data.preserve" "$TARGET/data"
  ok "Восстановлена папка data/"
fi

chmod +x "$TARGET/deploy/install.sh" 2>/dev/null || true

ok "Код установлен. Запускаю инсталлер..."
echo
exec bash "$TARGET/deploy/install.sh" "$@"
