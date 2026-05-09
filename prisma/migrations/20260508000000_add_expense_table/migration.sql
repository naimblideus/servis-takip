-- Expense (Gider) tablosu oluştur
CREATE TABLE IF NOT EXISTS "Expense" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL,
    "category"    TEXT NOT NULL DEFAULT 'GENEL',
    "description" TEXT NOT NULL,
    "amount"      DECIMAL(10,2) NOT NULL DEFAULT 0,
    "date"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payee"       TEXT,
    "method"      TEXT NOT NULL DEFAULT 'CASH',
    "notes"       TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Expense_tenantId_date_idx" ON "Expense"("tenantId", "date" DESC);
CREATE INDEX IF NOT EXISTS "Expense_tenantId_category_idx" ON "Expense"("tenantId", "category");

-- Foreign key (IF NOT EXISTS korumalı)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'Expense_tenantId_fkey'
    ) THEN
        ALTER TABLE "Expense"
        ADD CONSTRAINT "Expense_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AccountEntry.method sütununu TEXT'e dönüştür (PaymentMethod enum'dan kurtul)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'AccountEntry' AND column_name = 'method'
        AND data_type = 'USER-DEFINED'
    ) THEN
        ALTER TABLE "AccountEntry" ALTER COLUMN "method" TYPE TEXT USING "method"::TEXT;
        ALTER TABLE "AccountEntry" ALTER COLUMN "method" SET DEFAULT 'CASH';
    END IF;
END $$;
