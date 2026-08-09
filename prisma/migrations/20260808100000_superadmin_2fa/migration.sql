-- Super-admin icin iki adimli dogrulama.
--
-- NEDEN: Bu hesap TUM bayilerin verisini gorur. Normal kullanicida 2FA istege
-- bagli; burada tek bir sifre sizintisi butun kiracilari acar. Guvenlik anketi
-- soran her kurumsal alici bunu ilk maddede sorar.
--
-- Alanlar User modelindeki 2FA ile birebir ayni desende — ayni dogrulama kodu
-- (src/lib/totp.ts) iki yerde de kullanilabilsin diye.
--
-- IDEMPOTENT: apply-migrations.js her acilista tum migration'lari calistirir.

ALTER TABLE "SuperAdmin" ADD COLUMN IF NOT EXISTS "totpSecret" TEXT;
ALTER TABLE "SuperAdmin" ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SuperAdmin" ADD COLUMN IF NOT EXISTS "totpLastCounter" INTEGER;
ALTER TABLE "SuperAdmin" ADD COLUMN IF NOT EXISTS "recoveryCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
