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

echo "=== [4/5] Admin BOOTSTRAP — yalnızca HİÇ kullanıcı yoksa; mevcut şifreye DOKUNMAZ ==="
# GÜVENLİK (2026-08-06): Burada eskiden her açılışta admin@demo.com şifresi kod içine
# gömülü sabit bir değere GERİ YAZILIYORDU. Depo herkese açık olduğu için bu, üretim
# admin şifresinin kamuya açık olması ve her deploy'da kendini yeniden kurması demekti.
# Artık: mevcut kullanıcıya asla dokunulmaz. Boş veritabanında ilk admin ADMIN_BOOTSTRAP_EMAIL/
# ADMIN_BOOTSTRAP_PASSWORD ile açılır; verilmemişse rastgele şifre üretilip SADECE loga yazılır.
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const p = new PrismaClient();
async function bootstrapAdmin() {
  try {
    const userCount = await p.user.count();
    if (userCount > 0) {
      console.log('[OK] Kullanıcı mevcut (' + userCount + ') — bootstrap atlandı, şifrelere dokunulmadı.');
      return;
    }
    let tenantId;
    const tenants = await p.tenant.findMany({ take: 1 });
    if (tenants.length === 0) {
      const t = await p.tenant.create({
        data: { name: 'Yeni Firma', slug: 'firma', plan: 'trial', isActive: true }
      });
      tenantId = t.id;
      console.log('[OK] Tenant oluşturuldu:', tenantId);
    } else {
      tenantId = tenants[0].id;
    }
    const email = process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@degistir.local';
    const pass = process.env.ADMIN_BOOTSTRAP_PASSWORD || crypto.randomBytes(12).toString('base64url');
    await p.user.create({
      data: { tenantId, email: email, name: 'Admin', passwordHash: await bcrypt.hash(pass, 12), role: 'ADMIN', isActive: true }
    });
    console.log('[OK] İLK admin oluşturuldu: ' + email);
    if (!process.env.ADMIN_BOOTSTRAP_PASSWORD) {
      console.log('[ÖNEMLİ] Üretilen geçici şifre: ' + pass + '  — GİRİP HEMEN DEĞİŞTİRİN.');
    }
  } catch(e) {
    console.error('[WARN] Admin bootstrap hatası (non-fatal):', e.message);
  } finally {
    await p.\$disconnect().catch(function(){});
  }
}
bootstrapAdmin();
" 2>&1

echo "=== [5/5] Starting Next.js server ==="
exec node server.js
