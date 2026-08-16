-- CIHAZIN BILDIRDIGI SERI
--
-- Sayac e-postasi cihazi SERI NUMARASINDAN buluyor. Sistemdeki seri ile
-- cihazin maile yazdigi seri bir harf bile farkliysa eslesme olmaz ve rapor
-- her ay sessizce kuyruga duser. Kiralik filoda en pahali sessiz ariza budur:
-- otomasyon kurulmus GORUNUR ama hic calismaz, kimse aylarca fark etmez.
--
-- Iki sebep var:
--   1. Elle eklerken yanlis girilmis (O/0, I/1 karisikligi)
--   2. Cihaz etiketteki seriyi degil ic seri numarasini yaziyor
--
-- Cozum: bayi kuyrukta bir kez elle eslestirince, e-postadaki seri buraya
-- yazilir ve sonraki aylar otomatik akar. serialNo'ya DOKUNULMAZ — o etiketteki
-- deger ve teknisyen sahada onu okuyor; ustune yazmak sahayi yaniltir.
--
-- IDEMPOTENT: apply-migrations.js her acilista tum migration'lari calistirir.

ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "reportedSerial" TEXT;

-- Arama bu kolon uzerinden de yapilacak; tenant ile birlikte indekslenir.
CREATE INDEX IF NOT EXISTS "Device_tenantId_reportedSerial_idx"
  ON "Device"("tenantId", "reportedSerial");
