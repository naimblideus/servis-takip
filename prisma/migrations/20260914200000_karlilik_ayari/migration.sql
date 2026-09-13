-- SÖZLEŞME KÂRLILIĞI AYARLARI
-- ziyaretMaliyeti boş kalabilir: o zaman işçilik hesaba katılmıyor ve
-- ekranda böyle yazıyor. Saat ücreti uydurmak bütün marjı yanlış yapardı.
ALTER TABLE "Tenant" ADD COLUMN "ziyaretMaliyeti" DECIMAL(10,2);
ALTER TABLE "Tenant" ADD COLUMN "hedefMarj" DECIMAL(5,4);
