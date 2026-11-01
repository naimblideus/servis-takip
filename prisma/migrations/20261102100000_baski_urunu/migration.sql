-- BASKI ÜRÜNÜ: baskı merkezinin fiyat listesi (lib/baski-fiyat). Tutarlar kuruş.
CREATE TABLE IF NOT EXISTS "BaskiUrunu" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "kategori" TEXT NOT NULL DEFAULT 'DIGER',
    "fiyatModeli" TEXT NOT NULL DEFAULT 'ADET',
    "kademeler" JSONB NOT NULL DEFAULT '[]',
    "secenekler" JSONB NOT NULL DEFAULT '[]',
    "minTutar" INTEGER NOT NULL DEFAULT 0,
    "kdvOrani" INTEGER NOT NULL DEFAULT 20,
    "kdvDahil" BOOLEAN NOT NULL DEFAULT true,
    "yuvarlama" INTEGER NOT NULL DEFAULT 0,
    "teslimSaat" INTEGER,
    "dosyaGerekli" BOOLEAN NOT NULL DEFAULT true,
    "online" BOOLEAN NOT NULL DEFAULT true,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "sablonKodu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BaskiUrunu_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BaskiUrunu_tenantId_sablonKodu_key" ON "BaskiUrunu"("tenantId", "sablonKodu");
CREATE INDEX IF NOT EXISTS "BaskiUrunu_tenantId_aktif_sira_idx" ON "BaskiUrunu"("tenantId", "aktif", "sira");
DO $$ BEGIN
  ALTER TABLE "BaskiUrunu" ADD CONSTRAINT "BaskiUrunu_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
