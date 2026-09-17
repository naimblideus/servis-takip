-- Parça grubu: TÜRKÇE AD -> SABİT KOD
--
-- Part."group" bugüne kadar ekranda görünen Türkçe metnin kendisini tutuyordu
-- ("Fırın Grubu"). İki sorun birden çıkarıyordu:
--   1. İngilizce arayüzde stok listesi Türkçe kalıyordu — gösterilen şey
--      verinin kendisiydi, çevrilecek bir yeri yoktu.
--   2. Etiketteki tek bir düzeltme geçmiş kayıtları başka gruba düşürüyordu.
-- Arıza kategorilerindeki kural burada da geçerli: kod sabit, etiket değişken.
--
-- GÜVENLİK: yalnız TANIDIĞIMIZ yazımlar değiştirilir. Tanınmayan bir değer
-- (bayinin elle yazdığı bir grup) OLDUĞU GİBİ KALIR — silinmez, boşaltılmaz.
--
-- İDEMPOTENT: her UPDATE'te ayrıca `"group" <> <kod>` var. İkinci koşuda hiçbir
-- satır eşleşmez; aynı değeri yeniden yazmak bile olmaz.
--
-- Karşılaştırma büyük/küçük harf ve Türkçe harf duyarsız yapılıyor: sahadan
-- "FIRIN GURUBU", "firin grubu", "Fırın Grubu" hepsi geldi.

-- Türkçe harfleri ASCII'ye indirip küçülten yardımcı (yalnız bu göç için).
CREATE OR REPLACE FUNCTION pg_kat(x text) RETURNS text AS $$
  SELECT regexp_replace(
    lower(translate(coalesce(x, ''), 'ıİşŞğĞüÜöÖçÇ', 'iisSgGuUoOcC')),
    '[^a-z0-9]', '', 'g');
$$ LANGUAGE sql IMMUTABLE;

UPDATE "Part" SET "group" = 'TONER'  WHERE "group" <> 'TONER'  AND pg_kat("group") = 'toner';
UPDATE "Part" SET "group" = 'INK'    WHERE "group" <> 'INK'    AND pg_kat("group") IN ('murekkep', 'ink');
UPDATE "Part" SET "group" = 'FUSER'  WHERE "group" <> 'FUSER'  AND pg_kat("group") IN ('firingrubu', 'firingurubu', 'firin', 'fuser');
UPDATE "Part" SET "group" = 'ROLLER' WHERE "group" <> 'ROLLER' AND pg_kat("group") IN ('paten', 'roller');
UPDATE "Part" SET "group" = 'GEAR'   WHERE "group" <> 'GEAR'   AND pg_kat("group") IN ('disligrubu', 'disligurubu', 'disli', 'gear');
UPDATE "Part" SET "group" = 'DRUM'   WHERE "group" <> 'DRUM'   AND pg_kat("group") = 'drum';
UPDATE "Part" SET "group" = 'SPARE'  WHERE "group" <> 'SPARE'  AND pg_kat("group") IN ('yedekparca', 'spare', 'sparepart');
UPDATE "Part" SET "group" = 'PAPER'  WHERE "group" <> 'PAPER'  AND pg_kat("group") IN ('kagitsarf', 'kagit', 'sarf', 'paper');
UPDATE "Part" SET "group" = 'LABOUR' WHERE "group" <> 'LABOUR' AND pg_kat("group") IN ('iscilik', 'labour', 'labor');
UPDATE "Part" SET "group" = 'REPAIR' WHERE "group" <> 'REPAIR' AND pg_kat("group") IN ('tamirat', 'repair');
UPDATE "Part" SET "group" = 'OTHER'  WHERE "group" <> 'OTHER'  AND pg_kat("group") IN ('diger', 'other');

DROP FUNCTION pg_kat(text);
