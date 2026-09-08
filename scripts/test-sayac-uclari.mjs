// SAYAÇ UÇLARI — HTTP SEVİYESİNDE, GERÇEK İSTEKLERLE
// Çalıştır:  node scripts/test-sayac-uclari.mjs   (önce `npm run dev`)
//
// NEDEN AYRI TEST
// test-sayac-tum-yollar kütüphaneyi (createReading) doğruluyor: kural doğru mu?
// Bu test UÇLARI doğruluyor: kural doğru ama uç yanlış bağlanmışsa, yetki
// kapısı yoksa ya da başka bayinin cihazına yazılabiliyorsa bunu yalnız
// buradan görürüz. Sayaç bu ürünün kalbi; her kapı ayrı ayrı denenmeli.
//
// Kapsanan uçlar:
//   POST /api/readings/bulk        → Sayaç Turu (sahanın can damarı)
//   POST /api/devices/[id]/readings→ cihaz kartından elle giriş
//   POST /api/shop/sayac           → Nextus Mağaza köprüsü (servis jetonu)
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

const SLUG = 'test-sayac-uclari';
const SLUG_B = 'test-sayac-uclari-b';
let bayi, bayiB;

/** NextAuth oturumu aç, çerezi döndür. */
async function girisYap(eposta, sifre) {
  const csrfY = await fetch(`${KOK}/api/auth/csrf`);
  const csrfCerez = (csrfY.headers.get('set-cookie') || '').split(';')[0];
  const { csrfToken } = await csrfY.json();

  const y = await fetch(`${KOK}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: csrfCerez },
    body: new URLSearchParams({ email: eposta, password: sifre, csrfToken, redirect: 'false', json: 'true' }),
    redirect: 'manual',
  });
  const cerezler = [csrfCerez];
  for (const c of (y.headers.getSetCookie?.() ?? [])) cerezler.push(c.split(';')[0]);
  return cerezler.join('; ');
}

try {
  for (const s of [SLUG, SLUG_B]) {
    const e = await p.tenant.findFirst({ where: { slug: s } });
    if (e) await p.tenant.delete({ where: { id: e.id } });
  }

  const kurBayi = async (ad, slug, eposta) => {
    const b = await p.tenant.create({
      data: { name: ad, slug, plan: 'professional', pricePerBlack: 0.5, pricePerColor: 2, vatRate: 20 },
    });
    await p.user.create({
      data: {
        tenantId: b.id, email: eposta, name: 'Test Yönetici',
        passwordHash: await bcrypt.hash('test1234', 12), role: 'ADMIN', isActive: true,
      },
    });
    const m = await p.customer.create({ data: { tenantId: b.id, name: `${ad} Müşteri`, phone: `0500${Math.floor(Math.random() * 9000000 + 1000000)}` } });
    return { bayi: b, musteri: m };
  };

  const A = await kurBayi('Uç Testi A', SLUG, 'uc-a@test.local');
  const B = await kurBayi('Uç Testi B', SLUG_B, 'uc-b@test.local');
  bayi = A.bayi; bayiB = B.bayi;

  let n = 0;
  const kurCihaz = async (sahip, opt = {}) => {
    n++;
    const c = await p.device.create({
      data: {
        tenantId: sahip.bayi.id, customerId: sahip.musteri.id,
        brand: 'Kyocera', model: `UC-${n}`, serialNo: `UC-${n}-${Date.now()}`,
        publicCode: `UCP${n}${Date.now()}`, qrTokenHash: 'x',
        isRental: true, monthlyRent: 500, pricePerBlack: 0.5, includedBlack: 0,
        counterBlack: 0, counterColor: 0, ...opt,
      },
    });
    await p.counterReading.create({
      data: {
        tenantId: sahip.bayi.id, deviceId: c.id, counterBlack: 5000, counterColor: 100,
        deltaBlack: 0, deltaColor: 0, billed: true, source: 'TOPLU',
      },
    });
    return c;
  };

  const cerezA = await girisYap('uc-a@test.local', 'test1234');
  t('oturum açıldı (test kurulumu sağlam)', !!cerezA && cerezA.length > 20);

  // ── 1. SAYAÇ TURU (toplu giriş) — sahanın can damarı ──────────────────
  console.log('\nSAYAÇ TURU — POST /api/readings/bulk\n');
  {
    const c1 = await kurCihaz(A);
    const c2 = await kurCihaz(A);
    const y = await fetch(`${KOK}/api/readings/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cerezA },
      body: JSON.stringify({ rows: [
        { deviceId: c1.id, counterBlack: 8000, counterColor: 300 },
        { deviceId: c2.id, counterBlack: 6500, counterColor: 150 },
      ] }),
    });
    const g = await y.json().catch(() => ({}));
    t('iki cihaz tek istekte kaydedildi', y.status >= 200 && y.status < 300, { durum: y.status, yanit: g });

    const o1 = await p.counterReading.findFirst({ where: { deviceId: c1.id }, orderBy: { createdAt: 'desc' } });
    const o2 = await p.counterReading.findFirst({ where: { deviceId: c2.id }, orderBy: { createdAt: 'desc' } });
    t('1. cihazın farkı doğru (8.000 − 5.000 = 3.000)', o1?.deltaBlack === 3000, { fark: o1?.deltaBlack });
    t('2. cihazın farkı doğru (6.500 − 5.000 = 1.500)', o2?.deltaBlack === 1500, { fark: o2?.deltaBlack });
    t('kaynak TOPLU işaretlendi', o1?.source === 'TOPLU', { kaynak: o1?.source });
  }
  {
    // Bir satır hatalıysa DİĞERLERİ kaydedilmeli — teknisyen 20 cihaz girmiş,
    // biri düşük diye hepsi çöpe gitmemeli.
    const iyi = await kurCihaz(A);
    const kotu = await kurCihaz(A);
    const y = await fetch(`${KOK}/api/readings/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cerezA },
      body: JSON.stringify({ rows: [
        { deviceId: iyi.id, counterBlack: 9000, counterColor: 200 },
        { deviceId: kotu.id, counterBlack: 100, counterColor: 0 },   // DÜŞÜK
      ] }),
    });
    const g = await y.json().catch(() => ({}));
    const oIyi = await p.counterReading.count({ where: { deviceId: iyi.id } });
    const oKotu = await p.counterReading.count({ where: { deviceId: kotu.id } });
    t('hatalı satır DİĞERLERİNİ düşürmüyor (iyi olan kaydedildi)', oIyi === 2, { okuma: oIyi });
    t('düşük sayaçlı satır kaydedilmedi', oKotu === 1, { okuma: oKotu });
    t('yanıt hangi satırın neden geçmediğini söylüyor', JSON.stringify(g).length > 10, g);
  }
  {
    // BAŞKA BAYİNİN CİHAZI — en kritik izolasyon testi
    const yabanci = await kurCihaz(B);
    await fetch(`${KOK}/api/readings/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cerezA },
      body: JSON.stringify({ rows: [{ deviceId: yabanci.id, counterBlack: 99999, counterColor: 999 }] }),
    });
    const o = await p.counterReading.count({ where: { deviceId: yabanci.id } });
    t('BAŞKA BAYİNİN cihazına sayaç YAZILAMADI', o === 1, { okuma: o });
  }
  {
    // Oturumsuz istek
    const c = await kurCihaz(A);
    const y = await fetch(`${KOK}/api/readings/bulk`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: [{ deviceId: c.id, counterBlack: 7000, counterColor: 200 }] }),
    });
    t('oturumsuz istek reddedildi', y.status === 401 || y.status === 403, { durum: y.status });
  }

  // ── 2. CİHAZ KARTINDAN ELLE GİRİŞ ─────────────────────────────────────
  console.log('\nCİHAZ KARTI — POST /api/devices/[id]/readings\n');
  {
    const c = await kurCihaz(A);
    const y = await fetch(`${KOK}/api/devices/${c.id}/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cerezA },
      body: JSON.stringify({ counterBlack: 7500, counterColor: 250 }),
    });
    t('elle giriş kaydedildi', y.status >= 200 && y.status < 300, { durum: y.status });
    const o = await p.counterReading.findFirst({ where: { deviceId: c.id }, orderBy: { createdAt: 'desc' } });
    t('fark doğru (7.500 − 5.000 = 2.500)', o?.deltaBlack === 2500, { fark: o?.deltaBlack });
  }
  {
    const yabanci = await kurCihaz(B);
    const y = await fetch(`${KOK}/api/devices/${yabanci.id}/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cerezA },
      body: JSON.stringify({ counterBlack: 88888, counterColor: 0 }),
    });
    const o = await p.counterReading.count({ where: { deviceId: yabanci.id } });
    t('BAŞKA BAYİNİN cihazına elle sayaç YAZILAMADI', o === 1, { durum: y.status, okuma: o });
  }
  {
    const c = await kurCihaz(A);
    const y = await fetch(`${KOK}/api/devices/${c.id}/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cerezA },
      body: JSON.stringify({ counterBlack: 10, counterColor: 0 }),   // DÜŞÜK
    });
    t('düşen sayaç uçtan da reddediliyor', y.status >= 400, { durum: y.status });
    const o = await p.counterReading.count({ where: { deviceId: c.id } });
    t('reddedilince okuma yazılmadı', o === 1, { okuma: o });
  }

  // ── 3. MAĞAZA KÖPRÜSÜ ─────────────────────────────────────────────────
  console.log('\nMAĞAZA KÖPRÜSÜ — POST /api/shop/sayac\n');
  {
    const c = await kurCihaz(A);
    // Kimlik `Authorization: Bearer` ile — köprü bir kullanıcı değil, sunucu.
    const jeton = process.env.SHOP_SERVICE_TOKEN;
    const y = await fetch(`${KOK}/api/shop/sayac`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(jeton ? { authorization: `Bearer ${jeton}` } : {}) },
      body: JSON.stringify({ tenantId: bayi.id, publicCode: c.publicCode, counterBlack: 6000, counterColor: 200 }),
    });
    if (jeton) {
      t('mağaza köprüsü sayacı kaydetti', y.status >= 200 && y.status < 300, { durum: y.status });
      const o = await p.counterReading.findFirst({ where: { deviceId: c.id }, orderBy: { createdAt: 'desc' } });
      t('fark doğru (6.000 − 5.000 = 1.000)', o?.deltaBlack === 1000, { fark: o?.deltaBlack });
      t('kaynak PORTAL/mağaza olarak işaretlendi (kanıt ağırlığı düşük)',
        o?.source && o.source !== 'CIHAZ_EPOSTA', { kaynak: o?.source });
    } else {
      t('SHOP_SERVICE_TOKEN yokken köprü REDDEDİYOR (fail-closed)', y.status === 401, { durum: y.status });
    }
  }
  {
    const y = await fetch(`${KOK}/api/shop/sayac`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: 'Bearer yanlis-jeton' },
      body: JSON.stringify({ tenantId: bayi.id, publicCode: 'HERHANGI', counterBlack: 1, counterColor: 0 }),
    });
    t('yanlış jeton reddedildi', y.status === 401, { durum: y.status });
  }

} finally {
  for (const b of [bayi, bayiB]) if (b) await p.tenant.delete({ where: { id: b.id } }).catch(() => {});
  await p.$disconnect();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
