-- TEKLİF — aday müşterinin filosunu değerlendirip fiyat çıkarmak.
-- Teklif, ölçülen sayfa maliyeti ve hedef marjdan çıkıyor; pazarlık
-- hissinden değil.
CREATE TABLE "Teklif" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "teklifNo" TEXT NOT NULL,
    "musteriAdi" TEXT NOT NULL,
    "customerId" TEXT,
    "yetkili" TEXT,
    "telefon" TEXT,
    "eposta" TEXT,
    "durum" TEXT NOT NULL DEFAULT 'TASLAK',
    "gecerlilikGun" INTEGER NOT NULL DEFAULT 30,
    "hedefMarj" DECIMAL(5,4),
    "notlar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teklif_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeklifSatiri" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "teklifId" TEXT NOT NULL,
    "marka" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "adet" INTEGER NOT NULL DEFAULT 1,
    "aylikSayfaSb" INTEGER NOT NULL,
    "aylikSayfaRenkli" INTEGER NOT NULL DEFAULT 0,
    "mevcutAylikTutar" DECIMAL(10,2),
    "onerilenKira" DECIMAL(10,2),
    "onerilenSayfaSb" DECIMAL(10,4),
    "onerilenSayfaRenkli" DECIMAL(10,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeklifSatiri_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Teklif_tenantId_teklifNo_key" ON "Teklif"("tenantId", "teklifNo");
CREATE INDEX "Teklif_tenantId_durum_createdAt_idx" ON "Teklif"("tenantId", "durum", "createdAt");
CREATE INDEX "TeklifSatiri_tenantId_teklifId_idx" ON "TeklifSatiri"("tenantId", "teklifId");

ALTER TABLE "Teklif" ADD CONSTRAINT "Teklif_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Teklif" ADD CONSTRAINT "Teklif_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeklifSatiri" ADD CONSTRAINT "TeklifSatiri_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeklifSatiri" ADD CONSTRAINT "TeklifSatiri_teklifId_fkey" FOREIGN KEY ("teklifId") REFERENCES "Teklif"("id") ON DELETE CASCADE ON UPDATE CASCADE;
