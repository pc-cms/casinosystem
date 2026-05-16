#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Casino System — one-shot hotfix for on-prem frontend
# ──────────────────────────────────────────────────────────────────────────────
# Problem this fixes (≤ v1.3.18):
#   Old cms-frontend image was built without VITE_SUPABASE_URL build-arg, so
#   the bundled supabase client points at Cloud Supabase regardless of the
#   runtime-config.json patching. Local UI silently reads/writes Cloud DB.
#
# What this script does (idempotent, ~5 min):
#   1. Pulls the latest deploy/ sources from GitHub into /opt/cms.
#   2. Removes the bad cms-frontend image.
#   3. Rebuilds cms-frontend with --no-cache, baking https://<LOCAL_DOMAIN>/api
#      into the bundle via the new Dockerfile build-args.
#   4. Restarts cms-frontend + nginx.
#   5. Prints a verification URL.
#
# Usage (single line, no flags needed):
#   curl -fsSL https://raw.githubusercontent.com/SimonMacRobert/Casino_app/main/deploy/hotfix-frontend.sh | sudo bash
#
# Safe to re-run. Does NOT touch the database, .env, certs, or peer config.
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${YELLOW}[hotfix]${NC} $*"; }
ok()   { echo -e "${GREEN}[ ok ]${NC}  $*"; }
die()  { echo -e "${RED}[fail]${NC}  $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run with sudo."

CMS_ROOT="${CMS_ROOT:-/opt/cms}"
[[ -d "$CMS_ROOT/deploy" ]] || die "Casino System install not found at $CMS_ROOT (set CMS_ROOT=...)."

cd "$CMS_ROOT"

# 1. Pull latest sources (deploy/Dockerfile.frontend + docker-compose.yml fix)
log "Pulling latest sources from GitHub..."
if [[ -d .git ]]; then
  git fetch --all --tags --quiet
  git reset --hard origin/main --quiet || die "git reset failed"
else
  die "$CMS_ROOT is not a git checkout — cannot auto-update sources."
fi
ok "Sources updated to $(git rev-parse --short HEAD)"

# 2. Sanity-check the fix is present
grep -q "VITE_SUPABASE_URL" deploy/Dockerfile.frontend \
  || die "Dockerfile.frontend does not contain the fix — repo is outdated."
grep -q "VITE_SUPABASE_URL: https://" deploy/docker-compose.yml \
  || die "docker-compose.yml does not contain the fix — repo is outdated."

# 3. Show what URL will be baked in
LOCAL_DOMAIN=$(grep -E '^LOCAL_DOMAIN=' deploy/.env | cut -d= -f2- | tr -d '"' | head -1)
[[ -n "$LOCAL_DOMAIN" ]] || die "LOCAL_DOMAIN missing from deploy/.env"
log "Will bake Supabase URL: ${BOLD}https://${LOCAL_DOMAIN}/api${NC}"

# 4. Remove old image so rebuild is guaranteed fresh
log "Removing old cms-frontend image..."
docker image rm -f cms-frontend:local 2>/dev/null || true
docker image ls --format '{{.Repository}}:{{.Tag}}' | grep '^cms-frontend:' \
  | xargs -r docker image rm -f 2>/dev/null || true

# 5. Rebuild
cd deploy
log "Rebuilding cms-frontend (3–7 min, no cache)..."
docker compose build --no-cache cms-frontend || die "Build failed — check logs above."
ok "Frontend rebuilt"

# 6. Restart frontend + nginx
log "Restarting cms-frontend and nginx..."
docker compose up -d --force-recreate cms-frontend nginx
sleep 5

# 7. Verify
log "Waiting for frontend to come up..."
for i in $(seq 1 15); do
  docker compose exec -T cms-frontend curl -fsS http://localhost/ -o /dev/null 2>/dev/null \
    && { ok "Frontend healthy"; break; }
  sleep 2
done

echo
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}✓ Hotfix applied${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo
echo -e "  Open ${BOLD}https://${LOCAL_DOMAIN}${NC} → F12 → Network → filter ${BOLD}rest/v1${NC}"
echo -e "  Requests must go to ${GREEN}https://${LOCAL_DOMAIN}/api/rest/v1/...${NC}"
echo -e "  ${RED}NOT${NC} to ${RED}rpehngjvwcnipvkouluu.supabase.co${NC}"
echo
echo -e "  After verifying, ${BOLD}delete both peer_links rows${NC} on Cloud (Premier)"
echo -e "  and on Local, then re-add the pair from the LOCAL side first."
echo
