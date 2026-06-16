-- IDEMPOTENT: AccountEntry — satisi/kaydi yapan kullanici (teknisyen) bilgisi
ALTER TABLE "AccountEntry" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
ALTER TABLE "AccountEntry" ADD COLUMN IF NOT EXISTS "createdByName" TEXT;
