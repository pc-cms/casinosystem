#!/usr/bin/env bash
#
# cms-installer.sh — Universal Casino Management System installer.
#
# One entry point for everything:
#   curl -fsSL https://casinosystem.app/cms | sudo bash
#
# Modes (interactive menu):
#   1) Install              — set up a new server (Cloud-connected or Standalone)
#   2) Update               — upgrade code/containers, keep database
#   3) Wipe & Reinstall     — destroy DB + start over (requires typing WIPE)
#   4) Status / Diagnostics — version, sync, peers, container logs
#
# No flags. No env switches. The menu is the only way to choose an action.
# Casino selection comes from the Cloud at install time — never typed manually
# in Cloud-connected mode.
#
set -euo pipefail

# ── Self re-exec from a real file with stdin=/dev/null ─────────────────────
# Required because the menu is interactive but `curl | bash` ties stdin to
# the curl pipe. We re-download ourselves to /tmp and exec with /dev/tty.
if [ -z "${CMS_INSTALLER_REEXEC:-}" ]; then
  export CMS_INSTALLER_REEXEC=1
  TMP_SELF="$(mktemp /tmp/cms-installer-XXXXXX.sh)"
  trap 'rm -f "$TMP_SELF"' EXIT
  SELF_URL="${CMS_INSTALLER_URL:-https://casinosystem.app/cms}"
  if [ -n "${BASH_SOURCE[0]:-}" ] && [ -r "${BASH_SOURCE[0]}" ] && [ "${BASH_SOURCE[0]}" != "/dev/stdin" ] && [ "${BASH_SOURCE[0]}" != "bash" ]; then
    cp "${BASH_SOURCE[0]}" "$TMP_SELF"
  else
    curl -fsSL "$SELF_URL" -o "$TMP_SELF" || {
      echo "[error] cannot download installer from $SELF_URL" >&2
      exit 1
    }
  fi
  chmod +x "$TMP_SELF"
  # Reattach stdin to the terminal so menu prompts work after `curl | bash`.
  if [ -e /dev/tty ]; then
    exec bash "$TMP_SELF" "$@" </dev/tty
  else
    exec bash "$TMP_SELF" "$@" </dev/null
  fi
fi

