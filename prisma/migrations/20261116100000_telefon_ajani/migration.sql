-- TELEFON AJANI: bayi başına aç/kapa ayarı + ajanın açtığı iş emri taslakları.
-- Yalnız YENİ tablolar; mevcut tablo ve alanlara dokunulmaz, veri yazılmaz.
-- İdempotent: her açılışta baştan koşar (apply-migrations.js).
-- DDL `prisma migrate diff --from-empty` çıktısından alındı.
CREATE TABLE IF NOT EXISTS "TelefonAjani" (
    "tenantId" TEXT NOT NULL,
    "acik" BOOLEAN NOT NULL DEFAULT false,
    "asistanAdi" TEXT NOT NULL DEFAULT 'Deniz',
    "retellAgentId" TEXT,
    "retellAktarmaAgentId" TEXT,
    "hatNumarasi" TEXT,
    "aktarmaTelefonu" TEXT,
    "retellSenkronAt" TIMESTAMP(3),
    "retellHata" TEXT,
    "degistirenId" TEXT,
    "acildiAt" TIMESTAMP(3),
    "kapandiAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TelefonAjani_pkey" PRIMARY KEY ("tenantId")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TelefonAjani_retellAgentId_key" ON "TelefonAjani"("retellAgentId");
CREATE UNIQUE INDEX IF NOT EXISTS "TelefonAjani_retellAktarmaAgentId_key" ON "TelefonAjani"("retellAktarmaAgentId");
CREATE UNIQUE INDEX IF NOT EXISTS "TelefonAjani_hatNumarasi_key" ON "TelefonAjani"("hatNumarasi");
DO $$ BEGIN
  ALTER TABLE "TelefonAjani" ADD CONSTRAINT "TelefonAjani_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "AjanTaslagi" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kanal" TEXT NOT NULL,
    "kaynakKimlik" TEXT NOT NULL,
    "mesajKimlikleri" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "durum" TEXT NOT NULL DEFAULT 'BEKLIYOR',
    "kapanisYolu" TEXT,
    "arayanSon10" TEXT NOT NULL,
    "customerId" TEXT,
    "deviceId" TEXT,
    "cihazNeden" TEXT,
    "soylenenSeriNo" TEXT,
    "soylenenModel" TEXT,
    "arizaMetni" TEXT NOT NULL,
    "faultCategory" "FaultCategory",
    "arayanAdi" TEXT,
    "firmaAdi" TEXT,
    "acil" BOOLEAN NOT NULL DEFAULT false,
    "bekledigi" TEXT,
    "onerilenTeknisyenId" TEXT,
    "oneriVerisi" JSONB,
    "oneriAt" TIMESTAMP(3),
    "ticketId" TEXT,
    "kararVerenId" TEXT,
    "kararAt" TIMESTAMP(3),
    "redSebebi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AjanTaslagi_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AjanTaslagi_tenantId_kanal_kaynakKimlik_key" ON "AjanTaslagi"("tenantId", "kanal", "kaynakKimlik");
CREATE INDEX IF NOT EXISTS "AjanTaslagi_tenantId_durum_createdAt_idx" ON "AjanTaslagi"("tenantId", "durum", "createdAt");
CREATE INDEX IF NOT EXISTS "AjanTaslagi_tenantId_kanal_arayanSon10_durum_idx" ON "AjanTaslagi"("tenantId", "kanal", "arayanSon10", "durum");
DO $$ BEGIN
  ALTER TABLE "AjanTaslagi" ADD CONSTRAINT "AjanTaslagi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
