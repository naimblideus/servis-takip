-- WhatsApp gelen mesaj katmani (Meta Cloud API webhook)
--
-- NE ISE YARAR: Musteri bayinin WhatsApp isletme numarasina yazdiginda, gelen
-- numara sistemdeki musteriyle eslestirilir. Bayi "kim yazdi, hangi cihazlari var,
-- acik fisi var mi" bilgisini gorur; eslesmezse tek dokunusla musteri olarak ekler.
--
-- NEDEN TENANT'A phone_number_id: Webhook her mesajda metadata.phone_number_id gonderir.
-- Cok kiracili sistemde gelen mesajin HANGI bayiye ait oldugunu anlamanin tek yolu budur.
--
-- IDEMPOTENT: apply-migrations.js her acilista tum migration'lari calistirir,
-- bu yuzden her ifade IF NOT EXISTS ile yazilmistir.

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "whatsappPhoneId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_whatsappPhoneId_key"
  ON "Tenant"("whatsappPhoneId");

CREATE TABLE IF NOT EXISTS "WhatsAppMessage" (
  "id"          TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "customerId"  TEXT,
  "waMessageId" TEXT NOT NULL,
  "fromPhone"   TEXT NOT NULL,
  "contactName" TEXT,
  "text"        TEXT,
  "mediaId"     TEXT,
  "mediaType"   TEXT,
  "receivedAt"  TIMESTAMP(3) NOT NULL,
  "handled"     BOOLEAN NOT NULL DEFAULT false,
  "ticketId"    TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- Ayni webhook birden fazla kez gelebilir (Meta yeniden dener) -> mesaj kimligi benzersiz.
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppMessage_waMessageId_key"
  ON "WhatsAppMessage"("waMessageId");

CREATE INDEX IF NOT EXISTS "WhatsAppMessage_tenantId_handled_receivedAt_idx"
  ON "WhatsAppMessage"("tenantId", "handled", "receivedAt");

CREATE INDEX IF NOT EXISTS "WhatsAppMessage_tenantId_fromPhone_idx"
  ON "WhatsAppMessage"("tenantId", "fromPhone");

CREATE INDEX IF NOT EXISTS "WhatsAppMessage_customerId_idx"
  ON "WhatsAppMessage"("customerId");

-- Foreign key'ler: ayni migration iki kez calisirsa hata vermesin diye kosullu eklenir.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WhatsAppMessage_tenantId_fkey') THEN
    ALTER TABLE "WhatsAppMessage"
      ADD CONSTRAINT "WhatsAppMessage_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WhatsAppMessage_customerId_fkey') THEN
    ALTER TABLE "WhatsAppMessage"
      ADD CONSTRAINT "WhatsAppMessage_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
