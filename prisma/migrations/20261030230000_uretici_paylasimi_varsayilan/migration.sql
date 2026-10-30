-- Üretici ile anonim veri paylaşımı yeni bayilerde varsayılan AÇIK.
-- Yalnız varsayılanı değiştirir: mevcut bayilerin kaydı olduğu gibi kalır.
ALTER TABLE "Tenant" ALTER COLUMN "oemDataSharing" SET DEFAULT true;
