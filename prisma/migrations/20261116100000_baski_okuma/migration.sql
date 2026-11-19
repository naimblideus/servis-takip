-- MATBAA SİPARİŞ OKUYUCU: WhatsApp siparişinden okunan iş taslakları.
-- Yalnız yeni tablo; mevcut veri değişmez. İdempotent.
CREATE TABLE IF NOT EXISTS "BaskiOkuma" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kaynak" TEXT NOT NULL,
    "dosyaAdi" TEXT,
    "dosyaBoyut" INTEGER,
    "durum" TEXT NOT NULL DEFAULT 'TASLAK',
    "okunan" JSONB NOT NULL,
    "belirsizSayisi" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT NOT NULL,
    "surum" TEXT NOT NULL,
    "sureMs" INTEGER,
    "girdiToken" INTEGER,
    "ciktiToken" INTEGER,
    "duzeltilenler" JSONB,
    "duzeltmesiz" BOOLEAN,
    "isId" TEXT,
    "okuyanId" TEXT,
    "okuyanAd" TEXT,
    "onaylayanId" TEXT,
    "onaylandiAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BaskiOkuma_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BaskiOkuma_isId_key" ON "BaskiOkuma"("isId");
CREATE INDEX IF NOT EXISTS "BaskiOkuma_tenantId_durum_createdAt_idx" ON "BaskiOkuma"("tenantId", "durum", "createdAt");
DO $$ BEGIN
  ALTER TABLE "BaskiOkuma" ADD CONSTRAINT "BaskiOkuma_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "BaskiOkuma" ADD CONSTRAINT "BaskiOkuma_isId_fkey" FOREIGN KEY ("isId") REFERENCES "BaskiIsi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
