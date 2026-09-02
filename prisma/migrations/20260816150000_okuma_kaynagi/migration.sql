-- OKUMA KAYNAGI
--
-- Sayac okumasi 7 ayri yoldan olusabiliyor: cihazin kendi e-postasi, teknisyen
-- fotografi, musteri WhatsApp fotografi, musteri portali, sayac turu toplu
-- girisi, servis fisi, tekil elle giris. Hicbiri "nereden geldi" yazmiyordu.
--
-- NEDEN ONEMLI: bayinin ikinci buyuk derdi "adam o kadar cekmedim diyor,
-- elimde bir sey yok". Tartismada kanit agirligi kaynaga gore degisir:
--   CIHAZ_EPOSTA  cihazin kendi raporu — en guclu, "iste e-postasi"
--   FOTOGRAF / WHATSAPP_FOTO  gorsel kanit
--   PORTAL  musteri kendi girdi — kendi beyani
--   TOPLU / SERVIS_FISI / ELLE  bayi girdi — en zayif
--
-- Eski kayitlar ELLE sayilir: kaynagi bilinmiyor, en zayif seviyeye konur.
-- Bilinmeyeni guclu kanit gibi gostermek tartismada bayiyi zor duruma sokar.
--
-- IDEMPOTENT: apply-migrations.js her acilista tum migration'lari calistirir.

ALTER TABLE "CounterReading" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'ELLE';

-- Kaynaga gore filtreleme/raporlama icin (ornek: "bu ay cihazdan gelen okuma orani")
CREATE INDEX IF NOT EXISTS "CounterReading_tenantId_source_idx"
  ON "CounterReading"("tenantId", "source");
