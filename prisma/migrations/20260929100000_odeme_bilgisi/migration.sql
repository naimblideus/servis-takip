-- Müşteriden ödeme: bayinin IBAN'ı, hesap adı ve kartla ödeme bağlantısı.
-- Müşteri panelinde bakiyenin altında gösterilir. Kart verisi bu sisteme
-- girmez; bağlantı bayinin kendi POS sağlayıcısına gider.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "odemeIban" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "odemeHesapAdi" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "odemeLinki" TEXT;
