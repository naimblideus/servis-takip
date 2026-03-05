-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionCategory" ADD VALUE 'MACHINE_PURCHASE';
ALTER TYPE "TransactionCategory" ADD VALUE 'MACHINE_SALE';
ALTER TYPE "TransactionCategory" ADD VALUE 'TAX';
ALTER TYPE "TransactionCategory" ADD VALUE 'FOOD';
ALTER TYPE "TransactionCategory" ADD VALUE 'INSURANCE';
ALTER TYPE "TransactionCategory" ADD VALUE 'FUEL';
ALTER TYPE "TransactionCategory" ADD VALUE 'MAINTENANCE';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "ServiceTicket" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ServiceTicket_tenantId_deletedAt_idx" ON "ServiceTicket"("tenantId", "deletedAt");
