-- Cihaz yaşam döngüsü + standart arıza taksonomisi + OEM parça kodu (idempotent)
-- Amaç: yüzlerce bayide çapraz toplanabilir, üreticiye sunulabilir saha verisi üretmek.
-- Not: installedAt geriye dönük TELAFİ EDİLEMEZ; bugünden itibaren toplanmaya başlar.

-- 1) Cihaz yaşı
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "installedAt" TIMESTAMP(3);
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "manufacturedAt" TIMESTAMP(3);

-- 2) Arıza kategorisi (enum) — kodlar sabit, etiketler uygulamada
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FaultCategory') THEN
    CREATE TYPE "FaultCategory" AS ENUM (
      'PAPER_JAM','TONER','PRINT_QUALITY','FEED_ERROR','NETWORK','FUSER','DRUM',
      'ELECTRONIC','GEAR','ROLLER','PRINTHEAD','PERIODIC_MAINTENANCE','INSTALLATION','OTHER'
    );
  END IF;
END$$;

ALTER TABLE "ServiceTicket" ADD COLUMN IF NOT EXISTS "faultCategory" "FaultCategory";

-- 3) Eski kayıtları mevcut şablon adından geriye dönük eşle.
--    Eşleşmeyen kayıt NULL kalır — 'OTHER' yazmıyoruz, çünkü "bilinmiyor" ile
--    "kullanıcı bilerek Diğer seçti" farklı şeylerdir ve karıştırmak analizi bozar.
-- TEK SEFERLIK (2026-08-10): apply-migrations.js her acilista tum migration'lari
-- yeniden kosuyor. Bu UPDATE issueTemplate'ten kategori tureti yor; kullanici bir
-- fisin kategorisini BILEREK bosaltirsa sonraki restart onu geri yaziyordu.
-- Isaret tablosu 20260810180000'de olusuyor.
DO $$
BEGIN
  IF to_regclass('public."_TekSeferlikIslem"') IS NULL
     OR NOT EXISTS (SELECT 1 FROM "_TekSeferlikIslem" WHERE "anahtar" = 'fault-category-devri') THEN

    UPDATE "ServiceTicket" SET "faultCategory" = CASE
        WHEN "issueTemplate" ILIKE '%sıkış%'   OR "issueTemplate" ILIKE '%sikis%'   THEN 'PAPER_JAM'::"FaultCategory"
        WHEN "issueTemplate" ILIKE '%toner%'                                        THEN 'TONER'::"FaultCategory"
        WHEN "issueTemplate" ILIKE '%kalite%'                                       THEN 'PRINT_QUALITY'::"FaultCategory"
        WHEN "issueTemplate" ILIKE '%besleme%'                                      THEN 'FEED_ERROR'::"FaultCategory"
        WHEN "issueTemplate" ILIKE '%ağ%'      OR "issueTemplate" ILIKE '%network%' THEN 'NETWORK'::"FaultCategory"
        WHEN "issueTemplate" ILIKE '%fırın%'   OR "issueTemplate" ILIKE '%firin%'   THEN 'FUSER'::"FaultCategory"
        WHEN "issueTemplate" ILIKE '%drum%'                                         THEN 'DRUM'::"FaultCategory"
        WHEN "issueTemplate" ILIKE '%elektronik%'                                   THEN 'ELECTRONIC'::"FaultCategory"
        WHEN "issueTemplate" ILIKE '%dişli%'   OR "issueTemplate" ILIKE '%disli%'   THEN 'GEAR'::"FaultCategory"
        WHEN "issueTemplate" ILIKE '%paten%'                                        THEN 'ROLLER'::"FaultCategory"
        WHEN "issueTemplate" ILIKE '%kafa%'                                         THEN 'PRINTHEAD'::"FaultCategory"
        WHEN "issueTemplate" ILIKE '%bakım%'   OR "issueTemplate" ILIKE '%bakim%'   THEN 'PERIODIC_MAINTENANCE'::"FaultCategory"
        WHEN "issueTemplate" ILIKE '%kurulum%'                                      THEN 'INSTALLATION'::"FaultCategory"
        WHEN "issueTemplate" ILIKE '%diğer%'   OR "issueTemplate" ILIKE '%diger%'   THEN 'OTHER'::"FaultCategory"
        ELSE NULL
      END
    WHERE "faultCategory" IS NULL AND "issueTemplate" IS NOT NULL;

    IF to_regclass('public."_TekSeferlikIslem"') IS NOT NULL THEN
      INSERT INTO "_TekSeferlikIslem" ("anahtar") VALUES ('fault-category-devri')
      ON CONFLICT ("anahtar") DO NOTHING;
    END IF;
  END IF;
END $$;

-- 4) OEM parça kodu — bayiye özel sku'yu üreticinin koduna bağlar
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "oemCode" TEXT;
ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "oemBrand" TEXT;

-- 5) Analiz indeksleri
CREATE INDEX IF NOT EXISTS "ServiceTicket_tenantId_faultCategory_idx"
  ON "ServiceTicket"("tenantId", "faultCategory");
-- Kiracıdan bağımsız toplu analiz (marka/model güvenilirliği) için
CREATE INDEX IF NOT EXISTS "ServiceTicket_faultCategory_createdAt_idx"
  ON "ServiceTicket"("faultCategory", "createdAt");
CREATE INDEX IF NOT EXISTS "Part_oemBrand_oemCode_idx"
  ON "Part"("oemBrand", "oemCode");
CREATE INDEX IF NOT EXISTS "Device_installedAt_idx"
  ON "Device"("installedAt");
