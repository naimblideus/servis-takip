-- EKİP TEST HESAPLARI (2026-10-21): teknik ekibin her özelliği açık, örnek veriyle dolu
-- deneme bayileri. demo=true kalır (listelerden ve dışarıya mesajdan ayrı), bu bayrak
-- yalnız demonun yazma kısıtlarını kaldırır. Göçler her açılışta yeniden koşar: IF NOT EXISTS.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "ekipTest" BOOLEAN NOT NULL DEFAULT false;
