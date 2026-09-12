-- MUSTERI FATURA KIMLIGI
--
-- Fatura, musterinin gunluk adiyla degil TESCILLI UNVANIYLA kesilir ve
-- adresin il/ilce kismi ayri alan olarak istenir. Bizde her ikisi de tek
-- serbest metin alanindaydi (name, address). Serbest metinden unvan ya da
-- ilce ayristirmak TAHMIN olurdu; tahmin edilen bir unvanla fatura kesmek
-- yanlis fatura kesmektir. Bu yuzden sorulup saklaniyor.
--
-- eInvoiceUser UC DEGERLI ve bu bilerek boyle:
--   null  = hic sorulmadi
--   false = soruldu, mukellef degil  -> e-Arsiv (e-postayla gider)
--   true  = soruldu, mukellef        -> e-Fatura (sistem uzerinden gider)
-- Varsayilani false yapsaydik "sorulmamis" ile "mukellef degil" ayni sey
-- olurdu ve mukellef bir musteriye e-Arsiv kesilirdi. Musteri sonradan
-- mukellef olabildigi icin sorgu tarihi de tutuluyor: ne zaman bakildigi
-- bilinmeden "degil" cevabina guvenilmez.
--
-- IDEMPOTENT: apply-migrations.js her acilista tum migration'lari calistirir.

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "legalName" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "taxOffice" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "district" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "eInvoiceUser" BOOLEAN;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "eInvoiceCheckedAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "eInvoiceAlias" TEXT;