# ── Colors / logging ───────────────────────────────────────────────────────
RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'; CYN='\033[0;36m'; BLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
log()  { echo -e "${GRN}[cms]${NC} $*"; }
warn() { echo -e "${YLW}[warn]${NC} $*"; }
die()  { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }
hr()   { echo -e "${DIM}────────────────────────────────────────────────────${NC}"; }

# ── Constants ──────────────────────────────────────────────────────────────
CMS_DIR="/opt/casino-system"
ENV_FILE="${CMS_DIR}/deploy/.env"
ETC_DIR="/etc/cms"
SERVER_ENV="${ETC_DIR}/server.env"
CLOUD_URL_DEFAULT="https://rpehngjvwcnipvkouluu.supabase.co"
BASE_URL="${CMS_INSTALLER_BASE:-https://casinosystem.app}"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZWhuZ2p2d2NuaXB2a291bHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTcwMjAsImV4cCI6MjA5MDI3MzAyMH0.KTJEJRCYpNjj51H28x3pYFLvfMz5qtRjxnUFw3Hnwr0"

[[ $EUID -eq 0 ]] || die "Run as root (use sudo)."

mkdir -p "$ETC_DIR"
chmod 700 "$ETC_DIR"

# ── State detection ────────────────────────────────────────────────────────
detect_state() {
  STATE_INSTALLED="no"
  STATE_VERSION="-"
  STATE_MODE="-"
  STATE_CASINO="-"
  STATE_ROLE="-"
  if [[ -d "$CMS_DIR/deploy" && -f "$ENV_FILE" ]]; then
    STATE_INSTALLED="yes"
    STATE_VERSION="$(cat "$CMS_DIR/VERSION" 2>/dev/null || echo "unknown")"
    local cid
    cid="$(grep -E '^CASINO_ID=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d \"\' || true)"
    local secret
    secret="$(grep -E '^SYNC_SECRET=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d \"\' || true)"
    if [[ -n "$cid" && -n "$secret" ]]; then
      STATE_MODE="Cloud-connected"
      STATE_CASINO="$cid"
    else
      STATE_MODE="Standalone"
    fi
    STATE_ROLE="$(grep -E '^SERVER_ROLE=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d \"\' || echo replica)"
  fi
}

print_banner() {
  clear
  echo -e "${BLD}Casino Management System — Installer${NC}"
  hr
  if [[ "$STATE_INSTALLED" == "yes" ]]; then
    echo -e "  Status      : ${GRN}installed${NC}"
    echo -e "  Version     : ${STATE_VERSION}"
    echo -e "  Mode        : ${STATE_MODE}"
    [[ "$STATE_CASINO" != "-" ]] && echo -e "  Casino ID   : ${STATE_CASINO}"
    echo -e "  Role        : ${STATE_ROLE}"
  else
    echo -e "  Status      : ${YLW}not installed${NC}"
  fi
  hr
}

# ── Helpers ────────────────────────────────────────────────────────────────
download_to() {
  local url="$1" dst="$2"
  curl -fsSL "$url" -o "$dst" || die "Cannot download $url"
}

run_script() {
  # Runs a sub-script from BASE_URL with stdin from /dev/tty so prompts work.
  local name="$1"; shift
  local tmp; tmp="$(mktemp /tmp/cms-sub-XXXXXX.sh)"
  download_to "${BASE_URL}/${name}" "$tmp"
  chmod +x "$tmp"
  if [ -e /dev/tty ]; then
    bash "$tmp" "$@" </dev/tty
  else
    bash "$tmp" "$@"
  fi
  rm -f "$tmp"
}

# ── Mode 1: Install ────────────────────────────────────────────────────────
mode_install() {
  if [[ "$STATE_INSTALLED" == "yes" ]]; then
    warn "A Casino System is already installed at $CMS_DIR."
    warn "Use 'Update' to upgrade, or 'Wipe & Reinstall' to start over."
    read -rp "Continue with Install anyway? (y/N) " yn
    [[ "$yn" =~ ^[Yy]$ ]] || return
  fi

  echo
  echo -e "${BLD}Choose installation type:${NC}"
  echo "  a) Cloud-connected   — sync with Cloud, pick a casino from the list"
  echo "  b) Standalone offline — no Cloud, optional snapshot restore"
  echo "  q) Back"
  echo
  read -rp "Choose [a/b/q]: " sub
  case "$sub" in
    a|A) install_cloud_connected ;;
    b|B) install_standalone ;;
    *)   return ;;
  esac
}

