-- RAKİPLERDE OLUP BİZDE OLMAYAN (Printlio, Paperpan) — 2026-10-18:
--  · Emanet defteri: müşteride duran yedek toner/parça (EmanetHareketi).
--  · Parça ömrü: parça kartında ömür (sayfa), fişte takıldığı sayaç.
--  · Memnuniyet anketi (NPS): servis bitince 0–10 (MemnuniyetAnketi).
--  · Sahada geçen süre: teknisyen "Vardım" / "Çıktım" (konum tutulmaz).
--  · Sayaçsız kapanmaz: kiralık cihazın fişi sayaçsız teslim edilmesin (bayi açarsa).
-- Göçler her açılışta yeniden koşar: IF NOT EXISTS.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "sayacZorunlu" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "omurSayfa" INTEGER;
ALTER TABLE "TicketPart" ADD COLUMN IF NOT EXISTS "takilmaSayaci" INTEGER;
ALTER TABLE "ServiceTicket" ADD COLUMN IF NOT EXISTS "varisAt" TIMESTAMP(3);
ALTER TABLE "ServiceTicket" ADD COLUMN IF NOT EXISTS "ayrilisAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "EmanetHareketi" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "partId" TEXT,
  "parcaAdi" TEXT NOT NULL,
  "tur" TEXT NOT NULL,
  "adet" INTEGER NOT NULL,
  "bosAdet" INTEGER NOT NULL DEFAULT 0,
  "birimMaliyet" DECIMAL(10,2),
  "deviceId" TEXT,
  "tonerChangeId" TEXT,
  "kullaniciId" TEXT,
  "not" TEXT,
  "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmanetHareketi_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmanetHareketi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EmanetHareketi_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EmanetHareketi_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmanetHareketi_tonerChangeId_key" ON "EmanetHareketi"("tonerChangeId");
CREATE INDEX IF NOT EXISTS "EmanetHareketi_tenantId_customerId_partId_idx" ON "EmanetHareketi"("tenantId", "customerId", "partId");
CREATE INDEX IF NOT EXISTS "EmanetHareketi_tenantId_tarih_idx" ON "EmanetHareketi"("tenantId", "tarih");

CREATE TABLE IF NOT EXISTS "MemnuniyetAnketi" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "deviceId" TEXT,
  "teknisyenId" TEXT,
  "puan" INTEGER,
  "yorum" TEXT,
  "kanal" TEXT,
  "gonderildiAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cevaplandiAt" TIMESTAMP(3),
  "arandiAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemnuniyetAnketi_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MemnuniyetAnketi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "MemnuniyetAnketi_ticketId_key" ON "MemnuniyetAnketi"("ticketId");
CREATE INDEX IF NOT EXISTS "MemnuniyetAnketi_tenantId_cevaplandiAt_idx" ON "MemnuniyetAnketi"("tenantId", "cevaplandiAt");
CREATE INDEX IF NOT EXISTS "MemnuniyetAnketi_tenantId_teknisyenId_idx" ON "MemnuniyetAnketi"("tenantId", "teknisyenId");
CREATE INDEX IF NOT EXISTS "MemnuniyetAnketi_tenantId_customerId_idx" ON "MemnuniyetAnketi"("tenantId", "customerId");
