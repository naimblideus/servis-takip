-- Sayaç tarayıcı (SNMP): müşterinin ağındaki yazıcıların sayacını okuyan
-- tarayıcının anahtarı ve çalışma kayıtları.
--
-- Anahtarın kendisi SAKLANMAZ, yalnız SHA-256 özeti. Tarama sonucu bayi
-- onaylamadan sayaç olarak yazılmaz (tarayiciOtomatikYaz varsayılan false).
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "tarayiciAnahtarHash" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "tarayiciOtomatikYaz" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_tarayiciAnahtarHash_key" ON "Tenant"("tarayiciAnahtarHash");

CREATE TABLE IF NOT EXISTS "SayacTaramasi" (
  "id"          TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "bilgisayar"  TEXT,
  "taranan"     INTEGER NOT NULL DEFAULT 0,
  "bulunan"     INTEGER NOT NULL DEFAULT 0,
  "eslesen"     INTEGER NOT NULL DEFAULT 0,
  "yazilabilir" INTEGER NOT NULL DEFAULT 0,
  "yazilan"     INTEGER NOT NULL DEFAULT 0,
  "sonuc"       JSONB NOT NULL,
  "onaylandiAt" TIMESTAMP(3),
  CONSTRAINT "SayacTaramasi_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SayacTaramasi_tenantId_createdAt_idx" ON "SayacTaramasi"("tenantId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'SayacTaramasi_tenantId_fkey'
  ) THEN
    ALTER TABLE "SayacTaramasi"
      ADD CONSTRAINT "SayacTaramasi_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
