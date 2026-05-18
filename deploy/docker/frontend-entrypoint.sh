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
HEALTHZ_FILE="${ROOT}/healthz"

: "${RUNTIME_SUPABASE_URL:=__CMS_ORIGIN_PLACEHOLDER__/api}"
: "${RUNTIME_SUPABASE_KEY:=}"
: "${RUNTIME_CASINO_ID:=}"
: "${RUNTIME_CASINO_SLUG:=local}"
: "${RUNTIME_CASINO_NAME:=Casino}"
: "${RUNTIME_LOCAL_MODE:=true}"
: "${RUNTIME_VERSION:=unknown}"

# ────────── 0. Healthcheck marker ──────────
# cms-frontend uses nginx default static serving internally, while the public
# cms-nginx container has an explicit /healthz location. Keep a real file here
# so Docker healthchecks against cms-frontend also pass.
printf 'ok\n' > "$HEALTHZ_FILE"
chmod 644 "$HEALTHZ_FILE"

# ────────── 0. Universal-origin patch ──────────
# Replace baked placeholder with runtime `location.origin + "/api"` so the
# same image works for ANY hostname (IP / mDNS / custom domain).
# Vite inlines `import.meta.env.VITE_SUPABASE_URL` as a string literal at build
# time, so we sed the bundled JS once at container start. Idempotent.
PLACEHOLDER='"__CMS_ORIGIN_PLACEHOLDER__/api"'
REPLACEMENT='(typeof location!=="undefined"?location.origin:"")+"/api"'
PATCHED=0
if grep -rqlF "$PLACEHOLDER" "${ROOT}/assets" 2>/dev/null; then
  echo "[entrypoint] rewriting __CMS_ORIGIN_PLACEHOLDER__ → location.origin"
  # Use a delimiter that won't appear in the replacement
  while IFS= read -r f; do
    sed -i "s|${PLACEHOLDER}|${REPLACEMENT}|g" "$f"
    PATCHED=$((PATCHED+1))
  done < <(grep -rlF "$PLACEHOLDER" "${ROOT}/assets" 2>/dev/null)
  echo "[entrypoint] patched ${PATCHED} bundle file(s)"
fi

# ────────── 1. runtime-config.json ──────────
# supabaseUrl is left as the placeholder string — the bundle already uses
# location.origin via the sed above. runtime-config drives only casino identity.
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
  --arg name  "${RUNTIME_CASINO_NAME} — Casino System" \
  --arg short "${RUNTIME_CASINO_NAME}" \
  --arg id    "/local-${RUNTIME_CASINO_SLUG}" \
  --arg desc  "${RUNTIME_CASINO_NAME} — Casino Management System." \
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
