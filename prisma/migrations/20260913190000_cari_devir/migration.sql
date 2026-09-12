-- CARI DEVIR (acilis bakiyesi) — tekrar yuklemeye karsi koruma
--
-- Baska programdan gelen bayinin musterileri gec aninda zaten borclu. O
-- borc aktarilmazsa ilk gun butun musteriler 0 gorunur ve bayi Muhasebe
-- ekranina bir daha guvenmez.
--
-- NEDEN VERITABANI SEVIYESINDE: bayi ayni dosyayi iki kez yuklerse borc
-- ikiye katlanir ve bunu kimse fark etmez — mustericiye iki kat borc
-- gorunur, bayi "program yanlis hesapliyor" der. Kodda kontrol etmek
-- yetmez; es zamanli iki istek ikisini de yazabilir. Tekillik kisiti
-- veritabaninda.
--
-- Anahtar bicimi "acilis:<customerId>": musteri basina TEK acilis
-- bakiyesi. Ikinci yukleme ayni anahtari uretir ve GUNCELLER, yenisini
-- eklemez.
--
-- IDEMPOTENT: apply-migrations.js her acilista tum migration'lari calistirir.

ALTER TABLE "AccountEntry" ADD COLUMN IF NOT EXISTS "importKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "AccountEntry_tenantId_importKey_key"
  ON "AccountEntry"("tenantId", "importKey");
