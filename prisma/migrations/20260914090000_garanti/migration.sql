-- GARANTI
--
-- Semada garanti alani HIC YOKTU. Musteri sikayetlerinde en yuksek adetli
-- bosluk buydu: teknisyen fis acarken "bu is garanti kapsaminda mi" diye
-- soruyor, cevap hicbir ekranda yok, telefonla soruluyor.
--
-- installedAt (kurulum tarihi) AYNI SEY DEGIL: ikinci el makine, devir
-- alinan park ve uzatilmis garanti — ucunde de kurulum ile garanti
-- ayrisiyor. Kurulumdan turetmek TAHMIN olurdu ve tahmin edilen garanti
-- ya musteriye kapsamdaki isi faturalatir ya bayiye kapsam disi isi
-- bedava yaptirir.
--
-- warrantyNote kapsami yaziyor ("parca haric, iscilik dahil"): garanti
-- "var/yok" degil, neyi kapsadigi tartisma konusu oluyor.
--
-- IDEMPOTENT: apply-migrations.js her acilista tum migration'lari calistirir.

ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "warrantyStart" TIMESTAMP(3);
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "warrantyEnd" TIMESTAMP(3);
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "warrantyNote" TEXT;

-- "Garantisi bitiyor" listesi bu indeksle calisiyor.
CREATE INDEX IF NOT EXISTS "Device_tenantId_warrantyEnd_idx" ON "Device"("tenantId", "warrantyEnd");

-- ALIS KDV'SI
--
-- Gider yalniz TOPLAM tutarla tutuluyordu. KDV ayrilmadan "bu ay ne kadar
-- KDV odeyecegim" sorusu cevaplanamiyor ve bayi her ay bunun icin baska bir
-- programi acmak zorunda kaliyor.
--
-- amount HER ZAMAN KDV DAHIL toplam olarak kaliyor: bayi eline gecen
-- fisteki rakami yaziyor. vatAmount onun ICINDEN ayrilan kisim. Boylece
-- eski kayitlar (vatAmount NULL) bozulmuyor ve hicbir toplam degismiyor.

ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "vatRate" DECIMAL(5,2);
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "vatAmount" DECIMAL(10,2);
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "invoiceNo" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "payeeTaxNo" TEXT;
