#!/usr/bin/env bash
#
# cms-backup — ежедневный pg_dump + storage tar → Lovable Cloud Storage
# (или только локальный диск, если связи нет / BACKUP_OFFSITE=local).
#
# Запускается контейнером cms-backup по cron 04:30 (до бизнес-роллoвера 05:00).
#
# Retention:
#   - daily/    — BACKUP_RETENTION_DAILY дней (по умолчанию 30)
#   - monthly/  — первый день месяца, BACKUP_RETENTION_MONTHLY месяцев (12)
#
set -euo pipefail
. /compose/.env

TS=$(date -u +%Y%m%d-%H%M%S)
DAY=$(date -u +%d)
TAG="daily"
[[ "$DAY" == "01" ]] && TAG="monthly"

OUT_DIR=/backups/$TAG
mkdir -p "$OUT_DIR"

DUMP="$OUT_DIR/${CASINO_SLUG}-db-$TS.sql.zst"
STOR="$OUT_DIR/${CASINO_SLUG}-storage-$TS.tar.zst"

echo "[backup] dump db → $DUMP"
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h postgres -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" \
  --no-owner --clean --if-exists | zstd -19 -T0 -o "$DUMP"

echo "[backup] tar storage → $STOR"
tar --use-compress-program="zstd -19 -T0" -cf "$STOR" -C /var/lib/storage .

# Upload to Lovable Cloud Storage (через edge-функцию upload-backup)
upload_to_cloud() {
  local file="$1"
  local name
  name=$(basename "$file")
  echo "[backup] upload → cloud: $name"
  curl -fsS --max-time 600 \
    -X POST "$CLOUD_URL/functions/v1/upload-backup" \
    -H "x-sync-secret: $SYNC_SECRET" \
    -H "x-casino-slug: $CASINO_SLUG" \
    -H "x-backup-tag: $TAG" \
    -H "x-file-name: $name" \
    -H "Content-Type: application/octet-stream" \
    --data-binary "@$file" \
    || echo "[backup] WARN: upload failed for $name (saved locally)"
}

if [[ "${BACKUP_OFFSITE:-cloud}" == "cloud" && -n "${CLOUD_URL:-}" && -n "${SYNC_SECRET:-}" ]]; then
  upload_to_cloud "$DUMP"
  upload_to_cloud "$STOR"
else
  echo "[backup] off-site disabled, keeping local only"
fi

# Local retention
DAILY_DAYS=${BACKUP_RETENTION_DAILY:-30}
MONTHLY_MONTHS=${BACKUP_RETENTION_MONTHLY:-12}
echo "[backup] cleanup local (daily>${DAILY_DAYS}d, monthly>${MONTHLY_MONTHS}mo)"
find /backups/daily   -type f -mtime +${DAILY_DAYS}            -delete 2>/dev/null || true
find /backups/monthly -type f -mtime +$((MONTHLY_MONTHS * 31)) -delete 2>/dev/null || true

echo "[backup] done $TS"
