-- Bayinin platforma ödemesi: IBAN, hesap adı ve satış WhatsApp numarası.
-- Abonelik ekranında ve deneme bitince kilit ekranında gösterilir.
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "odemeIban" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "odemeHesapAdi" TEXT;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "satisWhatsapp" TEXT;
