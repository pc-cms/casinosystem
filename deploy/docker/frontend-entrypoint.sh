#!/usr/bin/env bash
#
# Casino System — frontend entrypoint.
# Подменяет placeholders в /usr/share/nginx/html/runtime-config.json
# на значения из ENV перед запуском nginx.
#
# nginx:alpine автоматически выполняет все скрипты из /docker-entrypoint.d/
# в алфавитном порядке. Этот скрипт стоит на 40, после стандартных 10/20/30.
#
# ENV переменные приходят из docker-compose:
#   RUNTIME_SUPABASE_URL   = https://arusha.local/api
#   RUNTIME_SUPABASE_KEY   = JWT (anon)
#   RUNTIME_CASINO_ID      = UUID казино
#   RUNTIME_CASINO_SLUG    = arusha | dodoma | mbeya | mwanza
#   RUNTIME_LOCAL_MODE     = true (всегда true в on-prem)
#   RUNTIME_VERSION        = версия из ${FRONTEND_VERSION}

set -euo pipefail

CONFIG_FILE="/usr/share/nginx/html/runtime-config.json"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "[runtime-config] ${CONFIG_FILE} not found — skipping (cloud build)"
  exit 0
fi

echo "[runtime-config] patching ${CONFIG_FILE}"

# Дефолты — на случай если ENV не передан (даёт безопасный no-op)
: "${RUNTIME_SUPABASE_URL:=}"
: "${RUNTIME_SUPABASE_KEY:=}"
: "${RUNTIME_CASINO_ID:=}"
: "${RUNTIME_CASINO_SLUG:=}"
: "${RUNTIME_LOCAL_MODE:=true}"
: "${RUNTIME_VERSION:=unknown}"

# Используем jq для безопасной подмены (не сломает JSON если значение содержит спец-символы)
TMP=$(mktemp)
jq \
  --arg url        "$RUNTIME_SUPABASE_URL" \
  --arg key        "$RUNTIME_SUPABASE_KEY" \
  --arg cid        "$RUNTIME_CASINO_ID" \
  --arg slug       "$RUNTIME_CASINO_SLUG" \
  --argjson local  "$( [[ "$RUNTIME_LOCAL_MODE" == "true" ]] && echo true || echo false )" \
  --arg version    "$RUNTIME_VERSION" \
  '{
    supabaseUrl: $url,
    supabasePublishableKey: $key,
    casinoId: $cid,
    casinoSlug: $slug,
    localMode: $local,
    version: $version
  }' \
  "$CONFIG_FILE" > "$TMP"

mv "$TMP" "$CONFIG_FILE"
chmod 644 "$CONFIG_FILE"

echo "[runtime-config] applied:"
echo "  supabaseUrl = ${RUNTIME_SUPABASE_URL}"
echo "  casinoSlug  = ${RUNTIME_CASINO_SLUG}"
echo "  localMode   = ${RUNTIME_LOCAL_MODE}"
echo "  version     = ${RUNTIME_VERSION}"
