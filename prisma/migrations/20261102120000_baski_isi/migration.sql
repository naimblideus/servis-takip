-- BASKI İŞİ: baskı merkezinin iş kuyruğu (lib/baski-is). Tutarlar kuruş, iş açılınca dondurulur.
CREATE TABLE IF NOT EXISTS "BaskiIsi" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "no" INTEGER NOT NULL,
    "kanal" TEXT NOT NULL DEFAULT 'TEZGAH',
    "durum" TEXT NOT NULL DEFAULT 'SIRADA',
    "acil" BOOLEAN NOT NULL DEFAULT false,
    "bitisGerekli" BOOLEAN NOT NULL DEFAULT false,
    "customerId" TEXT,
    "musteriAd" TEXT,
    "telefon" TEXT,
    "firma" TEXT,
    "vergiNo" TEXT,
    "not" TEXT,
    "sozVerilenAt" TIMESTAMP(3),
    "teslimat" TEXT NOT NULL DEFAULT 'GEL_AL',
    "teslimAdres" TEXT,
    "kdvHaric" INTEGER NOT NULL DEFAULT 0,
    "kdv" INTEGER NOT NULL DEFAULT 0,
    "toplam" INTEGER NOT NULL DEFAULT 0,
    "tahmini" BOOLEAN NOT NULL DEFAULT false,
    "odemeYolu" TEXT,
    "odenen" INTEGER NOT NULL DEFAULT 0,
    "haberVerildiAt" TIMESTAMP(3),
    "teslimAt" TIMESTAMP(3),
    "iptalAt" TIMESTAMP(3),
    "iptalNedeni" TEXT,
    "jeton" TEXT NOT NULL,
    "atananId" TEXT,
    "olusturanId" TEXT,
    "olusturanAd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BaskiIsi_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BaskiIsi_jeton_key" ON "BaskiIsi"("jeton");
CREATE UNIQUE INDEX IF NOT EXISTS "BaskiIsi_tenantId_no_key" ON "BaskiIsi"("tenantId", "no");
CREATE INDEX IF NOT EXISTS "BaskiIsi_tenantId_durum_idx" ON "BaskiIsi"("tenantId", "durum");
CREATE INDEX IF NOT EXISTS "BaskiIsi_tenantId_createdAt_idx" ON "BaskiIsi"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "BaskiIsi_tenantId_customerId_idx" ON "BaskiIsi"("tenantId", "customerId");
DO $$ BEGIN
  ALTER TABLE "BaskiIsi" ADD CONSTRAINT "BaskiIsi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "BaskiIsi" ADD CONSTRAINT "BaskiIsi_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "BaskiKalemi" (
    "id" TEXT NOT NULL,
    "isId" TEXT NOT NULL,
    "urunId" TEXT,
    "urunAd" TEXT NOT NULL,
    "secimler" JSONB NOT NULL DEFAULT '{}',
    "adet" INTEGER NOT NULL,
    "sayfa" INTEGER,
    "enCm" DOUBLE PRECISION,
    "boyCm" DOUBLE PRECISION,
    "birimFiyat" INTEGER NOT NULL,
    "tutar" INTEGER NOT NULL,
    "ozet" TEXT NOT NULL,
    "dokum" JSONB,
    "sira" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BaskiKalemi_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BaskiKalemi_isId_idx" ON "BaskiKalemi"("isId");
DO $$ BEGIN
  ALTER TABLE "BaskiKalemi" ADD CONSTRAINT "BaskiKalemi_isId_fkey" FOREIGN KEY ("isId") REFERENCES "BaskiIsi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "BaskiOlayi" (
    "id" TEXT NOT NULL,
    "isId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tur" TEXT NOT NULL,
    "durumOnce" TEXT,
    "durumSonra" TEXT,
    "metin" TEXT,
    "kullaniciId" TEXT,
    "kullaniciAd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BaskiOlayi_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BaskiOlayi_isId_createdAt_idx" ON "BaskiOlayi"("isId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "BaskiOlayi" ADD CONSTRAINT "BaskiOlayi_isId_fkey" FOREIGN KEY ("isId") REFERENCES "BaskiIsi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "BaskiOdeme" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "isId" TEXT NOT NULL,
    "tutar" INTEGER NOT NULL,
    "yol" TEXT NOT NULL,
    "not" TEXT,
    "aliciId" TEXT,
    "aliciAd" TEXT,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BaskiOdeme_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BaskiOdeme_tenantId_tarih_idx" ON "BaskiOdeme"("tenantId", "tarih");
CREATE INDEX IF NOT EXISTS "BaskiOdeme_isId_idx" ON "BaskiOdeme"("isId");
DO $$ BEGIN
  ALTER TABLE "BaskiOdeme" ADD CONSTRAINT "BaskiOdeme_isId_fkey" FOREIGN KEY ("isId") REFERENCES "BaskiIsi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Cari: baskı işinden otomatik kayıt (lib/baski-cari, idempotent uzlaştırma).
ALTER TABLE "AccountEntry" ADD COLUMN IF NOT EXISTS "baskiIsiId" TEXT;
CREATE INDEX IF NOT EXISTS "AccountEntry_tenantId_baskiIsiId_idx" ON "AccountEntry"("tenantId", "baskiIsiId");
