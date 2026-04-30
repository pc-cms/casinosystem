#!/usr/bin/env bash
#
# cms-backup — ежедневный pg_dump + storage tar → S3 (или локальный диск).
# Запускается контейнером cms-backup по cron 04:30 (до бизнес-роллoвера 05:00).
#
# Retention:
#   - daily/    — 30 дней
#   - monthly/  — первый день месяца, 12 месяцев
#
# Если AWS_S3_BUCKET не задан → пишет только в /backups (локально).
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

# Upload to S3 if configured
if [[ -n "${AWS_S3_BUCKET:-}" && -n "${AWS_ACCESS_KEY_ID:-}" ]]; then
  echo "[backup] upload to s3://$AWS_S3_BUCKET/$CASINO_SLUG/$TAG/"
  aws s3 cp "$DUMP" "s3://$AWS_S3_BUCKET/$CASINO_SLUG/$TAG/" --only-show-errors
  aws s3 cp "$STOR" "s3://$AWS_S3_BUCKET/$CASINO_SLUG/$TAG/" --only-show-errors
fi

# Local retention
echo "[backup] cleanup local"
find /backups/daily   -type f -mtime +30  -delete 2>/dev/null || true
find /backups/monthly -type f -mtime +365 -delete 2>/dev/null || true

echo "[backup] done $TS"
