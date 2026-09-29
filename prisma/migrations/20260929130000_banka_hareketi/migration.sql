-- Banka ekstresinden toplu tahsilat: işlenen her banka satırı.
--
-- (tenantId, iz) TEKİL: aynı ekstre iki kez yüklense ya da iki sekmeden aynı
-- anda onaylansa bile aynı banka satırı ikinci kez tahsilat olmaz. Satır,
-- paranın havuzlara dağıtıldığı işlemin İLK yazımıdır; tekillik ihlali bütün
-- işlemi geri alır.
CREATE TABLE IF NOT EXISTS "BankaHareketi" (
  "id"         TEXT NOT NULL,
  "tenantId"   TEXT NOT NULL,
  "iz"         TEXT NOT NULL,
  "tarih"      TIMESTAMP(3) NOT NULL,
  "tutar"      DECIMAL(12,2) NOT NULL,
  "aciklama"   TEXT,
  "customerId" TEXT,
  "musteriAd"  TEXT,
  "paymentId"  TEXT,
  "faturaya"   DECIMAL(12,2) NOT NULL DEFAULT 0,
  "servise"    DECIMAL(12,2) NOT NULL DEFAULT 0,
  "avans"      DECIMAL(12,2) NOT NULL DEFAULT 0,
  "isleyen"    TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankaHareketi_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BankaHareketi_tenantId_iz_key" ON "BankaHareketi"("tenantId", "iz");
CREATE INDEX IF NOT EXISTS "BankaHareketi_tenantId_createdAt_idx" ON "BankaHareketi"("tenantId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'BankaHareketi_tenantId_fkey'
  ) THEN
    ALTER TABLE "BankaHareketi"
      ADD CONSTRAINT "BankaHareketi_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
