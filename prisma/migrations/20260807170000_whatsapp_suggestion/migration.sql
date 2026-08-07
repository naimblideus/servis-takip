-- WhatsApp mesajından fiş ÖNERİSİ (idempotent)
--
-- Sistem mesajı okuyup "hangi cihaz, hangi arıza" önerir; fişi ASLA kendi açmaz.
-- Bayi tek dokunuşla onaylar. Bu, hem işi hızlandırır hem de ETİKET üretir:
-- önerilen değer burada, seçilen değer açılan fişte durur — ikisinin farkı eval verisidir.
--
-- Not: "kabul edildi mi" diye ayrı bir alan YOK. Fiş zaten gerçeği taşıyor;
-- ikinci bir doğruluk kaynağı tutmak, ikisinin çelişmesi riskini doğurur.

ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "suggestedDeviceId" TEXT;
ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "suggestedCategory" "FaultCategory";
ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "suggestionConfidence" DOUBLE PRECISION;
ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "suggestionSource" TEXT;
ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "suggestionVersion" TEXT;

-- Öneri kalitesini ölçmek için: hangi mesajlarda öneri üretildi, hangi kaynaktan
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_tenantId_suggestionSource_idx"
  ON "WhatsAppMessage"("tenantId", "suggestionSource");
