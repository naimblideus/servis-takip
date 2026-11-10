-- KİRA DÖNEM DÖNEM (lib/kira-donemi.ts)
--
-- Kira tek bir "son kesilen ay" işaretiyle tutuluyordu (Device.lastInvoicedPeriod).
-- Aylar sırasız kesilince (taslakta bekleyen ay, hata alıp atlanan ay) işaret
-- ileri gidiyor, atlanan ayın kirası bir daha kesilemiyordu. Artık her
-- cihaz × dönem için bir satır var; tekil dizin aynı kiranın iki kez
-- kesilmesini veritabanı düzeyinde engeller.
--
-- Göçler her açılışta yeniden koşabilir: hepsi IF NOT EXISTS / ON CONFLICT /
-- duplicate_object korumalı ve doldurma adımları ikinci koşuda bir şey değiştirmez.

ALTER TABLE "CounterReading" ADD COLUMN IF NOT EXISTS "sifirlama" TEXT;
-- Okumayı hangi belge faturaladı (iptal/silmede geri açmak ve mutabakat için).
ALTER TABLE "CounterReading" ADD COLUMN IF NOT EXISTS "faturaId" TEXT;
ALTER TABLE "CounterReading" ADD COLUMN IF NOT EXISTS "cariKayitId" TEXT;
CREATE INDEX IF NOT EXISTS "CounterReading_faturaId_idx" ON "CounterReading"("faturaId");
-- Okuma alındığında cihaz kimdeydi (cihaz taşınınca sayfalar eski müşteride kalsın).
ALTER TABLE "CounterReading" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
CREATE INDEX IF NOT EXISTS "CounterReading_tenantId_customerId_idx" ON "CounterReading"("tenantId", "customerId");

CREATE TABLE IF NOT EXISTS "KiraDonemi" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "tutar" DECIMAL(12,2) NOT NULL,
  "kaynak" TEXT NOT NULL,
  "invoiceId" TEXT,
  "cariKayitId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KiraDonemi_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KiraDonemi_deviceId_period_key" ON "KiraDonemi"("deviceId", "period");
CREATE INDEX IF NOT EXISTS "KiraDonemi_tenantId_period_idx" ON "KiraDonemi"("tenantId", "period");
CREATE INDEX IF NOT EXISTS "KiraDonemi_invoiceId_idx" ON "KiraDonemi"("invoiceId");

DO $$ BEGIN
  ALTER TABLE "KiraDonemi" ADD CONSTRAINT "KiraDonemi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "KiraDonemi" ADD CONSTRAINT "KiraDonemi_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Faturalanmamış okumalar: dönem faturası her cihaz için bunları arıyor ve
-- hiçbir dizin "billed" taşımıyordu (cihazın bütün geçmişi taranıyordu).
CREATE INDEX IF NOT EXISTS "CounterReading_faturasiz_idx" ON "CounterReading"("tenantId", "deviceId") WHERE "billed" = false;

-- GEÇMİŞİ DOLDUR: bugüne kadar FATURAYLA kesilmiş kiralar. Aynı cihaz ×
-- dönem birden çok faturada geçiyorsa (eski çift kesimler) ilki kalır.
INSERT INTO "KiraDonemi" ("id", "tenantId", "deviceId", "period", "tutar", "kaynak", "invoiceId", "createdAt")
SELECT 'kd_' || l."id", l."tenantId", l."deviceId", i."period", l."lineTotal", 'FATURA', i."id", i."invoiceDate"
FROM "InvoiceLine" l
JOIN "CustomerInvoice" i ON i."id" = l."invoiceId"
JOIN "Device" d ON d."id" = l."deviceId"
WHERE l."kind" = 'RENTAL' AND i."deletedAt" IS NULL
ORDER BY i."invoiceDate"
ON CONFLICT ("deviceId", "period") DO NOTHING;
