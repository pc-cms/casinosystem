#!/usr/bin/env bash
#
# pair.sh — one-shot Cloud pairing + initial seed for an on-prem Casino System.
#
# Usage on the local server (as root):
#   curl -fsSL https://casinosystem.app/pair.sh | sudo bash
#
# Optional override:
#   curl -fsSL https://casinosystem.app/pair.sh | sudo CLOUD_URL=https://... bash
#
# What it does:
#   1. Validates /opt/casino-system install + cms-sync container running
#   2. Calls cms-sync pair-cli → registers on Cloud → prints PAIRING CODE
#   3. Waits up to 15 min while super_admin approves the code on Cloud
#   4. After approve → triggers initial seed (cloud-seed-export → local DB)
#   5. Prints final status
#
set -euo pipefail

# ── Self re-exec from a temp file with stdin=/dev/null ─────────────────────
# When invoked via `curl | sudo bash`, bash reads this script from a pipe AND
# any long-running child process (docker exec, polling loops) can stall or
# silently exit when the pipe is closed. Re-execute ourselves from a real
# file with stdin detached so no child can ever inherit the curl pipe.
if [ -z "${PAIR_SH_REEXEC:-}" ]; then
  export PAIR_SH_REEXEC=1
  TMP_SELF="$(mktemp /tmp/pair-XXXXXX.sh)"
  trap 'rm -f "$TMP_SELF"' EXIT
  if [ -n "${BASH_SOURCE[0]:-}" ] && [ -r "${BASH_SOURCE[0]}" ] && [ "${BASH_SOURCE[0]}" != "/dev/stdin" ]; then
    cp "${BASH_SOURCE[0]}" "$TMP_SELF"
  else
    # Piped from curl — re-download ourselves to a real file.
    REPAIR_URL="${PAIR_SH_URL:-https://casinosystem.app/pair.sh}"
    curl -fsSL "$REPAIR_URL" -o "$TMP_SELF" || {
      echo "[error] could not download pair.sh from $REPAIR_URL" >&2
      exit 1
    }
  fi
  chmod +x "$TMP_SELF"
  exec bash "$TMP_SELF" "$@" </dev/null
fi

CMS_DIR="/opt/casino-system"
ENV_FILE="${CMS_DIR}/deploy/.env"

RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'; CYN='\033[0;36m'; BLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${GRN}[pair]${NC} $*"; }
warn() { echo -e "${YLW}[warn]${NC} $*"; }
die()  { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }

set_env() {
  local key="$1" value="$2" escaped
  escaped="$(printf '%s' "$value" | sed "s/'/'\\''/g")"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}='${escaped}'|" "$ENV_FILE"
  else
    printf "\n%s='%s'\n" "$key" "$escaped" >> "$ENV_FILE"
  fi
}

[[ $EUID -eq 0 ]] || die "Run as root (use sudo)"
[[ -d "$CMS_DIR/deploy" ]] || die "$CMS_DIR not found — run install.sh first"
[[ -f "$ENV_FILE" ]] || die "$ENV_FILE missing"

cd "${CMS_DIR}/deploy"

# Resolve Cloud URL (override > .env > default). Strip both single and double quotes.
CLOUD_URL="${CLOUD_URL:-$(grep -E '^CLOUD_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"'' || true)}"
CLOUD_URL="${CLOUD_URL:-https://rpehngjvwcnipvkouluu.supabase.co}"
CLOUD_URL="${CLOUD_URL%/}"
POSTGRES_PASSWORD="$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e "s/^'//" -e "s/'$//" -e 's/^"//' -e 's/"$//' || true)"
log "Cloud:  ${CLOUD_URL}"

# Sanity: cms-sync must be up
if ! docker compose ps cms-sync 2>/dev/null | grep -q "Up\|running"; then
  warn "cms-sync container is not running — starting it"
  docker compose up -d cms-sync
  sleep 3
fi

# Make sure pair-cli.js exists in the container; if not — rebuild cms-sync from current sources
if ! docker compose exec -T cms-sync test -f /app/pair-cli.js </dev/null 2>/dev/null; then
  warn "pair-cli.js missing in cms-sync image — rebuilding cms-sync (1-2 min)..."
  docker compose build cms-sync </dev/null || die "cms-sync rebuild failed"
  docker compose up -d --force-recreate cms-sync </dev/null
  sleep 4
  docker compose exec -T cms-sync test -f /app/pair-cli.js </dev/null 2>/dev/null \
    || die "pair-cli.js still missing after rebuild. Run update.sh first:
       curl -fsSL https://casinosystem.app/update.sh | sudo bash"
fi

# Existing installs may have been created before peer-mesh tables existed.
# Apply the idempotent local repair before pairing, otherwise the server can be
# marked Active in Cloud while cms-sync has no local peer_links/node_identity.
REPAIR_FILE="${CMS_DIR}/deploy/postgres/repair-local-schema.sql"
if [[ -f "$REPAIR_FILE" ]]; then
  log "Checking local sync schema..."
  docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres \
    sh -c 'psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" -v ON_ERROR_STOP=1' \
    < "$REPAIR_FILE" >/dev/null \
    || die "local schema repair failed — check: docker compose logs --tail=80 postgres"
fi

