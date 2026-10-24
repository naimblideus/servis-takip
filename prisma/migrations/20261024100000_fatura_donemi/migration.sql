-- FATURA DÖNEMİ (2026-10-24): okumanın girdiği dönem damgası + ay sonu koşusu.
-- Kural lib/fatura-donemi.ts. Göçler her açılışta yeniden koşar: IF NOT EXISTS.
-- Eski okumalar BOŞ bırakılır: boş damga = okuma tarihinin İstanbul ayı
-- (donemOkumaKosulu iki durumu da seçer) — başlangıçta toplu UPDATE yok.
ALTER TABLE "CounterReading" ADD COLUMN IF NOT EXISTS "faturaDonemi" TEXT;
CREATE INDEX IF NOT EXISTS "CounterReading_tenantId_faturaDonemi_idx" ON "CounterReading"("tenantId", "faturaDonemi");

CREATE TABLE IF NOT EXISTS "FaturaTuru" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "durum" TEXT NOT NULL DEFAULT 'CALISIYOR',
  "kaynak" TEXT NOT NULL DEFAULT 'CRON',
  "faturaSayisi" INTEGER NOT NULL DEFAULT 0,
  "toplam" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "hataSayisi" INTEGER NOT NULL DEFAULT 0,
  "hatalar" JSONB,
  "baslangic" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "bitis" TIMESTAMP(3),
  CONSTRAINT "FaturaTuru_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FaturaTuru_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "FaturaTuru_tenantId_period_key" ON "FaturaTuru"("tenantId", "period");
