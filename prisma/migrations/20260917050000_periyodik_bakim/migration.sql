-- PERİYODİK BAKIM PLANI
--
-- Fotokopi bakımı takvimle değil SAYAÇLA gelir: üretici bakım kitini sayfa
-- sayısına bağlar (Kyocera MK 300.000, HP bakım kiti 225.000 gibi). Bayi bu
-- eşiği takip etmediğinde bakım ya çok erken yapılır (boşa parça, boşa yol)
-- ya da kaçar — ve kaçan bakım, sözleşmedeki müdahale süresini tutturmayı
-- imkânsız kılan arızaya döner.
--
-- İKİ YER:
--   Tenant.pmDefault*   = filo geneli politika. Yüzlerce cihaza tek tek eşik
--                         girmek kimsenin yapmayacağı bir iştir.
--   Device.pmInterval*  = o cihaza özel eşik (varsa varsayılanı ezer).
--   Device.lastPm*      = son bakımın REFERANSI (tarih + sayaç). Bu ikisi
--                         olmadan "ne kadar basıldı" hesaplanamaz.
--
-- Hepsi NULL varsayılan ve BİLEREK: eşik uydurmak, bakımı yanlış güne
-- koymaktan daha kötüdür. Politikası olmayan cihaz ekranda "zamanı gelmedi"
-- diye YEŞİL görünmez, "bilinmiyor" olarak listede kalır.
--
-- İdempotent: IF NOT EXISTS.

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "pmDefaultPages"  INTEGER;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "pmDefaultMonths" INTEGER;

ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "pmIntervalPages"  INTEGER;
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "pmIntervalMonths" INTEGER;
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "lastPmAt"         TIMESTAMP(3);
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "lastPmCounter"    INTEGER;
