-- MUSTERI PORTALI
--
-- NE ISE YARAR: bayinin musterisi kendi cihazlarini, servis fislerini ve
-- bakiyesini gorur; ariza bildirir, sayac okumasi gonderir. Bayiye gelen
-- "cihazim ne durumda / ne kadar borcum var" telefonlarini kesen sey budur.
--
-- NEDEN SIFRE YOK: bayinin musterisi (ofis, muhasebeci, klinik) bir parola
-- daha yonetmez. Yonetmeyince portali kullanmaz, kullanmayinca portal olmamis
-- olur. Erisim 32 baytlik tahmin edilemez bir jetonla; sizarsa bayi tek tikla
-- yeniler ve eskisi ANINDA gecersiz olur.
--
-- portalEnabled VARSAYILAN FALSE: bayi acmadan hicbir musterinin portali yok.
-- Toplu bir goc ile herkese link acilmasi, bayinin haberi olmadan veri
-- yayinlamak olurdu.
--
-- PortalRequest NEDEN VAR: portaldan gelen veri GUVENILMEYEN girdidir. Musteri
-- yanlis sayac yazabilir, ayni arizayi uc kez bildirebilir. WhatsApp onerisiyle
-- ayni kural: sistem ONERIR, bayi onaylar. Onaylaninca gercek fis/okuma acilir.
--
-- IDEMPOTENT: apply-migrations.js her acilista tum migration'lari calistirir.

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "portalToken"    TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "portalEnabled"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "portalTokenAt"  TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "portalLastSeen" TIMESTAMP(3);

-- Jeton benzersiz olmali: iki musteri ayni baglantiya dusemez.
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_portalToken_key" ON "Customer"("portalToken");

CREATE TABLE IF NOT EXISTS "PortalRequest" (
  "id"         TEXT NOT NULL,
  "tenantId"   TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "deviceId"   TEXT,
  "tur"        TEXT NOT NULL,
  "aciklama"   TEXT,
  "sayacBlack" INTEGER,
  "sayacColor" INTEGER,
  "durum"      TEXT NOT NULL DEFAULT 'BEKLIYOR',
  "ticketId"   TEXT,
  "readingId"  TEXT,
  "notu"       TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "islenenAt"  TIMESTAMP(3),
  CONSTRAINT "PortalRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PortalRequest_tenantId_durum_createdAt_idx"
  ON "PortalRequest"("tenantId", "durum", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "PortalRequest_customerId_idx"
  ON "PortalRequest"("customerId");

-- FK'ler: ayni migration iki kez kosarsa hata vermesin diye kontrollu ekleniyor.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PortalRequest_tenantId_fkey') THEN
    ALTER TABLE "PortalRequest" ADD CONSTRAINT "PortalRequest_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PortalRequest_customerId_fkey') THEN
    ALTER TABLE "PortalRequest" ADD CONSTRAINT "PortalRequest_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PortalRequest_deviceId_fkey') THEN
    ALTER TABLE "PortalRequest" ADD CONSTRAINT "PortalRequest_deviceId_fkey"
      FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
