-- IDEMPOTENT: Part.barcode (2D imager barkod okuyucu ile hızlı arama)
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "barcode" TEXT;

-- tenant-scoped unique (Postgres'te birden çok NULL serbest -> barkodsuz parçalar sorun değil)
CREATE UNIQUE INDEX IF NOT EXISTS "Part_tenantId_barcode_key" ON "Part"("tenantId", "barcode");
CREATE INDEX IF NOT EXISTS "Part_tenantId_barcode_idx" ON "Part"("tenantId", "barcode");
