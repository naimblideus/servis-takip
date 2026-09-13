-- e-FATURA GONDERIM
--
-- Hangi ozel entegratorle calisilacagi TICARI bir karar ve henuz
-- verilmedi. O karar beklenirken gonderim hattinin GERI KALANI yazilip
-- test edilebilir: numara atama, durum makinesi, hata gosterimi, tekrar
-- deneme. Karar verilince yazilacak tek sey arayuzun bir uygulamasi.
--
-- PAROLA SIFRELI (AES-256-GCM, lib/sir.ts). Sifreleme anahtari
-- tanimli degilse parola HIC KAYDEDILMIYOR, duz metne dusmuyor: duz
-- parola yedeklere, loglara ve veritabani dokumlerine sizar ve "simdilik
-- boyle kalsin" diye birakilan duz parola en uzun yasayan seydir.
--
-- TEST MODU VARSAYILAN ACIK. Yanlislikla gercek fatura gondermek geri
-- alinamaz; bayi bilerek kapatmali.
--
-- IDEMPOTENT: apply-migrations.js her acilista tum migration'lari calistirir.

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "eFaturaSaglayici" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "eFaturaKullanici" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "eFaturaParola" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "eFaturaTestModu" BOOLEAN NOT NULL DEFAULT true;
