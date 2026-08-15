-- SAYAC E-POSTASI: BAYIYE OZEL ADRES
--
-- Cihazlar sayac raporunu  sayac+<kod>@alanadi  adresine gonderir. Kod bayiyi
-- SOYLER; seri aramasi o bayinin cihazlariyla sinirlanir.
--
-- NEDEN: kodsuz tek adreste iki sorun vardi —
--   1. Ayni seri iki bayide varsa hangisi oldugu bilinemez, kayit kuyruga duser
--   2. Gelen HER e-postada TUM bayilerin TUM cihazlari taranir
-- Kod ikisini de ortadan kaldirir.
--
-- Kod mevcut bayilere de uretilir: ozellik acildiginda herkes hazir olsun.
-- 8 karakter, karisabilen harfler (0/O, 1/l/I) disarida — telefonda okunacak.
--
-- IDEMPOTENT: apply-migrations.js her acilista tum migration'lari calistirir.

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "sayacEpostaKodu" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_sayacEpostaKodu_key" ON "Tenant"("sayacEpostaKodu");

DO $$
DECLARE
  t RECORD;
  yeni TEXT;
  alfabe TEXT := 'abcdefghjkmnpqrstuvwxyz23456789';
  i INT;
BEGIN
  IF to_regclass('public."_TekSeferlikIslem"') IS NULL
     OR NOT EXISTS (SELECT 1 FROM "_TekSeferlikIslem" WHERE "anahtar" = 'sayac-eposta-kodu-uret') THEN

    FOR t IN SELECT "id" FROM "Tenant" WHERE "sayacEpostaKodu" IS NULL LOOP
      LOOP
        yeni := '';
        FOR i IN 1..8 LOOP
          yeni := yeni || substr(alfabe, 1 + floor(random() * length(alfabe))::int, 1);
        END LOOP;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM "Tenant" WHERE "sayacEpostaKodu" = yeni);
      END LOOP;
      UPDATE "Tenant" SET "sayacEpostaKodu" = yeni WHERE "id" = t."id";
    END LOOP;

    IF to_regclass('public."_TekSeferlikIslem"') IS NOT NULL THEN
      INSERT INTO "_TekSeferlikIslem" ("anahtar") VALUES ('sayac-eposta-kodu-uret')
      ON CONFLICT ("anahtar") DO NOTHING;
    END IF;
  END IF;
END $$;
