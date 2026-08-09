#!/usr/bin/env bash
# servis-takip — GERİ YÜKLEME TATBİKATI.
#
# "Yedeğiniz var mı?" sorusunun cevabı kolay. Kurumsal alıcının sorduğu asıl
# soru "geri yükleme denendi mi?" — çünkü hiç denenmemiş yedek yedek değildir.
# Bu betik en son yedeği GEÇİCİ ve BOŞ bir veritabanına yükler, satır sayılarını
# doğrular ve geçici veritabanını siler. CANLI VERİTABANINA DOKUNMAZ.
#
# Kullanım (droplet'te):
#   DATABASE_URL='postgres://...' bash scripts/restore-drill.sh
#   DATABASE_URL='postgres://...' bash scripts/restore-drill.sh /backups/servis-takip/st-20260801-030000.sql.gz
#
# Ayda bir çalıştırın. Cron (her ayın 1'i 04:00):
#   0 4 1 * * cd /opt/servis-takip && DATABASE_URL='postgres://...' \
#             bash scripts/restore-drill.sh >> /var/log/st-restore-drill.log 2>&1
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL gerekli}"
BACKUP_DIR="${BACKUP_DIR:-/backups/servis-takip}"
# Tatbikat veritabanı adı — tarihli, canlıyla karışma ihtimali yok.
DRILL_DB="${DRILL_DB:-st_drill_$(date +%Y%m%d_%H%M%S)}"

# Yedek dosyası: argüman verilmediyse en yenisi
FILE="${1:-}"
if [ -z "$FILE" ]; then
  FILE="$(ls -1t "$BACKUP_DIR"/st-*.sql.gz 2>/dev/null | head -1 || true)"
fi
[ -n "$FILE" ] && [ -f "$FILE" ] || { echo "[tatbikat] BAŞARISIZ: yedek dosyası bulunamadı ($BACKUP_DIR)"; exit 1; }

# Yaş kontrolü — 48 saatten eski yedek, yedekleme cron'unun durduğu anlamına gelir.
YAS_SAAT=$(( ( $(date +%s) - $(stat -c %Y "$FILE") ) / 3600 ))
echo "[tatbikat] dosya: $FILE (${YAS_SAAT} saat önce, $(du -h "$FILE" | cut -f1))"
if [ "$YAS_SAAT" -gt 48 ]; then
  echo "[tatbikat] ⚠ UYARI: en yeni yedek 48 saatten eski — yedekleme cron'u çalışmıyor olabilir"
fi

# Yönetim bağlantısı: hedef veritabanı adını 'postgres' ile değiştir
ADMIN_URL="$(echo "$DATABASE_URL" | sed -E 's#(/)[^/?]+(\?|$)#\1postgres\2#')"
DRILL_URL="$(echo "$DATABASE_URL" | sed -E "s#(/)[^/?]+(\?|\$)#\1${DRILL_DB}\2#")"

temizle() {
  echo "[tatbikat] geçici veritabanı siliniyor: $DRILL_DB"
  psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS \"$DRILL_DB\";" >/dev/null 2>&1 || true
}
# Betik nasıl biterse bitsin (hata/Ctrl+C dahil) geçici DB kalmaz.
trap temizle EXIT

echo "[tatbikat] geçici veritabanı oluşturuluyor: $DRILL_DB"
psql "$ADMIN_URL" -q -c "CREATE DATABASE \"$DRILL_DB\";"

echo "[tatbikat] geri yükleniyor…"
if ! gunzip -c "$FILE" | psql "$DRILL_URL" -q -v ON_ERROR_STOP=1 >/dev/null; then
  echo "[tatbikat] ✗ BAŞARISIZ: yedek geri yüklenemedi — bu yedek KULLANILAMAZ"
  exit 1
fi

# Doğrulama: tablolar geldi mi, içlerinde veri var mı?
say() { psql "$DRILL_URL" -tAc "SELECT count(*) FROM \"$1\";" 2>/dev/null || echo "HATA"; }

TABLO_SAYISI=$(psql "$DRILL_URL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
echo "[tatbikat] tablo sayısı: $TABLO_SAYISI"
[ "$TABLO_SAYISI" -gt 20 ] || { echo "[tatbikat] ✗ BAŞARISIZ: tablo sayısı beklenenden az"; exit 1; }

HATA=0
for T in Tenant User Customer Device ServiceTicket CounterReading; do
  N="$(say "$T")"
  if [ "$N" = "HATA" ]; then echo "[tatbikat] ✗ $T tablosu okunamadı"; HATA=1; continue; fi
  echo "[tatbikat]   $T: $N satır"
  # Tenant ve User boşsa yedek işe yaramaz (diğerleri yeni kurulumda boş olabilir).
  if { [ "$T" = "Tenant" ] || [ "$T" = "User" ]; } && [ "$N" -eq 0 ]; then
    echo "[tatbikat] ✗ $T BOŞ — yedek eksik"; HATA=1
  fi
done

[ "$HATA" -eq 0 ] || { echo "[tatbikat] ✗ BAŞARISIZ"; exit 1; }
echo "[tatbikat] ✓ BAŞARILI — bu yedek geri yüklenebilir ($(basename "$FILE"))"
