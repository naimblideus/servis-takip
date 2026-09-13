-- PARÇA ALIŞI VE GERÇEK MALİYET
--
-- Ölçüldü: 688 parçanın 670'inde alış fiyatı sıfır, 8.188 fiş kullanımı bu
-- sıfırlarla maliyetleniyordu. Alış fiyatı tek bir sayıydı ve bayi aynı
-- toneri üç ayrı yerden üç ayrı fiyata aldığı için o alan ya boş kalıyor ya
-- son fiyatla eziliyordu.

CREATE TABLE "PartPurchase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "supplier" TEXT,
    "invoiceNo" TEXT,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "avgAfter" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartPurchase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartPurchase_tenantId_partId_purchasedAt_idx" ON "PartPurchase"("tenantId", "partId", "purchasedAt");
CREATE INDEX "PartPurchase_tenantId_purchasedAt_idx" ON "PartPurchase"("tenantId", "purchasedAt");
CREATE INDEX "PartPurchase_tenantId_supplier_idx" ON "PartPurchase"("tenantId", "supplier");

ALTER TABLE "PartPurchase" ADD CONSTRAINT "PartPurchase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartPurchase" ADD CONSTRAINT "PartPurchase_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hareketli ağırlıklı ortalama maliyet.
ALTER TABLE "Part" ADD COLUMN "avgCost" DECIMAL(10,2);

-- Elde alış kaydı yok; bilinen tek şey son alış fiyatı. Onu başlangıç
-- ortalaması sayıyoruz — sıfır olanlara DOKUNMUYORUZ, çünkü sıfır bir
-- maliyet değil "girilmemiş" demek ve raporda öyle görünmesi gerekiyor.
UPDATE "Part" SET "avgCost" = "buyPrice" WHERE "buyPrice" > 0;

-- Kullanım anındaki maliyet. Eski satırlarda NULL kalıyor: o fişin o
-- günkü maliyetini bilmiyoruz ve bugünkü fiyatı geçmişe yazmak, geçmiş
-- kârlılığı sessizce değiştirirdi.
ALTER TABLE "TicketPart" ADD COLUMN "unitCost" DECIMAL(10,2);
