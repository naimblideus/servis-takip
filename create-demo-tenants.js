/**
 * 5 DEMO BAYİ (tenant) + admin kullanıcı oluşturur.
 * - Idempotent: admin e-postası zaten varsa O tenant ATLANIR (tekrar çalıştırmak güvenli).
 * - Tenant'lar BOŞ gelir -> bayi ilk girişte eğitim sihirbazı + Başlangıç Rehberi görür.
 * - Çıktı: kopyalanabilir giriş bilgileri tablosu (email + şifre).
 * Çalıştırma (PROD container içinde): node create-demo-tenants.js
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const p = new PrismaClient();

// Okunması/iletilmesi kolay, karışık olmayan şifre (8 karakter, ambiguous karakter yok)
function genPassword() {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[bytes[i] % chars.length];
  return out;
}

const PRO = { maxUsers: 10, maxTicketsPerMonth: null, storageLimitMB: 2000 };

const TENANTS = [
  { name: 'Demo Bayi 1', slug: 'demo-bayi-1', email: 'demo1@servistakip.com', ownerName: 'Demo Bayi 1 Yetkilisi', phone: '0500 000 0001', city: 'İstanbul' },
  { name: 'Demo Bayi 2', slug: 'demo-bayi-2', email: 'demo2@servistakip.com', ownerName: 'Demo Bayi 2 Yetkilisi', phone: '0500 000 0002', city: 'Ankara' },
  { name: 'Demo Bayi 3', slug: 'demo-bayi-3', email: 'demo3@servistakip.com', ownerName: 'Demo Bayi 3 Yetkilisi', phone: '0500 000 0003', city: 'İzmir' },
  { name: 'Demo Bayi 4', slug: 'demo-bayi-4', email: 'demo4@servistakip.com', ownerName: 'Demo Bayi 4 Yetkilisi', phone: '0500 000 0004', city: 'Bursa' },
  { name: 'Demo Bayi 5', slug: 'demo-bayi-5', email: 'demo5@servistakip.com', ownerName: 'Demo Bayi 5 Yetkilisi', phone: '0500 000 0005', city: 'Kütahya' },
];

async function main() {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30); // 30 gün deneme

  const out = [];
  for (const t of TENANTS) {
    const exists = await p.user.findFirst({ where: { email: t.email } });
    if (exists) {
      out.push({ tenant: t.name, email: t.email, password: '(zaten var — atlandı)', status: 'SKIP' });
      continue;
    }
    const password = genPassword();
    const passwordHash = await bcrypt.hash(password, 12);
    try {
      await p.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: t.name, slug: t.slug, plan: 'professional', isActive: true,
            ownerName: t.ownerName, phone: t.phone, email: t.email, city: t.city,
            businessType: 'general', trialEndsAt,
            maxUsers: PRO.maxUsers, maxTicketsPerMonth: PRO.maxTicketsPerMonth, storageLimitMB: PRO.storageLimitMB,
            adminNotes: 'DEMO bayi hesabi (pazarlama)',
          },
        });
        await tx.user.create({
          data: {
            tenantId: tenant.id, email: t.email, passwordHash,
            name: t.ownerName, role: 'ADMIN', isActive: true,
          },
        });
      });
      out.push({ tenant: t.name, email: t.email, password, status: 'OK' });
    } catch (e) {
      out.push({ tenant: t.name, email: t.email, password: '(HATA: ' + String(e.message).slice(0, 80) + ')', status: 'ERR' });
    }
  }

  console.log('\n==================== DEMO BAYİ GİRİŞ BİLGİLERİ ====================');
  for (const r of out) {
    console.log(`${r.status === 'OK' ? '✅' : r.status === 'SKIP' ? '⏭️ ' : '❌'} ${r.tenant.padEnd(14)} | ${r.email.padEnd(26)} | ${r.password}`);
  }
  console.log('==================================================================');
  console.log('CSV:');
  console.log('Bayi,Email,Sifre');
  out.filter((r) => r.status === 'OK').forEach((r) => console.log(`${r.tenant},${r.email},${r.password}`));
  console.log('==================================================================\n');

  await p.$disconnect();
}

main().catch(async (e) => { console.error('FATAL:', e.message); await p.$disconnect(); process.exit(1); });
