#!/bin/sh
# set -e KALDIRILDI: migration hataları sunucuyu durdurmasın

echo "=== [1/5] Resolving potentially mismatched migrations ==="
node node_modules/prisma/build/index.js migrate resolve \
  --applied "20260505001300_add_account_entry_printer_stock" 2>&1 || true

echo "=== [2/5] Running migrate deploy ==="
node node_modules/prisma/build/index.js migrate deploy 2>&1 || \
  echo "!!! migrate deploy failed — will attempt direct SQL fallback ==="

echo "=== [3/5] Direct SQL fallback: ensure tables exist ==="
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function ensureTables() {
  try {
    // AccountEntryType enum
    await p.$executeRawUnsafe(`
      DO \$\$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountEntryType') THEN
          CREATE TYPE \"AccountEntryType\" AS ENUM ('SALE', 'PAYMENT');
        END IF;
      END \$\$
    `);
    // AccountEntry tablosu
    await p.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \"AccountEntry\" (
        \"id\" TEXT NOT NULL,
        \"tenantId\" TEXT NOT NULL,
        \"customerId\" TEXT NOT NULL,
        \"type\" TEXT NOT NULL DEFAULT 'SALE',
        \"product\" TEXT,
        \"amount\" DECIMAL(10,2) NOT NULL DEFAULT 0,
        \"method\" TEXT NOT NULL DEFAULT 'CASH',
        \"notes\" TEXT,
        \"date\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \"updatedAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT \"AccountEntry_pkey\" PRIMARY KEY (\"id\")
      )
    `);
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS \"AccountEntry_tenantId_idx\" ON \"AccountEntry\"(\"tenantId\")`);
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS \"AccountEntry_customerId_idx\" ON \"AccountEntry\"(\"customerId\")`);
    // PrinterStock tablosu
    await p.$executeRawUnsafe(`
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
    `);
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS \"PrinterStock_tenantId_idx\" ON \"PrinterStock\"(\"tenantId\")`);
    // Expense (Gider) tablosu
    await p.$executeRawUnsafe(`
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
    `);
    await p.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS \"Expense_tenantId_idx\" ON \"Expense\"(\"tenantId\")`);
    // FinancialTransaction.readingId
    await p.$executeRawUnsafe(`ALTER TABLE \"FinancialTransaction\" ADD COLUMN IF NOT EXISTS \"readingId\" TEXT`).catch(()=>{});
    console.log('[OK] All tables ensured.');
  } catch(e) {
    console.error('[WARN] SQL fallback error (non-fatal):', e.message);
  } finally {
    await p.$disconnect();
  }
}
ensureTables();
" 2>&1

echo "=== [4/5] Ensuring admin user exists ==="
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();
async function ensureAdmin() {
  try {
    const tenants = await p.tenant.findMany({ take: 1 });
    let tenantId;
    if (tenants.length === 0) {
      const t = await p.tenant.create({
        data: { name: 'Saygili Fotokopi', slug: 'saygili', plan: 'trial', isActive: true }
      });
      tenantId = t.id;
      console.log('[OK] Tenant created:', tenantId);
    } else {
      tenantId = tenants[0].id;
    }
    const existing = await p.user.findFirst({ where: { email: 'admin@demo.com' } });
    const hash = await bcrypt.hash('admin170305', 12);
    if (!existing) {
      await p.user.create({
        data: { tenantId, email: 'admin@demo.com', name: 'Admin', passwordHash: hash, role: 'ADMIN', isActive: true }
      });
      console.log('[OK] Admin user CREATED: admin@demo.com / admin170305');
    } else {
      await p.user.update({ where: { id: existing.id }, data: { passwordHash: hash, isActive: true } });
      console.log('[OK] Admin user password reset: admin@demo.com / admin170305');
    }
  } catch(e) {
    console.error('[WARN] Admin ensure error (non-fatal):', e.message);
  } finally {
    await p.$disconnect();
  }
}
ensureAdmin();
" 2>&1

echo "=== [5/5] Starting Next.js server ==="
exec node server.js
