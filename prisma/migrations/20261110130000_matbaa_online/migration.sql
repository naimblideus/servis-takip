-- MATBAA: sipariş sayfası ayarı, dosyalar (R2), prova, gün sonu.
-- Yalnız yeni tablolar; mevcut veri değişmez. İdempotent.
CREATE TABLE IF NOT EXISTS "MatbaaAyar" (
    "tenantId" TEXT NOT NULL,
    "kisaAd" TEXT,
    "siparisAcik" BOOLEAN NOT NULL DEFAULT false,
    "calismaSaatleri" TEXT,
    "hazirlamaSaat" INTEGER NOT NULL DEFAULT 2,
    "havaleKabul" BOOLEAN NOT NULL DEFAULT true,
    "saklamaGun" INTEGER NOT NULL DEFAULT 30,
    "karsilamaMetni" TEXT,
    "karsilamaKopyalandiAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MatbaaAyar_pkey" PRIMARY KEY ("tenantId")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MatbaaAyar_kisaAd_key" ON "MatbaaAyar"("kisaAd");
DO $$ BEGIN
  ALTER TABLE "MatbaaAyar" ADD CONSTRAINT "MatbaaAyar_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "BaskiDosyasi" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "isId" TEXT NOT NULL,
    "tur" TEXT NOT NULL DEFAULT 'BASKI',
    "anahtar" TEXT NOT NULL,
    "yuklemeId" TEXT,
    "ad" TEXT NOT NULL,
    "boyut" INTEGER NOT NULL,
    "mime" TEXT NOT NULL,
    "sayfaSayisi" INTEGER,
    "olcu" TEXT,
    "uyarilar" JSONB NOT NULL DEFAULT '[]',
    "durum" TEXT NOT NULL DEFAULT 'YUKLENIYOR',
    "yukleyen" TEXT NOT NULL DEFAULT 'MUSTERI',
    "yukleyenAd" TEXT,
    "silindiAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BaskiDosyasi_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BaskiDosyasi_isId_idx" ON "BaskiDosyasi"("isId");
CREATE INDEX IF NOT EXISTS "BaskiDosyasi_tenantId_durum_createdAt_idx" ON "BaskiDosyasi"("tenantId", "durum", "createdAt");
DO $$ BEGIN
  ALTER TABLE "BaskiDosyasi" ADD CONSTRAINT "BaskiDosyasi_isId_fkey" FOREIGN KEY ("isId") REFERENCES "BaskiIsi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "BaskiProva" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "isId" TEXT NOT NULL,
    "dosyaId" TEXT,
    "jeton" TEXT NOT NULL,
    "sonTarih" TIMESTAMP(3) NOT NULL,
    "durum" TEXT NOT NULL DEFAULT 'BEKLIYOR',
    "musteriNotu" TEXT,
    "yanitAt" TIMESTAMP(3),
    "gonderenAd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BaskiProva_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BaskiProva_jeton_key" ON "BaskiProva"("jeton");
CREATE INDEX IF NOT EXISTS "BaskiProva_isId_createdAt_idx" ON "BaskiProva"("isId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "BaskiProva" ADD CONSTRAINT "BaskiProva_isId_fkey" FOREIGN KEY ("isId") REFERENCES "BaskiIsi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "BaskiProva" ADD CONSTRAINT "BaskiProva_dosyaId_fkey" FOREIGN KEY ("dosyaId") REFERENCES "BaskiDosyasi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "BaskiKasaKapanis" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "gun" TEXT NOT NULL,
    "nakit" INTEGER NOT NULL,
    "kart" INTEGER NOT NULL DEFAULT 0,
    "havale" INTEGER NOT NULL DEFAULT 0,
    "sayilan" INTEGER NOT NULL,
    "fark" INTEGER NOT NULL,
    "not" TEXT,
    "kapatanId" TEXT,
    "kapatanAd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BaskiKasaKapanis_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BaskiKasaKapanis_tenantId_gun_key" ON "BaskiKasaKapanis"("tenantId", "gun");
DO $$ BEGIN
  ALTER TABLE "BaskiKasaKapanis" ADD CONSTRAINT "BaskiKasaKapanis_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
