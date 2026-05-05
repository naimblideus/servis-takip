-- Tenant tablosuna eksik alanlar
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "slug" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_slug_key" ON "Tenant"("slug");

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "logo" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "district" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "taxNumber" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "taxOffice" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "ownerName" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "pricePerBlack" DECIMAL(10,4) DEFAULT 0.40;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "pricePerColor" DECIMAL(10,4) DEFAULT 1.50;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "businessType" TEXT DEFAULT 'general';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "planStartDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "planEndDate" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "isSuspended" BOOLEAN DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "suspendReason" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "maxTicketsPerMonth" INTEGER;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "storageLimitMB" DOUBLE PRECISION DEFAULT 500;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "storageUsedMB" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "adminNotes" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "logoIntegrationEnabled" BOOLEAN DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "logoIntegrationMethod" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "logoApiUrl" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "logoApiKey" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "logoFirmaKodu" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "logoDonemKodu" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "logoDbServer" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "logoDbPort" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "logoDbName" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "logoDbUser" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "logoDbPassEncrypted" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "logoDefaultCariGrup" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "logoDefaultGelirHesap" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "logoKasaHesap" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "logoBankaHesap" TEXT;

-- PaymentMethod enum'una OPEN_ACCOUNT ekleme
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'OPEN_ACCOUNT';

-- FinancialTransaction tablosuna readingId ekleme
ALTER TABLE "FinancialTransaction" ADD COLUMN IF NOT EXISTS "readingId" TEXT;

-- SuperAdmin tablosu
CREATE TABLE IF NOT EXISTS "SuperAdmin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SuperAdmin_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SuperAdmin_email_key" ON "SuperAdmin"("email");

-- SubscriptionHistory tablosu
CREATE TABLE IF NOT EXISTS "SubscriptionHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SubscriptionHistory_tenantId_createdAt_idx" ON "SubscriptionHistory"("tenantId", "createdAt" DESC);
ALTER TABLE "SubscriptionHistory" DROP CONSTRAINT IF EXISTS "SubscriptionHistory_tenantId_fkey";
ALTER TABLE "SubscriptionHistory" ADD CONSTRAINT "SubscriptionHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TenantInvoice tablosu
CREATE TABLE IF NOT EXISTS "TenantInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "vatAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidDate" TIMESTAMP(3),
    "paidAmount" DOUBLE PRECISION,
    "paymentMethod" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantInvoice_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TenantInvoice_tenantId_status_idx" ON "TenantInvoice"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "TenantInvoice_status_dueDate_idx" ON "TenantInvoice"("status", "dueDate");
ALTER TABLE "TenantInvoice" DROP CONSTRAINT IF EXISTS "TenantInvoice_tenantId_fkey";
ALTER TABLE "TenantInvoice" ADD CONSTRAINT "TenantInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PlatformSettings tablosu
CREATE TABLE IF NOT EXISTS "PlatformSettings" (
    "id" TEXT NOT NULL,
    "platformName" TEXT NOT NULL DEFAULT 'Servis Takip',
    "platformLogo" TEXT,
    "contactEmail" TEXT,
    "defaultTrialDays" INTEGER NOT NULL DEFAULT 14,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "announcementText" TEXT,
    "announcementActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- LogoSyncLog tablosu
CREATE TABLE IF NOT EXISTS "LogoSyncLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestData" JSONB,
    "responseData" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LogoSyncLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LogoSyncLog_tenantId_operation_idx" ON "LogoSyncLog"("tenantId", "operation");
CREATE INDEX IF NOT EXISTS "LogoSyncLog_tenantId_status_idx" ON "LogoSyncLog"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "LogoSyncLog_tenantId_createdAt_idx" ON "LogoSyncLog"("tenantId", "createdAt" DESC);
ALTER TABLE "LogoSyncLog" DROP CONSTRAINT IF EXISTS "LogoSyncLog_tenantId_fkey";
ALTER TABLE "LogoSyncLog" ADD CONSTRAINT "LogoSyncLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PrinterStock tablosu
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
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PrinterStock_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PrinterStock_tenantId_category_idx" ON "PrinterStock"("tenantId", "category");
CREATE INDEX IF NOT EXISTS "PrinterStock_tenantId_brand_idx" ON "PrinterStock"("tenantId", "brand");
CREATE INDEX IF NOT EXISTS "PrinterStock_tenantId_createdAt_idx" ON "PrinterStock"("tenantId", "createdAt" DESC);
ALTER TABLE "PrinterStock" DROP CONSTRAINT IF EXISTS "PrinterStock_tenantId_fkey";
ALTER TABLE "PrinterStock" ADD CONSTRAINT "PrinterStock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AccountEntry tablosu (Manuel Muhasebe)
CREATE TYPE "AccountEntryType" AS ENUM ('SALE', 'PAYMENT');

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
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AccountEntry_tenantId_customerId_date_idx" ON "AccountEntry"("tenantId", "customerId", "date" DESC);
CREATE INDEX IF NOT EXISTS "AccountEntry_tenantId_type_idx" ON "AccountEntry"("tenantId", "type");
CREATE INDEX IF NOT EXISTS "AccountEntry_tenantId_date_idx" ON "AccountEntry"("tenantId", "date" DESC);
ALTER TABLE "AccountEntry" DROP CONSTRAINT IF EXISTS "AccountEntry_tenantId_fkey";
ALTER TABLE "AccountEntry" ADD CONSTRAINT "AccountEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountEntry" DROP CONSTRAINT IF EXISTS "AccountEntry_customerId_fkey";
ALTER TABLE "AccountEntry" ADD CONSTRAINT "AccountEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
