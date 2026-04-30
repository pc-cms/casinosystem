#!/usr/bin/env bash
#
# Casino System — frontend entrypoint
# -----------------------------------
# Выполняется автоматически контейнером nginx:alpine из /docker-entrypoint.d/
# до старта nginx. Делает 2 вещи:
#   1. Подменяет placeholders в /usr/share/nginx/html/runtime-config.json
#   2. Генерирует /usr/share/nginx/html/manifest-local.json под текущее казино
#      (имя/slug берётся из ENV — никаких статических файлов на казино)
#
# ENV переменные приходят из docker-compose / .env:
#   RUNTIME_SUPABASE_URL   = https://arusha.local/api
#   RUNTIME_SUPABASE_KEY   = JWT (anon)
#   RUNTIME_CASINO_ID      = UUID казино
#   RUNTIME_CASINO_SLUG    = arusha | dodoma | mbeya | ...
#   RUNTIME_CASINO_NAME    = "Premier Arusha"  (человекочитаемое имя)
#   RUNTIME_LOCAL_MODE     = true (всегда true в on-prem)
#   RUNTIME_VERSION        = ${FRONTEND_VERSION}

set -euo pipefail

ROOT="/usr/share/nginx/html"
CONFIG_FILE="${ROOT}/runtime-config.json"
MANIFEST_FILE="${ROOT}/manifest-local.json"

: "${RUNTIME_SUPABASE_URL:=}"
: "${RUNTIME_SUPABASE_KEY:=}"
: "${RUNTIME_CASINO_ID:=}"
: "${RUNTIME_CASINO_SLUG:=local}"
: "${RUNTIME_CASINO_NAME:=Casino}"
: "${RUNTIME_LOCAL_MODE:=true}"
: "${RUNTIME_VERSION:=unknown}"

# ────────── 1. runtime-config.json ──────────
if [[ -f "$CONFIG_FILE" ]]; then
  echo "[entrypoint] patching ${CONFIG_FILE}"
  TMP=$(mktemp)
  jq \
    --arg url        "$RUNTIME_SUPABASE_URL" \
    --arg key        "$RUNTIME_SUPABASE_KEY" \
    --arg cid        "$RUNTIME_CASINO_ID" \
    --arg slug       "$RUNTIME_CASINO_SLUG" \
    --arg name       "$RUNTIME_CASINO_NAME" \
    --argjson local  "$( [[ "$RUNTIME_LOCAL_MODE" == "true" ]] && echo true || echo false )" \
    --arg version    "$RUNTIME_VERSION" \
    '{
      supabaseUrl: $url,
      supabasePublishableKey: $key,
      casinoId: $cid,
      casinoSlug: $slug,
      casinoName: $name,
      localMode: $local,
      version: $version
    }' \
    "$CONFIG_FILE" > "$TMP"
  mv "$TMP" "$CONFIG_FILE"
  chmod 644 "$CONFIG_FILE"
else
  echo "[entrypoint] ${CONFIG_FILE} missing — skipping (cloud-only build)"
fi

# ────────── 2. manifest-local.json (динамический) ──────────
echo "[entrypoint] generating ${MANIFEST_FILE} for ${RUNTIME_CASINO_NAME} (${RUNTIME_CASINO_SLUG})"
jq -n \
  --arg name  "${RUNTIME_CASINO_NAME} LOCAL — Casino System" \
  --arg short "${RUNTIME_CASINO_NAME} LAN" \
  --arg id    "/local-${RUNTIME_CASINO_SLUG}" \
  --arg desc  "${RUNTIME_CASINO_NAME} — локальная (LAN) PWA. Работает офлайн через локальный сервер." \
  '{
    name: $name,
    short_name: $short,
    description: $desc,
    start_url: "/?mode=local",
    id: $id,
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icon-192-local.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512-local.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192-local-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512-local-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  }' > "$MANIFEST_FILE"
chmod 644 "$MANIFEST_FILE"

echo "[entrypoint] done:"
echo "  casinoName  = ${RUNTIME_CASINO_NAME}"
echo "  casinoSlug  = ${RUNTIME_CASINO_SLUG}"
echo "  supabaseUrl = ${RUNTIME_SUPABASE_URL}"
echo "  version     = ${RUNTIME_VERSION}"
