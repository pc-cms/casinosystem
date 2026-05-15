#!/usr/bin/env bash
#
# build-installer.sh — собирает один tarball для флешки.
#
# Usage:
#   ./deploy/build-installer.sh
#
# Результат:
#   deploy/dist/casino-system-installer-<git-sha>.tar.gz   (~80 MB)
#   deploy/dist/INSTALL.txt                                (3 строки инструкции)
#
# Скопируйте оба файла в корень USB-флешки и см. инструкции в INSTALL.txt.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SHA="$(git rev-parse --short HEAD 2>/dev/null || echo dev)"
OUT_DIR="deploy/dist"
OUT_TGZ="${OUT_DIR}/casino-system-installer-${SHA}.tar.gz"

mkdir -p "$OUT_DIR"

echo "→ Packing tarball ${OUT_TGZ} ..."
tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='deploy/dist' \
    --exclude='deploy/certs' \
    --exclude='.lovable' \
    --exclude='*.log' \
    -czf "$OUT_TGZ" \
    package.json package-lock.json bun.lockb tsconfig*.json vite.config.ts \
    index.html postcss.config.js tailwind.config.ts components.json \
    eslint.config.js \
    src public supabase/migrations deploy 2>/dev/null || true

cp deploy/INSTALL.txt "${OUT_DIR}/INSTALL.txt"

SIZE_MB=$(du -m "$OUT_TGZ" | awk '{print $1}')
echo
echo "✓ Installer ready: ${OUT_TGZ}  (${SIZE_MB} MB)"
echo "✓ Instruction:    ${OUT_DIR}/INSTALL.txt"
echo
echo "Copy BOTH files to a USB stick and follow INSTALL.txt on the server."
