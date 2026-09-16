-- DİL VE PARA BİRİMİ — Avrupa pazarı için temel.
--
-- Dil KİŞİYE göre (User.locale): dili insan konuşur. Para birimi ve ülke
-- BAYİYE göre (Tenant.currency, Tenant.country): parayı şirket tutar, e-Fatura
-- ve KDV gibi TR'ye özgü modüller ülkeye göre kapılanır.
--
-- Tenant.locale bayinin VARSAYILAN dili: yeni kullanıcı bunu devralır,
-- sonra kendi tercihini yazabilir.
--
-- Varsayılanlar mevcut Türk bayileri için değişiklik üretmiyor: tr / TRY / TR.
-- Göç yalnız kolon ekliyor; veriye dokunmuyor. Idempotent.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "locale"   TEXT NOT NULL DEFAULT 'tr';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'TRY';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "country"  TEXT NOT NULL DEFAULT 'TR';
ALTER TABLE "User"   ADD COLUMN IF NOT EXISTS "locale"   TEXT;
