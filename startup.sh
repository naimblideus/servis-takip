#!/bin/sh
# set -e KALDIRILDI: migration hataları sunucuyu durdurmasın

# PRISMA CLI ADIMLARI KALDIRILDI (2026-09-16)
#
# Burada eskiden `migrate resolve` ve `migrate deploy` çalışıyordu. Çalışma
# imajında prisma MOTORU yok (sadece @prisma/client), bu yüzden ikisi de her
# açılışta başarısız oluyordu — biliniyordu ve "best-effort" diye geçiliyordu.
#
# Ama zararsız değillerdi: `migrate deploy` başarısız olmadan ÖNCE
# _prisma_migrations tablosuna finished_at'i BOŞ bir satır yazıyor. O satır
# kalıcı olarak "yarım kalmış göç" demek. Sonucu iki tane:
#   1. Sağlık raporu her deploy'dan sonra gerçek olmayan bir arıza gösteriyor
#      ve bir süre sonra kimse raporun kırmızısına inanmıyor.
#   2. İleride prisma CLI'nin çalıştığı bir ortamda `migrate deploy`, yarım
#      kayıt yüzünden HİÇBİR göçü uygulamayı reddeder.
#
# Asıl işi zaten aşağıdaki dinamik uygulayıcı yapıyor.

echo "=== [1/3] TÜM migration'ları dinamik + idempotent uygula ==="
# prisma CLI/engine olmasa bile @prisma/client ile tüm prisma/migrations/*/migration.sql
# dosyalarını uygular. Yeni migration eklenince otomatik yakalanır -> bir daha eksik-kolon krizi olmaz.
node apply-migrations.js 2>&1 || echo "!!! apply-migrations sorun yaşadı (non-fatal)"

echo "=== [2/3] Admin BOOTSTRAP — yalnızca HİÇ kullanıcı yoksa; mevcut şifreye DOKUNMAZ ==="
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

echo "=== [3/3] Starting Next.js server ==="
exec node server.js
