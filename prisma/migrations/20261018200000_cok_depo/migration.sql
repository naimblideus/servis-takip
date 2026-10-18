-- ÇOK DEPO VE TEKNİSYEN ARACI (2026-10-18).
-- Part.stockQty toplam stok olarak kalır; ana depo = toplam − Σ DepoStok.
-- Göçler her açılışta yeniden koşar: IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS "Depo" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "ad" TEXT NOT NULL,
  "tur" TEXT NOT NULL,
  "kullaniciId" TEXT,
  "aktif" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Depo_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Depo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Depo_tenantId_ad_key" ON "Depo"("tenantId", "ad");
CREATE INDEX IF NOT EXISTS "Depo_tenantId_kullaniciId_idx" ON "Depo"("tenantId", "kullaniciId");

CREATE TABLE IF NOT EXISTS "DepoStok" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "depoId" TEXT NOT NULL,
  "partId" TEXT NOT NULL,
  "adet" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DepoStok_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DepoStok_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DepoStok_depoId_fkey" FOREIGN KEY ("depoId") REFERENCES "Depo"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DepoStok_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "DepoStok_depoId_partId_key" ON "DepoStok"("depoId", "partId");
CREATE INDEX IF NOT EXISTS "DepoStok_tenantId_partId_idx" ON "DepoStok"("tenantId", "partId");

ALTER TABLE "TicketPart" ADD COLUMN IF NOT EXISTS "depoId" TEXT;
