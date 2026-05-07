-- Bu migration AccountEntry ve PrinterStock tablolarının
-- production DB'de olmadığı durum için idempotent kurulum sağlar.
-- Prisma'nın önceki migration hash uyuşmazlığını atlatmak için yeni migration.

-- AccountEntryType enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountEntryType') THEN
        CREATE TYPE "AccountEntryType" AS ENUM ('SALE', 'PAYMENT');
    END IF;
END $$;

-- PaymentMethod enum'una OPEN_ACCOUNT ekle (yoksa)
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'OPEN_ACCOUNT';

-- AccountEntry tablosu
CREATE TABLE IF NOT EXISTS "AccountEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "AccountEntryType" NOT NULL,
    "product" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountEntry_pkey" PRIMARY KEY ("id")
);

-- AccountEntry indexleri
CREATE INDEX IF NOT EXISTS "AccountEntry_tenantId_customerId_date_idx" ON "AccountEntry"("tenantId", "customerId", "date" DESC);
CREATE INDEX IF NOT EXISTS "AccountEntry_tenantId_type_idx" ON "AccountEntry"("tenantId", "type");
CREATE INDEX IF NOT EXISTS "AccountEntry_tenantId_date_idx" ON "AccountEntry"("tenantId", "date" DESC);

-- Foreign key'ler (DROP CONSTRAINT IF EXISTS ile güvenli ekleme)
ALTER TABLE "AccountEntry" DROP CONSTRAINT IF EXISTS "AccountEntry_tenantId_fkey";
ALTER TABLE "AccountEntry" ADD CONSTRAINT "AccountEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountEntry" DROP CONSTRAINT IF EXISTS "AccountEntry_customerId_fkey";
ALTER TABLE "AccountEntry" ADD CONSTRAINT "AccountEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PrinterStock tablosu (yoksa oluştur)
CREATE TABLE IF NOT EXISTS "PrinterStock" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "condition" TEXT NOT NULL DEFAULT 'SIFIR',
    "color" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "buyPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sellPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "soldAt" TIMESTAMP(3),
    "soldTo" TEXT,
    "soldPrice" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrinterStock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PrinterStock_tenantId_category_idx" ON "PrinterStock"("tenantId", "category");
CREATE INDEX IF NOT EXISTS "PrinterStock_tenantId_brand_idx" ON "PrinterStock"("tenantId", "brand");
CREATE INDEX IF NOT EXISTS "PrinterStock_tenantId_createdAt_idx" ON "PrinterStock"("tenantId", "createdAt" DESC);

ALTER TABLE "PrinterStock" DROP CONSTRAINT IF EXISTS "PrinterStock_tenantId_fkey";
ALTER TABLE "PrinterStock" ADD CONSTRAINT "PrinterStock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FinancialTransaction tablosuna readingId ekle (yoksa)
ALTER TABLE "FinancialTransaction" ADD COLUMN IF NOT EXISTS "readingId" TEXT;
