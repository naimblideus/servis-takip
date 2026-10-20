-- KURULUM VE BAŞARI + SORUN BİLDİR + SÜPER ADMİN ROLÜ (2026-10-20).
-- Göçler her açılışta yeniden koşar: IF NOT EXISTS.
ALTER TABLE "SuperAdmin" ADD COLUMN IF NOT EXISTS "rol" TEXT NOT NULL DEFAULT 'SAHIP';

CREATE TABLE IF NOT EXISTS "KurulumTakip" (
  "tenantId" TEXT NOT NULL,
  "sorumluId" TEXT,
  "sorumluAd" TEXT,
  "sonrakiTemas" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KurulumTakip_pkey" PRIMARY KEY ("tenantId"),
  CONSTRAINT "KurulumTakip_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "KurulumNotu" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "yazanId" TEXT,
  "yazanAd" TEXT NOT NULL,
  "tur" TEXT NOT NULL,
  "metin" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KurulumNotu_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KurulumNotu_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "KurulumNotu_tenantId_createdAt_idx" ON "KurulumNotu"("tenantId", "createdAt");

CREATE TABLE IF NOT EXISTS "SorunBildirimi" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "kullaniciId" TEXT,
  "kullaniciAd" TEXT,
  "rol" TEXT,
  "tur" TEXT NOT NULL,
  "neYapiyordu" TEXT,
  "neOldu" TEXT NOT NULL,
  "sayfa" TEXT,
  "ekran" TEXT,
  "tarayici" TEXT,
  "ekranGoruntusu" TEXT,
  "demo" BOOLEAN NOT NULL DEFAULT false,
  "durum" TEXT NOT NULL DEFAULT 'YENI',
  "kutu" TEXT,
  "yoneticiNotu" TEXT,
  "cozulduAt" TIMESTAMP(3),
  "bildirildiAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SorunBildirimi_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SorunBildirimi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SorunBildirimi_durum_createdAt_idx" ON "SorunBildirimi"("durum", "createdAt");
CREATE INDEX IF NOT EXISTS "SorunBildirimi_tenantId_createdAt_idx" ON "SorunBildirimi"("tenantId", "createdAt");
