-- DİSTRİBÜTÖR PANELİ (2026-10-21): rol + marka, bayinin adıyla görünme izni, duyurular.
-- Göçler her açılışta yeniden koşar: IF NOT EXISTS.
ALTER TABLE "SuperAdmin" ADD COLUMN IF NOT EXISTS "marka" TEXT;
ALTER TABLE "SuperAdmin" ADD COLUMN IF NOT EXISTS "kurumAd" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "markaAdIzni" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "markaAdIzniAt" TIMESTAMP(3);
CREATE TABLE IF NOT EXISTS "MarkaDuyurusu" (
  "id" TEXT NOT NULL,
  "marka" TEXT NOT NULL,
  "kurumAd" TEXT NOT NULL,
  "baslik" TEXT NOT NULL,
  "metin" TEXT NOT NULL,
  "baglanti" TEXT,
  "yazanId" TEXT,
  "bitis" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarkaDuyurusu_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MarkaDuyurusu_marka_createdAt_idx" ON "MarkaDuyurusu"("marka", "createdAt");
