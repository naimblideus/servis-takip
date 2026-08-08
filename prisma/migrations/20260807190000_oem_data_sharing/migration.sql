-- Uretici veri paylasimi icin bayi RIZASI. Varsayilan KAPALI.
--
-- SORUN: /api/oem/reliability tum kiracilari kapsama aliyordu — silinmis, pasif ve
-- rizasi olmayan bayiler dahil. Toplulastirilmis ve anonim olsa bile, bayinin
-- verisini kendi TEDARIKCISINE acmak sozlesmesel izin gerektirir. Izin varsayilan
-- olamaz; bu yuzden alan false baslar ve acikca acilmasi gerekir.
--
-- NEDEN SIMDI: geriye donuk riza toplamak pratikte imkansizdir. 30 bayi
-- toplandiktan sonra "verinizi paylasabilir miyim" diye sormak, yarisindan
-- cevap alamamak ve veri havuzunu delik birakmak demektir.
--
-- IDEMPOTENT: apply-migrations.js her acilista tum migration'lari calistirir.

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "oemDataSharing" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "oemDataSharingAt" TIMESTAMP(3);
