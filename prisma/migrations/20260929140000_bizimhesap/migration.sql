-- Bizim Hesap aktarımı: bayinin FirmID'si (şifreli) ve her faturanın
-- Bizim Hesap'a gönderim durumu. Fatura bir kez gönderilir; GONDERILIYOR
-- durumu iki eşzamanlı gönderimi engelleyen kilittir.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "bizimHesapFirmId" TEXT;

ALTER TABLE "CustomerInvoice" ADD COLUMN IF NOT EXISTS "bizimHesapDurum" TEXT;
ALTER TABLE "CustomerInvoice" ADD COLUMN IF NOT EXISTS "bizimHesapGuid" TEXT;
ALTER TABLE "CustomerInvoice" ADD COLUMN IF NOT EXISTS "bizimHesapUrl" TEXT;
ALTER TABLE "CustomerInvoice" ADD COLUMN IF NOT EXISTS "bizimHesapAt" TIMESTAMP(3);
ALTER TABLE "CustomerInvoice" ADD COLUMN IF NOT EXISTS "bizimHesapHata" TEXT;
