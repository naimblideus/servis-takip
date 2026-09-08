// CİHAZ EKLERKEN GİRİLEN DEVİR SAYACI KAYBOLMAMALI
// Çalıştır:  node scripts/test-cihaz-ekleme.mjs   (önce `npm run dev`)
//
// NEDEN BU TEST
// Bayi sahada müşterinin makinesini eklerken üstündeki sayacı da yazıyor.
// O değer YALNIZCA cihaz kartına yazılıyordu; okuma kaydı üretmiyordu.
// Sonuç sessiz kayıp: kartta 48.210 yazıyor, ilk gerçek okuma 52.410
// geldiğinde zincirin başı orası sayılıyor ve aradaki 4.200 sayfa hiçbir
// yere düşmüyor — ne faturaya, ne geçmişe.
//
// Aynı hata içe aktarma yolunda bulunup düzeltilmişti (bir bayide 552
// cihazda 69,7 milyon sayfa yazılıydı, okuma sayısı sıfırdı). Elle ekleme
// yolu o düzeltmenin dışında kalmıştı. Bu test iki yolu birbirine bağlıyor.
//
// Sunucu kapalıysa ATLAR, hata vermez.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const p = new PrismaClient();
const KOK = process.env.SAYAC_TEST_KOK || 'http://localhost:3002';

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

try {
  await fetch(`${KOK}/api/rozetler`);
} catch {
  console.log(`ATLANDI: ${KOK} ayakta değil (önce npm run dev).`);
  await p.$disconnect();
  process.exit(0);
}

const SLUG = 'test-cihaz-ekleme';
try {
  const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });
  const tenant = await p.tenant.create({
    data: {
      name: SLUG, slug: SLUG, pricePerBlack: 0.5, pricePerColor: 2,
      users: { create: { email: 'ekleme@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'T', role: 'ADMIN', isActive: true } },
    },
  });
  const musteri = await p.customer.create({ data: { tenantId: tenant.id, name: 'Ekleme Müşteri', phone: '5550000000' } });

  const csrfY = await fetch(`${KOK}/api/auth/csrf`);
  const csrfCerez = (csrfY.headers.get('set-cookie') || '').split(';')[0];
  const { csrfToken } = await csrfY.json();
  const gy = await fetch(`${KOK}/api/auth/callback/credentials`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: csrfCerez },
    body: new URLSearchParams({ email: 'ekleme@test.local', password: 'test1234', csrfToken, redirect: 'false', json: 'true' }),
    redirect: 'manual',
  });
  const cerezler = [csrfCerez];
  for (const c of (gy.headers.getSetCookie?.() ?? [])) cerezler.push(c.split(';')[0]);
  const cerez = cerezler.join('; ');

  console.log('\nDEVİR SAYACI ZİNCİRİN BAŞI OLARAK YAZILMALI\n');
  {
    const y = await fetch(`${KOK}/api/devices`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({
        customerId: musteri.id, brand: 'Kyocera', model: 'TASKalfa 3554ci',
        serialNo: 'EKLEME-DEVIR', isRental: true, monthlyRent: 2500,
        includedBlack: 0, includedColor: 0, counterBlack: 48210, counterColor: 0,
      }),
    });
    const cihaz = await y.json();
    t('cihaz oluşturuldu', y.ok, cihaz);

    const okumalar = await p.counterReading.findMany({ where: { deviceId: cihaz.id }, orderBy: { readingDate: 'asc' } });
    t('devir sayacı için okuma kaydı YAZILDI', okumalar.length === 1, okumalar.length);
    t('zincirin başı devredilen değerle açılıyor', okumalar[0]?.counterBlack === 48210, okumalar[0]);
    t('devredilen sayaç bu ayın kullanımı sayılmıyor (fark 0)', okumalar[0]?.deltaBlack === 0, okumalar[0]);
    t('faturaya asla girmiyor (billed)', okumalar[0]?.billed === true, okumalar[0]);
    t('tutar üretmiyor', Number(okumalar[0]?.calculatedCost) === 0, okumalar[0]?.calculatedCost);

    // ★ ASIL KAZANÇ: ilk gerçek okuma artık farkı DOĞRU hesaplıyor.
    const y2 = await fetch(`${KOK}/api/devices/${cihaz.id}/readings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({ counterBlack: 52410, counterColor: 0, includeMonthlyRent: false }),
    });
    const okuma = await y2.json();
    t('ilk gerçek okuma 4.200 sayfayı yakalıyor (eskiden 0 yazıyordu)',
      okuma.deltaBlack === 4200, okuma);
    t('o sayfalar paraya dönüyor', Number(okuma.calculatedCost) === 2100, okuma.calculatedCost);
  }

  console.log('\nSAYAÇ GİRİLMEDİYSE BOŞ OKUMA ÜRETİLMEMELİ\n');
  {
    const y = await fetch(`${KOK}/api/devices`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
      body: JSON.stringify({
        customerId: musteri.id, brand: 'Canon', model: 'iR2625',
        serialNo: 'EKLEME-BOS', isRental: true, monthlyRent: 1000,
      }),
    });
    const cihaz = await y.json();
    const okumalar = await p.counterReading.count({ where: { deviceId: cihaz.id } });
    t('sayaç bilinmiyorsa uydurma okuma yazılmıyor', y.ok && okumalar === 0, { ok: y.ok, okumalar });
  }
} finally {
  const e = await p.tenant.findFirst({ where: { slug: SLUG } });
  if (e) await p.tenant.delete({ where: { id: e.id } });
  console.log('\n  (temizlik: test bayisi silindi)');
  await p.$disconnect();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
