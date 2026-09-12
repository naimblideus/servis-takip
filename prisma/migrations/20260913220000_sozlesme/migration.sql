-- SOZLESME
--
-- Sozlesmeyi dosya olarak saklamak bir dosya dolabidir; kimse acmaz. Bu
-- tablolar sozlesmenin TICARI SARTLARINI tutuyor ki sistem onlari gercekle
-- KARSILASTIRABILSIN: "sozlesmede ayda 1.500 TL + 1.000 sayfa dahil
-- yaziyor, sistemde 1.200 TL + 500 kayitli, uc aydir eksik faturaliyorsun".
-- Ise yarayan kisim bu; dosya saklamak degil.
--
-- SARTLAR CIHAZ BASINA, sozlesme basina degil: gercek sozlesmeler cogu
-- zaman birden cok makineyi ve makine basina farkli bedeli kapsiyor
-- ("uc makine, biri 1.500, ikisi 900"). Sozlesme basina tek rakam
-- tutsaydik karsilastirma bu sozlesmelerde yanlis cevap verirdi.
--
-- FESIH IHBAR SURESI ayri bir alan: sozlesme bitmeden N gun once haber
-- verilmezse kendiliginden uzuyor. Bitis tarihini bilmek yetmiyor, IHBAR
-- gununu bilmek gerekiyor — pencere kacinca bayi bir yil daha eski
-- fiyattan bagli kaliyor.
--
-- Sozlesme METNI burada YOK ve olmayacak: metin bayinin kendi hukuki
-- belgesi. Yalniz taranmis nushanin baglantisi tutuluyor.
--
-- IDEMPOTENT: apply-migrations.js her acilista tum migration'lari calistirir.

CREATE TABLE IF NOT EXISTS "Contract" (
  "id"               TEXT NOT NULL,
  "tenantId"         TEXT NOT NULL,
  "customerId"       TEXT NOT NULL,
  "contractNo"       TEXT,
  "startDate"        TIMESTAMP(3) NOT NULL,
  "endDate"          TIMESTAMP(3) NOT NULL,
  "noticeDays"       INTEGER NOT NULL DEFAULT 0,
  "autoRenew"        BOOLEAN NOT NULL DEFAULT false,
  "renewMonths"      INTEGER NOT NULL DEFAULT 12,
  "escalationMonths" INTEGER,
  "escalationRate"   DECIMAL(5,2),
  "lastEscalationAt" TIMESTAMP(3),
  "fileUrl"          TEXT,
  "notes"            TEXT,
  "status"           TEXT NOT NULL DEFAULT 'AKTIF',
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ContractDevice" (
  "id"                TEXT NOT NULL,
  "tenantId"          TEXT NOT NULL,
  "contractId"        TEXT NOT NULL,
  "deviceId"          TEXT NOT NULL,
  "monthlyRent"       DECIMAL(10,2),
  "includedBlack"     INTEGER,
  "includedColor"     INTEGER,
  "pricePerBlack"     DECIMAL(10,4),
  "pricePerColor"     DECIMAL(10,4),
  "overagePriceBlack" DECIMAL(10,4),
  "overagePriceColor" DECIMAL(10,4),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractDevice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Contract_tenantId_customerId_idx" ON "Contract"("tenantId", "customerId");
CREATE INDEX IF NOT EXISTS "Contract_tenantId_status_endDate_idx" ON "Contract"("tenantId", "status", "endDate");
CREATE INDEX IF NOT EXISTS "ContractDevice_tenantId_deviceId_idx" ON "ContractDevice"("tenantId", "deviceId");
-- Bir cihaz ayni sozlesmede iki kez olamaz.
CREATE UNIQUE INDEX IF NOT EXISTS "ContractDevice_contractId_deviceId_key" ON "ContractDevice"("contractId", "deviceId");

-- Bayi/musteri/cihaz silinince sozlesme kaydi da gitsin (oksuz satir kalmasin).
ALTER TABLE "Contract" DROP CONSTRAINT IF EXISTS "Contract_tenantId_fkey";
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contract" DROP CONSTRAINT IF EXISTS "Contract_customerId_fkey";
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContractDevice" DROP CONSTRAINT IF EXISTS "ContractDevice_tenantId_fkey";
ALTER TABLE "ContractDevice" ADD CONSTRAINT "ContractDevice_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractDevice" DROP CONSTRAINT IF EXISTS "ContractDevice_contractId_fkey";
ALTER TABLE "ContractDevice" ADD CONSTRAINT "ContractDevice_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractDevice" DROP CONSTRAINT IF EXISTS "ContractDevice_deviceId_fkey";
ALTER TABLE "ContractDevice" ADD CONSTRAINT "ContractDevice_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
