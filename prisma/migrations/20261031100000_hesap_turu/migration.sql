-- HESAP TÜRÜ: BAYI (varsayılan) | MATBAA (baskı merkezi).
-- Varsayılan BAYI: mevcut bayiler ve kiracı açan bütün yollar olduğu gibi kalır.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "hesapTuru" TEXT NOT NULL DEFAULT 'BAYI';
