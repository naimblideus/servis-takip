-- Toner sevki: bitmek üzere olan cihaza gönderilen toner. Stok sevkte düşer;
-- tarayıcı ya da fiş toner değişimini görünce sevk TAKILDI olur ve gönderilen
-- toner o değişim kaydına yazılır (toner ürünü karnesinin veri kaynağı).
CREATE TABLE IF NOT EXISTS "TonerSevki" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "partId" TEXT,
  "adet" INTEGER NOT NULL DEFAULT 1,
  "durum" TEXT NOT NULL DEFAULT 'GONDERILDI',
  "gonderenId" TEXT,
  "gonderildiAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "takildiAt" TIMESTAMP(3),
  "tonerChangeId" TEXT,
  "iptalAt" TIMESTAMP(3),
  CONSTRAINT "TonerSevki_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TonerSevki_tenantId_deviceId_channel_durum_idx" ON "TonerSevki"("tenantId", "deviceId", "channel", "durum");
CREATE INDEX IF NOT EXISTS "TonerSevki_tenantId_gonderildiAt_idx" ON "TonerSevki"("tenantId", "gonderildiAt");
DO $$ BEGIN
  ALTER TABLE "TonerSevki" ADD CONSTRAINT "TonerSevki_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "TonerSevki" ADD CONSTRAINT "TonerSevki_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Cihaz + kanal başına aynı anda TEK açık sevk. Çift tıklama ya da iki sekme
-- ikinci sevki (ve ikinci stok düşüşünü) üretemez — bunu kod değil veritabanı tutar.
CREATE UNIQUE INDEX IF NOT EXISTS "TonerSevki_acik_tekil" ON "TonerSevki"("tenantId", "deviceId", "channel") WHERE "durum" = 'GONDERILDI';
