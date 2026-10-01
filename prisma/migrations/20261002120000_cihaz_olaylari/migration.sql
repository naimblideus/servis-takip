-- Cihaz uyarılarının GEÇMİŞİ. Cihaz kartı yalnız şu anki durumu tutuyor;
-- "bu makine son 90 günde 6 kez sıkıştı" sorusunun cevabı burada: her
-- uyarı kodu görüldüğü an açılır, kaybolduğu taramada kapanır. gorulme =
-- uyarının üst üste kaç taramada görüldüğü (otomatik fiş iki taramadan
-- sonra açılır). ticketId = bu uyarı için açılan ya da bağlanan fiş.
CREATE TABLE IF NOT EXISTS "CihazOlayi" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "kod" TEXT NOT NULL,
  "basladi" TIMESTAMP(3) NOT NULL,
  "bitti" TIMESTAMP(3),
  "gorulme" INTEGER NOT NULL DEFAULT 1,
  "ticketId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CihazOlayi_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CihazOlayi_tenantId_deviceId_basladi_idx" ON "CihazOlayi"("tenantId", "deviceId", "basladi");
CREATE INDEX IF NOT EXISTS "CihazOlayi_tenantId_bitti_idx" ON "CihazOlayi"("tenantId", "bitti");
DO $$ BEGIN
  ALTER TABLE "CihazOlayi" ADD CONSTRAINT "CihazOlayi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CihazOlayi" ADD CONSTRAINT "CihazOlayi_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Parça ömrü: drum, fırın, bakım kiti, atık kutusu. olcumParca = en düşüğü
-- (atık kutusunda yüzde KALAN BOŞ YER: düşükse dolmak üzere).
-- olcumSarf = taramadaki bütün kalemler [{ad, yuzde, tur}] (gösterim için).
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "olcumParca" INTEGER;
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "olcumSarf" JSONB;

-- Servis uyarısı iki taramada üst üste görülürse fiş kendiliğinden açılsın.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "tarayiciOtomatikFis" BOOLEAN NOT NULL DEFAULT false;
