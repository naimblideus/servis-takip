// TARAYICI KURULUM PROVASI — yerel bayi.
//
// Çalıştır:  node scripts/seed-tarayici-prova.mjs
// Sonra:     node scripts/snmp-benzetim.mjs  (ayrı pencerede, sahte yazıcılar)
//
// Kiralık iki cihazlı, demo OLMAYAN bir bayi kurar (demo bayide tarayıcı
// kapalı). Cihaz serileri scripts/snmp-benzetim.mjs'teki sahte yazıcılarla
// aynı; geçen ayın (Eylül) okuması faturalanmış olarak durur, bu ayın sayacı
// tarayıcıdan gelir ve dönem faturası taslağı ondan çıkar. Fatura onayı ELLE:
// fatura kesilmez, taslakta bekler (provada kesilen gerçek fatura olmasın).
//
// Giriş (yalnız yerel geliştirme): prova-tarayici@nextusservis.local / prova1234
// Her çalıştırmada bayi silinip baştan kurulur. Üretimde ÇALIŞTIRMA.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

if (process.env.NODE_ENV === 'production' || /nextusservis\.com/.test(process.env.DATABASE_URL ?? '')) {
  console.error('Bu tohum yalnız yerel veritabanı içindir.'); process.exit(1);
}
const p = new PrismaClient();
const SLUG = 'tarayici-prova';
const EPOSTA = 'prova-tarayici@nextusservis.local';
const SIFRE = process.env.PROVA_SIFRE || 'prova1234';

const eski = await p.tenant.findUnique({ where: { slug: SLUG } });
if (eski) await p.tenant.delete({ where: { id: eski.id } });

const tenant = await p.tenant.create({
  data: {
    name: 'Tarayıcı Prova Fotokopi', slug: SLUG, plan: 'enterprise', isActive: true, maxUsers: 10,
    modules: ['INVOICING', 'ROUTE', 'TRACKING', 'REVENUE_RISK', 'REPORTS', 'PORTAL'],
    pricePerBlack: 0.45, pricePerColor: 2.25, faturaOnayi: 'ELLE', oemDataSharing: false,
  },
});
await p.user.create({
  data: { tenantId: tenant.id, email: EPOSTA, name: 'Prova Patron', passwordHash: await bcrypt.hash(SIFRE, 10), role: 'ADMIN', isActive: true },
});
const musteri = await p.customer.create({ data: { tenantId: tenant.id, name: 'Prova Hukuk Bürosu', phone: '05000000000', address: 'Kadıköy, İstanbul' } });

const kod = () => `PRV-${randomBytes(3).toString('hex').toUpperCase()}`;
const eylul = new Date('2026-09-30T10:00:00+03:00');
const cihazlar = [
  // Tek renkli Pantum: kira 1.500 ₺, 2.000 S/B dahil, aşım 0,45 ₺.
  { brand: 'Pantum', model: 'BP5100DN', serialNo: 'BNZ-PANTUM-0001', monthlyRent: 1500, includedBlack: 2000, includedColor: 0, overagePriceBlack: 0.45, siyah: 48000, renkli: 0 },
  // Renkli Kyocera: kira 2.500 ₺, 3.000 S/B + 500 renkli dahil.
  { brand: 'Kyocera', model: 'TASKalfa 2553ci', serialNo: 'BNZ-KYO-0002', monthlyRent: 2500, includedBlack: 3000, includedColor: 500, overagePriceBlack: 0.4, overagePriceColor: 2, siyah: 74000, renkli: 37500 },
];
for (const c of cihazlar) {
  const { siyah, renkli, ...alan } = c;
  const d = await p.device.create({
    data: {
      ...alan, tenantId: tenant.id, customerId: musteri.id, isRental: true, location: 'Ofis',
      installedAt: new Date('2025-03-01'), publicCode: kod(), qrTokenHash: `prova-${c.serialNo}`,
      counterBlack: siyah, counterColor: renkli, lastInvoicedPeriod: '2026-09',
    },
  });
  // Eylül okuması: zincirin başı, Eylül faturasında kullanılmış.
  await p.counterReading.create({
    data: { tenantId: tenant.id, deviceId: d.id, readingDate: eylul, counterBlack: siyah, counterColor: renkli, source: 'ELLE', faturaDonemi: '2026-09', billed: true },
  });
}
console.log(`✓ ${tenant.name} kuruldu (${cihazlar.length} kiralık cihaz). Giriş: ${EPOSTA}`);
await p.$disconnect();
