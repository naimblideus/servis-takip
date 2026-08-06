-- WhatsApp aksiyon alanlari: sayac fotografi, ariza bildirimi, otomatik cevap.
--
-- readingId     : gelen fotograftan sayac okumasi kaydedildiyse hangi okuma oldugu
-- isFaultReport : metin ariza bildirimine benziyorsa isaretlenir (gelen kutusunda one cikar)
-- autoReplied   : otomatik cevap gonderildi mi — ayni mesaja iki kez cevap gitmesini onler
--
-- IDEMPOTENT: apply-migrations.js her acilista tum migration'lari calistirir.

ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "readingId" TEXT;
ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "isFaultReport" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "autoReplied" BOOLEAN NOT NULL DEFAULT false;

-- Gelen kutusunda "ariza bildirimleri once" siralamasi icin
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_tenantId_isFaultReport_idx"
  ON "WhatsAppMessage"("tenantId", "isFaultReport");
