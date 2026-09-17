-- SLA: SÖZLEŞMEDEKİ MÜDAHALE VE ÇÖZÜM SÜRESİ
--
-- Büyük müşterinin sözleşmesinde tek bir cümle vardır ve denetlediği odur:
-- "arıza bildiriminden itibaren 4 saat içinde müdahale, 24 saat içinde çözüm".
-- Bayi bu cümleyi imzalıyor ama tuttuğunu ÖLÇEMİYORDU; yıl sonunda müşteri
-- kendi rakamıyla geliyordu ve pazarlık oradan başlıyordu.
--
-- İKİ AYRI YER, BİLEREK:
--   Tenant.work*    = "ne zaman çalışıyoruz" — bayinin takvimi.
--   Contract.sla*   = "ne söz verdik"        — sözleşmenin hedefi.
-- SLA duvar saatiyle ölçülürse cuma 17:30'da açılan fiş pazartesi 09:00'da
-- 63 saat gecikmiş görünür; böyle bir rapor bayiyi haksız çıkarır ve çöpe gider.
--
-- Hedefler NULL varsayılan: sözleşmede konuşulmamış bir kalem için uydurulmuş
-- hedefe göre uyum oranı üretmek, raporun tamamını değersizleştirir.
--
-- İdempotent: IF NOT EXISTS. Tekrar çalıştırmak hiçbir veriyi değiştirmez.

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "workTimezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "workDays"     TEXT NOT NULL DEFAULT '1,2,3,4,5';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "workStartMin" INTEGER NOT NULL DEFAULT 540;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "workEndMin"   INTEGER NOT NULL DEFAULT 1080;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "workHolidays" TEXT;

ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "slaResponseMins"   INTEGER;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "slaResolutionMins" INTEGER;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "slaPauseOnPart"    BOOLEAN NOT NULL DEFAULT false;
