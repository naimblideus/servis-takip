-- Müşteri kiralama sözleşmesi bitiş tarihi (idempotent)
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "contractEndDate" TIMESTAMP(3);
