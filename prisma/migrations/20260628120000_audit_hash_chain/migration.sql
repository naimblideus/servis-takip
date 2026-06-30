-- Audit hash-zinciri + aktör alanları (idempotent)
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "actorType" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "actorName" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "prevHash" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "hash" TEXT;
