-- IDEMPOTENT migration (prod drift'e karsi guvenli — tekrar calistirilabilir / kismi-var durumunda patlamaz)

-- CreateEnum (guard'li)
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceStatus') THEN
  CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED');
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceSource') THEN
  CREATE TYPE "InvoiceSource" AS ENUM ('AUTO_MONTHLY', 'TICKET', 'MANUAL');
END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceLineKind') THEN
  CREATE TYPE "InvoiceLineKind" AS ENUM ('COUNTER', 'RENTAL', 'PART', 'LABOR', 'OTHER');
END IF; END $$;

-- AlterTable Tenant
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "autoInvoiceEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "invoiceDayOfMonth" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "nextInvoiceSeq" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "paymentTermDays" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 20;

-- AlterTable Device
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "lastInvoicedPeriod" TEXT;

-- AlterTable ServiceTicket
ALTER TABLE "ServiceTicket"
  ADD COLUMN IF NOT EXISTS "invoiceId" TEXT,
  ADD COLUMN IF NOT EXISTS "invoicedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "laborCost" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable CounterReading
ALTER TABLE "CounterReading"
  ADD COLUMN IF NOT EXISTS "billed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "invoiceLineId" TEXT;

-- AlterTable Payment (yeni kolonlar + ticketId nullable — DROP NOT NULL idempotenttir)
ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "customerId" TEXT,
  ADD COLUMN IF NOT EXISTS "reconciled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "referenceNo" TEXT;
ALTER TABLE "Payment" ALTER COLUMN "ticketId" DROP NOT NULL;

-- AlterTable FinancialTransaction
ALTER TABLE "FinancialTransaction" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT;

-- CreateTable CustomerInvoice
CREATE TABLE IF NOT EXISTS "CustomerInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "vatAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "source" "InvoiceSource" NOT NULL DEFAULT 'AUTO_MONTHLY',
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable InvoiceLine
CREATE TABLE IF NOT EXISTS "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "InvoiceLineKind" NOT NULL,
    "description" TEXT NOT NULL,
    "deviceId" TEXT,
    "readingId" TEXT,
    "ticketId" TEXT,
    "partId" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable InvoicePayment
CREATE TABLE IF NOT EXISTS "InvoicePayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (guard'li)
CREATE INDEX IF NOT EXISTS "CustomerInvoice_tenantId_customerId_status_idx" ON "CustomerInvoice"("tenantId", "customerId", "status");
CREATE INDEX IF NOT EXISTS "CustomerInvoice_tenantId_status_dueDate_idx" ON "CustomerInvoice"("tenantId", "status", "dueDate");
CREATE INDEX IF NOT EXISTS "CustomerInvoice_tenantId_period_idx" ON "CustomerInvoice"("tenantId", "period");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerInvoice_tenantId_invoiceNumber_key" ON "CustomerInvoice"("tenantId", "invoiceNumber");
CREATE INDEX IF NOT EXISTS "InvoiceLine_tenantId_invoiceId_idx" ON "InvoiceLine"("tenantId", "invoiceId");
CREATE INDEX IF NOT EXISTS "InvoiceLine_readingId_idx" ON "InvoiceLine"("readingId");
CREATE INDEX IF NOT EXISTS "InvoiceLine_ticketId_idx" ON "InvoiceLine"("ticketId");
CREATE INDEX IF NOT EXISTS "InvoicePayment_tenantId_invoiceId_idx" ON "InvoicePayment"("tenantId", "invoiceId");
CREATE INDEX IF NOT EXISTS "InvoicePayment_tenantId_paymentId_idx" ON "InvoicePayment"("tenantId", "paymentId");
CREATE INDEX IF NOT EXISTS "Payment_tenantId_customerId_idx" ON "Payment"("tenantId", "customerId");

-- AddForeignKey (DROP IF EXISTS + ADD — idempotent)
ALTER TABLE "ServiceTicket" DROP CONSTRAINT IF EXISTS "ServiceTicket_invoiceId_fkey";
ALTER TABLE "ServiceTicket" ADD CONSTRAINT "ServiceTicket_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_customerId_fkey";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CustomerInvoice" DROP CONSTRAINT IF EXISTS "CustomerInvoice_tenantId_fkey";
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerInvoice" DROP CONSTRAINT IF EXISTS "CustomerInvoice_customerId_fkey";
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvoiceLine" DROP CONSTRAINT IF EXISTS "InvoiceLine_tenantId_fkey";
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvoiceLine" DROP CONSTRAINT IF EXISTS "InvoiceLine_invoiceId_fkey";
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvoicePayment" DROP CONSTRAINT IF EXISTS "InvoicePayment_tenantId_fkey";
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvoicePayment" DROP CONSTRAINT IF EXISTS "InvoicePayment_invoiceId_fkey";
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvoicePayment" DROP CONSTRAINT IF EXISTS "InvoicePayment_paymentId_fkey";
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
