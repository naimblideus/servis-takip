-- IDEMPOTENT: AccountEntry.ticketId — servis fisinden otomatik cari kaydi (idempotency + cift sayim onleme)
ALTER TABLE "AccountEntry" ADD COLUMN IF NOT EXISTS "ticketId" TEXT;
CREATE INDEX IF NOT EXISTS "AccountEntry_tenantId_ticketId_idx" ON "AccountEntry"("tenantId", "ticketId");
