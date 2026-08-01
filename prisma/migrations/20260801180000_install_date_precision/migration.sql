-- Kurulum tarihi hassasiyeti + "bilinmiyor" işareti (idempotent)
-- Neden: bayi günü değil YILI hatırlar. "2019" değerini kesin tarih sanmamak için
-- hassasiyet ayrı saklanır. "Bilinmiyor" işareti olmazsa sistem aynı cihazı sonsuza
-- dek sorar ve kullanıcı kurtulmak için rastgele tarih girer — veri bozulur.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DatePrecision') THEN
    CREATE TYPE "DatePrecision" AS ENUM ('YEAR', 'MONTH', 'DAY');
  END IF;
END$$;

ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "installedAtPrecision" "DatePrecision";
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "installDateUnknown" BOOLEAN NOT NULL DEFAULT false;

-- Daha önce elle girilmiş tarihler gün hassasiyetindeydi (takvimden seçilmişti)
UPDATE "Device" SET "installedAtPrecision" = 'DAY'
WHERE "installedAt" IS NOT NULL AND "installedAtPrecision" IS NULL;
