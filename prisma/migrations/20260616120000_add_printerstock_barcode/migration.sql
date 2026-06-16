-- IDEMPOTENT: PrinterStock.barcode (okuyucuyla satis + Zebra etiket basimi icin)
-- Unique index: ayni tenant'ta ayni barkod iki kez olamaz. NULL barkodlar Postgres'te cakismaz.
ALTER TABLE "PrinterStock" ADD COLUMN IF NOT EXISTS "barcode" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "PrinterStock_tenantId_barcode_key" ON "PrinterStock"("tenantId", "barcode");