# ─────────── 1. Start pairing ───────────
log "Registering on Cloud..."
START_OUT="$(docker compose exec -T cms-sync node /app/pair-cli.js start "$CLOUD_URL" </dev/null)" \
  || die "pair-cli start failed:
$START_OUT"

PAIRING_CODE="$(echo "$START_OUT" | grep -oE '"pairing_code":"[A-Z0-9]+"' | head -1 | cut -d'"' -f4 || true)"
EXPIRES_AT="$(echo "$START_OUT" | grep -oE '"expires_at":"[^"]+"' | head -1 | cut -d'"' -f4 || true)"
[[ -n "$PAIRING_CODE" ]] || die "Cloud did not return a pairing_code:
$START_OUT"

echo
echo -e "  ${BLD}═══════════════════════════════════════════════════${NC}"
echo -e "  ${BLD}  PAIRING CODE:  ${CYN}${PAIRING_CODE}${NC}"
echo -e "  ${BLD}═══════════════════════════════════════════════════${NC}"
echo
echo -e "  Expires at: ${EXPIRES_AT}"
echo -e "  → On Cloud: ${BLD}Admin → Network → Pending Servers${NC}"
echo -e "  → Approve the request matching this code"
echo

# ─────────── 2. Wait for approve ───────────
log "Waiting up to 15 min for super_admin approval (polling every 5s)..."
WAIT_OUT="$(docker compose exec -T cms-sync node /app/pair-cli.js wait 900 </dev/null)" || {
  RC=$?
  case "$RC" in
    3) die "Pairing was rejected or expired:
$WAIT_OUT" ;;
    4) die "Timeout — no approve within 15 min. Re-run pair.sh to retry." ;;
    *) die "pair-cli wait failed:
$WAIT_OUT" ;;
  esac
}

CASINO_ID="$(echo "$WAIT_OUT" | grep -oE '"casino_id":"[^"]+"' | head -1 | cut -d'"' -f4 || true)"
SYNC_SECRET="$(echo "$WAIT_OUT" | grep -oE '"sync_secret":"[^"]+"' | head -1 | cut -d'"' -f4 || true)"
if [[ -z "$SYNC_SECRET" ]]; then
  STATUS_OUT="$(docker compose exec -T cms-sync node /app/pair-cli.js status </dev/null || true)"
  SYNC_SECRET="$(echo "$STATUS_OUT" | grep -oE '"sync_secret":"[^"]+"' | head -1 | cut -d'"' -f4 || true)"
  [[ -n "$CASINO_ID" ]] || CASINO_ID="$(echo "$STATUS_OUT" | grep -oE '"casino_id":"[^"]+"' | head -1 | cut -d'"' -f4 || true)"
fi
[[ -n "$CASINO_ID" && -n "$SYNC_SECRET" ]] || die "Cloud approved pairing but local credentials are incomplete:
$WAIT_OUT"
log "Approved! casino_id=${CASINO_ID}"

if [[ -n "${CASINO_ID}" && -n "${SYNC_SECRET}" ]]; then
  log "Saving Cloud credentials into local .env..."
  set_env CLOUD_URL "$CLOUD_URL"
  set_env CASINO_ID "$CASINO_ID"
  set_env SYNC_SECRET "$SYNC_SECRET"
fi

# ─────────── 3. Trigger initial seed ───────────
log "Streaming initial data seed from Cloud into local DB..."
SYNC_OUT="$(docker compose exec -T cms-sync node /app/pair-cli.js sync </dev/null)" \
  || die "initial seed failed:
$SYNC_OUT"
log "Seed complete."
echo "  $SYNC_OUT"

log "Activating peer-mesh sync channel..."
MESH_OUT="$(docker compose exec -T cms-sync node /app/pair-cli.js mesh </dev/null || true)"
if echo "$MESH_OUT" | grep -q '"ok":true'; then
  log "Peer-mesh handshake OK."
else
  warn "Peer-mesh handshake not ready yet:"
  echo "  $MESH_OUT"
fi

if [[ -n "${CASINO_ID}" && -n "${SYNC_SECRET}" ]]; then
  log "Restarting local services with saved credentials..."
  docker compose up -d --force-recreate cms-frontend cms-monitor cms-backup </dev/null >/dev/null 2>&1 || \
    warn "Service restart skipped; run: sudo docker compose up -d --force-recreate cms-frontend cms-monitor cms-backup"
fi

# ─────────── 4. Verify sync channel actually works ───────────
log "Pinging Cloud through cms-sync..."
sleep 2
PING_OUT="$(docker compose exec -T cms-sync node /app/pair-cli.js ping </dev/null || true)"
if echo "$PING_OUT" | grep -q '"ok":true'; then
  log "${GRN}✓ Sync channel OK — server is now ONLINE in Cloud admin.${NC}"
else
  warn "Sync channel not yet healthy:"
  echo "  $PING_OUT"
  warn "Pairing succeeded but cms-sync can't reach Cloud yet."
  warn "Check: docker compose logs --tail=80 cms-sync"
fi

echo
log "${GRN}✓ Pairing complete.${NC}"
echo -e "  Watch progress: ${CYN}docker compose logs -f cms-sync${NC}"
echo -e "  Open admin:     ${CYN}https://$(hostname -I | awk '{print $1}')/admin${NC}"
echo -e "  The header will show a ${YLW}LOCAL${NC} badge once the frontend reloads."
echo