install_cloud_connected() {
  log "Fetching list of casinos from Cloud..."
  local list_json
  list_json="$(curl -fsSL \
    -H "apikey: ${ANON_KEY}" \
    -H "Authorization: Bearer ${ANON_KEY}" \
    "${CLOUD_URL_DEFAULT}/functions/v1/installer-list-casinos" 2>/dev/null || true)"

  if [[ -z "$list_json" ]] || ! echo "$list_json" | grep -q '"casinos"'; then
    die "Could not fetch casino list from Cloud. Check internet, then retry."
  fi

  # Parse via python (preinstalled on Ubuntu 22.04+).
  local parsed
  parsed="$(python3 - <<PY
import json, sys
data = json.loads('''$list_json''')
for i, c in enumerate(data.get("casinos", []), 1):
    print(f"{i}|{c.get('slug','')}|{c.get('name','')}|{c.get('subdomain','')}")
PY
)" || die "Failed to parse casino list."

  [[ -n "$parsed" ]] || die "Cloud returned no casinos."

  echo
  echo -e "${BLD}Available casinos in Cloud:${NC}"
  while IFS='|' read -r idx slug name sub; do
    printf "  %s) %-12s %s\n" "$idx" "$name" "($sub)"
  done <<< "$parsed"
  echo

  local count
  count="$(wc -l <<< "$parsed")"
  local pick
  while true; do
    read -rp "Pick casino [1-$count]: " pick
    [[ "$pick" =~ ^[0-9]+$ ]] && (( pick >= 1 && pick <= count )) && break
    warn "Invalid choice."
  done

  local picked_slug picked_name
  picked_slug="$(awk -F'|' -v i="$pick" 'NR==i{print $2}' <<< "$parsed")"
  picked_name="$(awk -F'|' -v i="$pick" 'NR==i{print $3}' <<< "$parsed")"

  echo
  log "Selected: ${BLD}${picked_name}${NC} (slug=${picked_slug})"
  echo "CASINO_SLUG=${picked_slug}" > "$SERVER_ENV"
  echo "CASINO_NAME=${picked_name}" >> "$SERVER_ENV"
  echo "MODE=cloud-connected" >> "$SERVER_ENV"
  chmod 600 "$SERVER_ENV"

  # Step 1: base install (Docker, frontend, postgres, cms-sync, cms-updater)
  log "Running base install (this takes 3-5 minutes)..."
  CMS_CASINO_SLUG="$picked_slug" run_script "install.sh"

  # Step 2: pair with Cloud → seed
  log "Pairing with Cloud and importing seed..."
  run_script "pair.sh"

  echo
  log "${GRN}✓ Cloud-connected install complete.${NC}"
  echo
  echo -e "  Cloud is still ${BLD}Primary${NC}. Local server is a ${BLD}Replica${NC}."
  echo -e "  When mirror_status = ok, go to:"
  echo -e "    ${CYN}Cloud → Admin → Servers → Promote to Primary${NC}"
  echo
}

install_standalone() {
  echo
  echo -e "${BLD}Standalone offline install — no Cloud connection.${NC}"
  echo "  1) Empty database (fresh start)"
  echo "  2) Restore from snapshot (local file or URL)"
  echo "  q) Back"
  read -rp "Choose [1/2/q]: " sub

  local snapshot=""
  case "$sub" in
    1) ;;
    2)
      read -rp "Snapshot source — file path or http(s) URL: " src
      [[ -n "$src" ]] || die "No source provided."
      if [[ "$src" =~ ^https?:// ]]; then
        snapshot="/tmp/cms-snapshot-$$.dump"
        log "Downloading snapshot..."
        curl -fL "$src" -o "$snapshot" || die "Download failed."
      else
        [[ -f "$src" ]] || die "File not found: $src"
        snapshot="$src"
      fi
      ;;
    *) return ;;
  esac

  echo "MODE=standalone" > "$SERVER_ENV"
  echo "CMS_SYNC_ENABLED=false" >> "$SERVER_ENV"
  chmod 600 "$SERVER_ENV"

  log "Running base install in Standalone mode..."
  CMS_STANDALONE=1 run_script "install.sh"

  if [[ -n "$snapshot" ]]; then
    log "Restoring snapshot into local Postgres..."
    cd "${CMS_DIR}/deploy"
    local pwd_pg
    pwd_pg="$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d \"\' || true)"
    docker compose exec -T -e PGPASSWORD="$pwd_pg" postgres \
      pg_restore -h 127.0.0.1 -U postgres -d postgres --no-owner --no-acl --clean --if-exists \
      < "$snapshot" || warn "pg_restore reported errors (some are harmless)."
    [[ "$snapshot" == /tmp/cms-snapshot-* ]] && rm -f "$snapshot"
  fi

  echo
  log "${GRN}✓ Standalone install complete.${NC}"
  echo -e "  No Cloud sync. Local super_admin works on ${CYN}http://$(hostname -I | awk '{print $1}')${NC}"
}

