#!/bin/sh
# set -e KALDIRILDI: migration hataları sunucuyu durdurmasın

echo "=== [1/4] Resolving potentially mismatched migrations ==="
node node_modules/prisma/build/index.js migrate resolve \
  --applied "20260505001300_add_account_entry_printer_stock" 2>&1 || true

echo "=== [2/4] Running migrate deploy ==="
node node_modules/prisma/build/index.js migrate deploy 2>&1 || \
  echo "!!! migrate deploy failed — will attempt direct SQL fallback ==="

echo "=== [3/4] Direct SQL fallback: ensure tables exist ==="
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function ensureTables() {
  try {
    // AccountEntryType enum
    await p.\$executeRawUnsafe(\`
      DO \\\$\\\$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountEntryType') THEN
          CREATE TYPE \"AccountEntryType\" AS ENUM ('SALE', 'PAYMENT');
        END IF;
      END \\\$\\\$
    \`);
    // OPEN_ACCOUNT değeri PaymentMethod enum'una ekle
    await p.\$executeRawUnsafe(\`ALTER TYPE \"PaymentMethod\" ADD VALUE IF NOT EXISTS 'OPEN_ACCOUNT'\`).catch(()=>{});
    // AccountEntry tablosu
    await p.\$executeRawUnsafe(\`
      CREATE TABLE IF NOT EXISTS \"AccountEntry\" (
        \"id\" TEXT NOT NULL,
        \"tenantId\" TEXT NOT NULL,
        \"customerId\" TEXT NOT NULL,
        \"type\" \"AccountEntryType\" NOT NULL,
        \"product\" TEXT,
        \"amount\" DECIMAL(10,2) NOT NULL DEFAULT 0,
        \"method\" TEXT NOT NULL DEFAULT 'CASH',
        \"notes\" TEXT,
        \"date\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \"updatedAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT \"AccountEntry_pkey\" PRIMARY KEY (\"id\")
      )
    \`);
    // Index'ler
    await p.\$executeRawUnsafe(\`CREATE INDEX IF NOT EXISTS \"AccountEntry_tenantId_idx\" ON \"AccountEntry\"(\"tenantId\")\`);
    await p.\$executeRawUnsafe(\`CREATE INDEX IF NOT EXISTS \"AccountEntry_customerId_idx\" ON \"AccountEntry\"(\"customerId\")\`);
    // Foreign key'ler
    await p.\$executeRawUnsafe(\`
      DO \\\$\\\$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name='AccountEntry_tenantId_fkey'
        ) THEN
          ALTER TABLE \"AccountEntry\" ADD CONSTRAINT \"AccountEntry_tenantId_fkey\"
          FOREIGN KEY (\"tenantId\") REFERENCES \"Tenant\"(\"id\") ON DELETE CASCADE;
        END IF;
      END \\\$\\\$
    \`).catch(()=>{});
    await p.\$executeRawUnsafe(\`
      DO \\\$\\\$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name='AccountEntry_customerId_fkey'
        ) THEN
          ALTER TABLE \"AccountEntry\" ADD CONSTRAINT \"AccountEntry_customerId_fkey\"
          FOREIGN KEY (\"customerId\") REFERENCES \"Customer\"(\"id\") ON DELETE CASCADE;
        END IF;
      END \\\$\\\$
    \`).catch(()=>{});
    // PrinterStock tablosu
    await p.\$executeRawUnsafe(\`
      CREATE TABLE IF NOT EXISTS \"PrinterStock\" (
        \"id\" TEXT NOT NULL,
        \"tenantId\" TEXT NOT NULL,
        \"category\" TEXT NOT NULL DEFAULT 'TONER',
        \"brand\" TEXT NOT NULL DEFAULT '',
        \"model\" TEXT NOT NULL DEFAULT '',
        \"condition\" TEXT NOT NULL DEFAULT 'SIFIR',
        \"color\" TEXT,
        \"quantity\" INTEGER NOT NULL DEFAULT 1,
        \"buyPrice\" DECIMAL(10,2) NOT NULL DEFAULT 0,
        \"sellPrice\" DECIMAL(10,2) NOT NULL DEFAULT 0,
        \"notes\" TEXT,
        \"soldAt\" TIMESTAMP(3),
        \"soldTo\" TEXT,
        \"soldPrice\" DECIMAL(10,2),
        \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \"updatedAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT \"PrinterStock_pkey\" PRIMARY KEY (\"id\")
      )
    \`);
    await p.\$executeRawUnsafe(\`CREATE INDEX IF NOT EXISTS \"PrinterStock_tenantId_idx\" ON \"PrinterStock\"(\"tenantId\")\`);
    // Expense (Gider) tablosu
    await p.\$executeRawUnsafe(\`
      CREATE TABLE IF NOT EXISTS \"Expense\" (
        \"id\" TEXT NOT NULL,
        \"tenantId\" TEXT NOT NULL,
        \"category\" TEXT NOT NULL DEFAULT 'GENEL',
        \"description\" TEXT NOT NULL,
        \"amount\" DECIMAL(10,2) NOT NULL DEFAULT 0,
        \"date\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \"payee\" TEXT,
        \"method\" TEXT NOT NULL DEFAULT 'CASH',
        \"notes\" TEXT,
        \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \"updatedAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT \"Expense_pkey\" PRIMARY KEY (\"id\")
      )
    \`);
    await p.\$executeRawUnsafe(\`CREATE INDEX IF NOT EXISTS \"Expense_tenantId_idx\" ON \"Expense\"(\"tenantId\")\`);
    // FinancialTransaction.readingId
    await p.\$executeRawUnsafe(\`ALTER TABLE \"FinancialTransaction\" ADD COLUMN IF NOT EXISTS \"readingId\" TEXT\`).catch(()=>{});
    console.log('[OK] All tables ensured.');
  } catch(e) {
    console.error('[WARN] SQL fallback error (non-fatal):', e.message);
  } finally {
    await p.\$disconnect();
  }
}
ensureTables();
" 2>&1

echo "=== [4/4] Starting Next.js server ==="
exec node server.js
