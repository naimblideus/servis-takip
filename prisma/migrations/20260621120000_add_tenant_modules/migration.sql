-- Modüler özellik yetkilendirme: Tenant.modules (boş = plan varsayılanı; dolu = override)
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "modules" TEXT[] NOT NULL DEFAULT '{}';

-- Geriye-uyum: migration anına kadar VAR OLAN bayiler hiçbir özellik kaybetmesin —
-- hepsine tüm modülleri (override) ver. Cutoff sonrası açılan YENİ bayiler plan varsayılanını kullanır.
-- (createdAt cutoff sayesinde her açılışta tekrar koşsa da yeni bayileri etkilemez.)
UPDATE "Tenant"
  SET "modules" = ARRAY['INVOICING','ROUTE','TRACKING','REVENUE_RISK','REPORTS','MARKETPLACE']
  WHERE "createdAt" < TIMESTAMP '2026-06-22 00:00:00'
    AND ("modules" IS NULL OR "modules" = '{}');
