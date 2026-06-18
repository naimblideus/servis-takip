-- IDEMPOTENT: Device.barcode — cihazın üstündeki mevcut barkodu sisteme dahil et (okutunca cihaz açılır)
-- Tenant içinde tekil (aynı barkod iki cihaza verilemez); NULL barkodlar Postgres'te çakışmaz.
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "barcode" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Device_tenantId_barcode_key" ON "Device"("tenantId", "barcode");
