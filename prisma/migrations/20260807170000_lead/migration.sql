-- Landing formundan gelen talepler kalici olarak saklansin.
--
-- SORUN: /api/talep lead'i Nexus CRM'e aktariyordu; NEXUS_CRM_URL tanimli degilse
-- (CRM canlida degil) lead yalnizca console.warn ile loga yaziliyordu ve konteyner
-- logu donunce kayboluyordu. Ziyaretci "gonderildi" mesajini goruyordu.
-- Yani landing'den gelen HER TALEP sessizce yok oluyordu.
--
-- Tenant'a bagli DEGIL: bunlar henuz musteri olmayan aday bayiler.
-- IDEMPOTENT: apply-migrations.js her acilista tum migration'lari calistirir.

CREATE TABLE IF NOT EXISTS "Lead" (
  "id"          TEXT NOT NULL,
  "firma"       TEXT,
  "yetkili"     TEXT,
  "telefon"     TEXT,
  "eposta"      TEXT,
  "cihazSayisi" TEXT,
  "mesaj"       TEXT,
  "kaynak"      TEXT,
  "kampanya"    TEXT,
  "crmDurum"    TEXT NOT NULL DEFAULT 'bekliyor',
  "okundu"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Lead_okundu_createdAt_idx" ON "Lead"("okundu", "createdAt");
CREATE INDEX IF NOT EXISTS "Lead_createdAt_idx" ON "Lead"("createdAt");
