-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('SERVICE_FEE', 'COUNTER_FEE', 'RENTAL_FEE', 'PART_PURCHASE', 'PART_SALE', 'GENERAL_EXPENSE', 'SALARY', 'RENT', 'UTILITY', 'OTHER_INCOME', 'OTHER_EXPENSE');

-- AlterTable
ALTER TABLE "CounterReading" ADD COLUMN     "calculatedCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "monthlyRent" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "email" TEXT;

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "isRental" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "monthlyRent" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "pricePerBlack" DECIMAL(10,4),
ADD COLUMN     "pricePerColor" DECIMAL(10,4);

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "address" TEXT,
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "pricePerBlack" DECIMAL(10,4) NOT NULL DEFAULT 0.40,
ADD COLUMN     "pricePerColor" DECIMAL(10,4) NOT NULL DEFAULT 1.50;

-- CreateTable
CREATE TABLE "FinancialTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT,
    "ticketId" TEXT,
    "readingId" TEXT,
    "type" "TransactionType" NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalRows" JSONB,
    "importedRows" JSONB,
    "failedRows" JSONB,
    "errors" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialTransaction_tenantId_type_date_idx" ON "FinancialTransaction"("tenantId", "type", "date" DESC);

-- CreateIndex
CREATE INDEX "FinancialTransaction_tenantId_customerId_idx" ON "FinancialTransaction"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "FinancialTransaction_tenantId_category_idx" ON "FinancialTransaction"("tenantId", "category");

-- CreateIndex
CREATE INDEX "FinancialTransaction_tenantId_date_idx" ON "FinancialTransaction"("tenantId", "date" DESC);

-- CreateIndex
CREATE INDEX "import_sessions_tenantId_status_idx" ON "import_sessions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "import_sessions_tenantId_createdAt_idx" ON "import_sessions"("tenantId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ServiceTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_sessions" ADD CONSTRAINT "import_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
