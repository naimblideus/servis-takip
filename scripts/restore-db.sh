#!/usr/bin/env bash
# servis-takip — yedekten geri yükleme. DİKKAT: hedef veritabanını ETKİLER.
# Kullanım: DATABASE_URL='postgres://...' bash scripts/restore-db.sh /backups/servis-takip/st-YYYYMMDD-HHMMSS.sql.gz
# Yedeğin geçerliliğini doğrulamak için yılda birkaç kez BOŞ/TEST bir DB'ye restore deneyin.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL gerekli}"
FILE="${1:?Yedek dosyası yolu gerekli (örn: /backups/servis-takip/st-...sql.gz)}"
[ -f "$FILE" ] || { echo "Dosya yok: $FILE"; exit 1; }

echo "[restore] $FILE -> hedef DB"
echo "[restore] 5 sn içinde Ctrl+C ile durdurabilirsiniz..."
sleep 5
gunzip -c "$FILE" | psql "$DATABASE_URL"
echo "[restore] tamamlandı"
