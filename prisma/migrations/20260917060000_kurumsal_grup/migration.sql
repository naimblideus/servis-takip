-- Kurumsal grup: büyük hesabın şubelerini bir arada gösteren çatı.
-- Grubun kendi faturası/sözleşmesi/carisi YOKTUR; yalnız raporu birleştirir.
CREATE TABLE IF NOT EXISTS "CustomerGroup" (
  "id"        TEXT NOT NULL,
  "tenantId"  TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "note"      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerGroup_tenantId_name_key" ON "CustomerGroup"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "CustomerGroup_tenantId_idx" ON "CustomerGroup"("tenantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CustomerGroup_tenantId_fkey'
  ) THEN
    ALTER TABLE "CustomerGroup"
      ADD CONSTRAINT "CustomerGroup_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "groupId" TEXT;
CREATE INDEX IF NOT EXISTS "Customer_tenantId_groupId_idx" ON "Customer"("tenantId", "groupId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Customer_groupId_fkey'
  ) THEN
    ALTER TABLE "Customer"
      ADD CONSTRAINT "Customer_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "CustomerGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
