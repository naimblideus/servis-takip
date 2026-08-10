-- Modüler özellik yetkilendirme: Tenant.modules (boş = plan varsayılanı; dolu = override)
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "modules" TEXT[] NOT NULL DEFAULT '{}';

-- Geriye-uyum: migration anına kadar VAR OLAN bayiler hiçbir özellik kaybetmesin —
-- hepsine tüm modülleri (override) ver. Cutoff sonrası açılan YENİ bayiler plan varsayılanını kullanır.
-- (createdAt cutoff sayesinde her açılışta tekrar koşsa da yeni bayileri etkilemez.)
-- TEK SEFERLIK YAPILDI (2026-08-10): apply-migrations.js her acilista tum
-- migration'lari yeniden kosuyor. Bu UPDATE sabit bir modul listesi yaziyor ve
-- modules.ts dolu listeyi MUTLAK OVERRIDE sayiyor; yani her yeni modul (ornegin
-- PORTAL) eski bayilerde her restart'ta yeniden KAPANIYORDU. Isaret tablosu
-- 20260810180000 migration'inda olusuyor; bu blok artik bir kez calisir.
DO $$
BEGIN
  IF to_regclass('public."_TekSeferlikIslem"') IS NULL
     OR NOT EXISTS (SELECT 1 FROM "_TekSeferlikIslem" WHERE "anahtar" = 'tenant-modules-devri') THEN

    UPDATE "Tenant"
      SET "modules" = ARRAY['INVOICING','ROUTE','TRACKING','REVENUE_RISK','REPORTS','MARKETPLACE']
      WHERE "createdAt" < TIMESTAMP '2026-06-22 00:00:00'
        AND ("modules" IS NULL OR "modules" = '{}');

    IF to_regclass('public."_TekSeferlikIslem"') IS NOT NULL THEN
      INSERT INTO "_TekSeferlikIslem" ("anahtar") VALUES ('tenant-modules-devri')
      ON CONFLICT ("anahtar") DO NOTHING;
    END IF;
  END IF;
END $$;
