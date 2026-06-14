#!/bin/sh
# set -e KALDIRILDI: migration hataları sunucuyu durdurmasın

echo "=== [1/5] Resolving potentially mismatched migrations ==="
node node_modules/prisma/build/index.js migrate resolve \
  --applied "20260505001300_add_account_entry_printer_stock" 2>&1 || true

echo "=== [2/5] Running migrate deploy (best-effort) ==="
node node_modules/prisma/build/index.js migrate deploy 2>&1 || \
  echo "!!! migrate deploy başarısız — dinamik uygulayıcı (adım 3) devrede ==="

echo "=== [3/5] TÜM migration'ları dinamik + idempotent uygula (KALICI ÇÖZÜM) ==="
# prisma CLI/engine olmasa bile @prisma/client ile tüm prisma/migrations/*/migration.sql
# dosyalarını uygular. Yeni migration eklenince otomatik yakalanır -> bir daha eksik-kolon krizi olmaz.
node apply-migrations.js 2>&1 || echo "!!! apply-migrations sorun yaşadı (non-fatal)"

echo "=== [4/5] Ensuring admin user exists (şifre admin170305 garanti) ==="
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
      console.log('[OK] Admin user password ensured: admin@demo.com / admin170305');
    }
  } catch(e) {
    console.error('[WARN] Admin ensure error (non-fatal):', e.message);
  } finally {
    await p.\$disconnect().catch(function(){});
  }
}
ensureAdmin();
" 2>&1

echo "=== [5/5] Starting Next.js server ==="
exec node server.js