# ── Mode 2: Update ─────────────────────────────────────────────────────────
mode_update() {
  if [[ "$STATE_INSTALLED" != "yes" ]]; then
    warn "Nothing to update — system not installed."
    return
  fi
  log "Pulling latest version (database is preserved)..."
  run_script "update.sh"
  log "${GRN}✓ Update complete.${NC}"
}

# ── Mode 3: Wipe & Reinstall ───────────────────────────────────────────────
mode_wipe() {
  echo
  echo -e "${RED}${BLD}WARNING${NC} — this will destroy the local database and all settings."
  echo "  - Drops all Docker volumes"
  echo "  - Removes $ENV_FILE and pair credentials"
  echo "  - Then re-runs Install"
  echo
  read -rp "Type WIPE (uppercase) to confirm: " confirm
  [[ "$confirm" == "WIPE" ]] || { warn "Cancelled."; return; }

  if [[ -d "$CMS_DIR/deploy" ]]; then
    log "Stopping and removing all containers + volumes..."
    cd "$CMS_DIR/deploy"
    docker compose down -v || true
  fi
  rm -f "$SERVER_ENV"
  rm -f "$ENV_FILE"
  log "Wipe complete. Returning to Install menu..."
  sleep 2
  detect_state
  mode_install
}

# ── Mode 4: Status / Diagnostics ───────────────────────────────────────────
mode_status() {
  echo
  echo -e "${BLD}=== Casino System Status ===${NC}"
  echo "Installed at : $CMS_DIR"
  echo "Version      : $STATE_VERSION"
  echo "Mode         : $STATE_MODE"
  echo "Casino       : $STATE_CASINO"
  echo "Role         : $STATE_ROLE"
  echo
  if [[ -d "$CMS_DIR/deploy" ]]; then
    cd "$CMS_DIR/deploy"
    echo -e "${BLD}--- Containers ---${NC}"
    docker compose ps 2>/dev/null || echo "(docker compose not available)"
    echo
    if [[ "$STATE_MODE" == "Cloud-connected" ]]; then
      echo -e "${BLD}--- Sync ping ---${NC}"
      docker compose exec -T cms-sync node /app/pair-cli.js ping </dev/null 2>&1 || echo "(cms-sync not responding)"
      echo
    fi
    echo -e "${BLD}--- Last 30 cms-sync log lines ---${NC}"
    docker compose logs --tail=30 cms-sync 2>/dev/null || true
  else
    warn "Not installed."
  fi
  echo
  read -rp "Press Enter to continue..." _
}

# ── Main menu ──────────────────────────────────────────────────────────────
main_menu() {
  while true; do
    detect_state
    print_banner
    echo "  1) Install              — set up a new server"
    echo "  2) Update               — upgrade code/containers, keep DB"
    echo "  3) Wipe & Reinstall     — destroy DB + reinstall"
    echo "  4) Status / Diagnostics — version, sync, peers, logs"
    echo
    echo "  q) Quit"
    echo
    read -rp "Choose [1-4 or q]: " choice
    case "$choice" in
      1) mode_install ;;
      2) mode_update ;;
      3) mode_wipe ;;
      4) mode_status ;;
      q|Q) echo "Bye."; exit 0 ;;
      *) warn "Invalid choice." ; sleep 1 ;;
    esac
    echo
    read -rp "Press Enter to return to menu..." _
  done
}

# ── Entry ──────────────────────────────────────────────────────────────────
# If a prefill mode is provided (used by legacy wrappers), jump straight in.
case "${CMS_PREFILL_MODE:-}" in
  install)
    detect_state
    print_banner
    mode_install
    ;;
  update)
    detect_state
    print_banner
    mode_update
    ;;
  status)
    detect_state
    print_banner
    mode_status
    ;;
  *)
    main_menu
    ;;
esac
