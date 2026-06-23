#!/usr/bin/env bash
# servis-takip — PostgreSQL otomatik yedeği (pg_dump + gzip + retention + opsiyonel off-box).
# Gerekli: DATABASE_URL ortam değişkeni, pg_dump (postgresql-client).
#
# Elle:   DATABASE_URL='postgres://...' bash scripts/backup-db.sh
# Cron (droplet, her gün 03:00):
#   0 3 * * * cd /opt/servis-takip && DATABASE_URL='postgres://...' BACKUP_DIR=/backups/st \
#             bash scripts/backup-db.sh >> /var/log/st-backup.log 2>&1
#
# Off-box (önerilen): S3/Spaces'e de yüklemek için S3_BACKUP_BUCKET (+ ister S3_ENDPOINT) ver; aws cli gerekir.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL gerekli}"
BACKUP_DIR="${BACKUP_DIR:-/backups/servis-takip}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/st-$STAMP.sql.gz"

echo "[backup] $STAMP -> $FILE"
pg_dump "$DATABASE_URL" --no-owner --no-privileges | gzip -9 > "$FILE"
echo "[backup] boyut: $(du -h "$FILE" | cut -f1)"

# Off-box kopya (opsiyonel) — env varsa Spaces/S3'e yükle
if [ -n "${S3_BACKUP_BUCKET:-}" ]; then
  aws s3 cp "$FILE" "s3://$S3_BACKUP_BUCKET/db/" ${S3_ENDPOINT:+--endpoint-url "$S3_ENDPOINT"}
  echo "[backup] off-box yüklendi: s3://$S3_BACKUP_BUCKET/db/"
fi

# Retention — eski yerel yedekleri temizle
find "$BACKUP_DIR" -name 'st-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
echo "[backup] bitti (retention ${RETENTION_DAYS} gün)"
