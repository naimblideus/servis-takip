-- FİŞ SAHA EKLERİ (hepsi isteğe bağlı, boş = girilmedi):
--  hataKodu       makinenin ekranındaki kod (ör. E-02, C2557) — arıza bilgisinin tohumu
--  planlananTarih teknisyenin gideceği gün — mağaza sabah listesi "yarın sizdeyiz"
--  bosKartusAdet  ziyarette toplanan boş kartuş — sayaçsız kaçak toner işareti
ALTER TABLE "ServiceTicket" ADD COLUMN IF NOT EXISTS "hataKodu" TEXT;
ALTER TABLE "ServiceTicket" ADD COLUMN IF NOT EXISTS "planlananTarih" TIMESTAMP(3);
ALTER TABLE "ServiceTicket" ADD COLUMN IF NOT EXISTS "bosKartusAdet" INTEGER;
CREATE INDEX IF NOT EXISTS "ServiceTicket_tenantId_planlananTarih_idx" ON "ServiceTicket"("tenantId", "planlananTarih");
