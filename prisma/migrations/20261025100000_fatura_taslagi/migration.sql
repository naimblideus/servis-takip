-- TASLAK → KONTROL → KES (2026-10-25): şüpheli okuma ve fatura şoku faturayı
-- taslakta bekletir; bayi isterse her faturayı önce görür (Tenant.faturaOnayi).
-- Kural lib/fatura-bekletme.ts. Göçler her açılışta yeniden koşar: IF NOT EXISTS.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "faturaOnayi" TEXT NOT NULL DEFAULT 'OTOMATIK';
ALTER TABLE "CounterReading" ADD COLUMN IF NOT EXISTS "supheli" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FaturaTuru" ADD COLUMN IF NOT EXISTS "bekleyenSayisi" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "FaturaTaslagi" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "durum" TEXT NOT NULL DEFAULT 'BEKLIYOR',
  "gerekceler" JSONB NOT NULL,
  "satirlar" JSONB NOT NULL,
  "araToplam" DECIMAL(14,2) NOT NULL,
  "toplam" DECIMAL(14,2) NOT NULL,
  "invoiceId" TEXT,
  "olusturuldu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "guncellendi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FaturaTaslagi_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FaturaTaslagi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FaturaTaslagi_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "FaturaTaslagi_tenantId_period_durum_idx" ON "FaturaTaslagi"("tenantId", "period", "durum");
CREATE INDEX IF NOT EXISTS "FaturaTaslagi_tenantId_customerId_idx" ON "FaturaTaslagi"("tenantId", "customerId");
-- Müşteri × dönem başına tek bekleyen taslak.
CREATE UNIQUE INDEX IF NOT EXISTS "FaturaTaslagi_bekleyen_tekil" ON "FaturaTaslagi"("tenantId", "customerId", "period") WHERE "durum" = 'BEKLIYOR';

-- GEÇİŞ: fatura gece işi aylıktan GÜNLÜĞE geçti; her gün kapanmış dönemin
-- koşusu bitmiş mi (FaturaTuru TAMAM) diye bakar. Ağustos ve Eylül eski aylık
-- işle (1 Eylül, 1 Ekim) zaten kesildi ama FaturaTuru o zaman yoktu: kayıt
-- açılmazsa yeni iş Eylül'ü bir daha koşar, Ekim'de teslim edilen servis
-- fişlerini "Eylül faturası"na yazardı. Yalnız bu tarihten önce açılmış bayiler.
INSERT INTO "FaturaTuru" ("id", "tenantId", "period", "durum", "kaynak", "bitis")
SELECT 'gecis-' || t."id" || '-' || p.donem, t."id", p.donem, 'TAMAM', 'CRON', CURRENT_TIMESTAMP
FROM "Tenant" t CROSS JOIN (VALUES ('2026-08'), ('2026-09')) AS p(donem)
WHERE t."createdAt" < '2026-10-25'
ON CONFLICT ("tenantId", "period") DO NOTHING;

-- 24–25 Ekim arasında (0.2 canlıdayken, Eylül'ün kaydı yokken) Eylül'e damgalanmış
-- faturalanmamış geç okumalar: Eylül bir daha koşmayacağı için açık döneme (Ekim)
-- alınır — eski sistem de bunları Ekim'de faturalardı.
UPDATE "CounterReading" SET "faturaDonemi" = '2026-10'
WHERE "billed" = false AND "faturaDonemi" IN ('2026-08', '2026-09') AND "faturaDonemi" <> '2026-10'
  AND "createdAt" >= '2026-10-24' AND "createdAt" < '2026-10-27';
