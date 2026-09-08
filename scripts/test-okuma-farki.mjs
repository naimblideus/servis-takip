// SAYAÇ FARKI — TEK KURAL, HER YOLDA AYNI
// Çalıştır:  node scripts/test-okuma-farki.mjs   (önce `npm run dev`)
//
// NEDEN BU TEST
// readings.ts'in başında "bu mantık kopyalanmamalı" yazıyordu ve mantık
// KOPYALANMIŞTI: okuma DÜZENLEME ucu (PATCH) kendi hesabını taşıyordu ve o
// hesap, oluşturma yolunda düzeltilen hatanın eski hâlindeydi — yalnız düşüş
// yönünü koruyor, sıfırlama TÜRÜNÜ hiç bilmiyordu.
//
// Bu testin işi kuralı doğrulamak değil, KURALIN TEK OLDUĞUNU çivilemek:
// aynı beyan hangi ekrandan verilirse verilsin aynı tutarı üretmeli. Bir
// kiralamacı için "hangi düğmeye bastığına göre değişen fatura", yanlış
// hesaptan daha büyük bir güven sorunudur.
import { mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-fark-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/readings.ts'), join(KOK, 'src/lib/sayac-anomali.ts'),
    join(KOK, 'src/lib/prisma.ts'), join(KOK, 'src/lib/invoicing.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }

const { readFileSync, writeFileSync } = await import('node:fs');
const PC = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
writeFileSync(join(g, 'prisma-shim.js'),
  `import { PrismaClient } from ${JSON.stringify(PC)};\nexport const prisma = new PrismaClient();\n`);
for (const [dosya, esle] of [
  ['readings.js', [["'@/lib/prisma'", "'./prisma-shim.js'"], ["'@/lib/invoicing'", "'./invoicing.js'"],
    ["'@/lib/sayac-anomali'", "'./sayac-anomali.js'"], ["'@prisma/client'", JSON.stringify(PC)]]],
  ['invoicing.js', [["'@/lib/prisma'", "'./prisma-shim.js'"], ["'@prisma/client'", JSON.stringify(PC)]]],
]) {
  const y = join(g, dosya);
  let t = readFileSync(y, 'utf8');
  for (const [a, b] of esle) t = t.split(a).join(b);
  writeFileSync(y, t);
}
const { okumaFarki } = await import(pathToFileURL(join(g, 'readings.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

console.log('\nKURALIN KENDİSİ\n');
t('zincirin başında fark yazılmaz', okumaFarki(5000, null) === 0);
t('normal artış farkı verir', okumaFarki(5000, 3000) === 2000);
t('onaysız düşüş negatif üretmez', okumaFarki(1000, 3000) === 0);
{
  // ★ ASIL HATA: cihaz değişiminde sayaç ARTAR. Depodan takılan ikinci el
  //   makinenin ömür boyu sayacı, müşterinin o ay bastığı sayfa DEĞİLDİR.
  const fark = okumaFarki(480000, 10000, true, 'CIHAZ_DEGISTI');
  t('cihaz değişimi ARTIŞ yönünde de fark üretmiyor', fark === 0, fark);
  t('cihaz değişimi düşüş yönünde de fark üretmiyor',
    okumaFarki(2000, 620000, true, 'CIHAZ_DEGISTI') === 0);
}
{
  // Sıfırlama: AYNI makine, okunan değer sıfırlamadan sonraki gerçek kullanım.
  t('sayaç sıfırlanmasında okunan değer faturalanır',
    okumaFarki(12000, 620000, true, 'SAYAC_SIFIRLANDI') === 12000);
  // Sıfırlama beyanı ama sayaç ARTMIŞ → sıfırlama olmamış, normal fark.
  t('sıfırlama beyanına rağmen sayaç artmışsa normal fark alınır',
    okumaFarki(9000, 5000, true, 'SAYAC_SIFIRLANDI') === 4000);
}
{
  // Tür verilmezse güvenli taraf: eksik faturalamak, fahiş faturalamaktan iyi.
  t('tür verilmezse CIHAZ_DEGISTI varsayılır (fark 0)',
    okumaFarki(480000, 10000, true) === 0 && okumaFarki(2000, 620000, true) === 0);
}

// ── UÇLAR AYNI SONUCU VERMELİ ────────────────────────────────────────────
const KOKURL = process.env.SAYAC_TEST_KOK || 'http://localhost:3002';
const p = new PrismaClient();
let sunucu = true;
try { await fetch(`${KOKURL}/api/rozetler`); } catch { sunucu = false; }

if (!sunucu) {
  console.log(`\n(uç karşılaştırması ATLANDI: ${KOKURL} ayakta değil)\n`);
} else {
  const SLUG = 'test-okuma-farki';
  try {
    const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
    if (eski) await p.tenant.delete({ where: { id: eski.id } });
    const tenant = await p.tenant.create({
      data: {
        name: SLUG, slug: SLUG, pricePerBlack: 0.5, pricePerColor: 2,
        users: { create: { email: 'fark@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'T', role: 'ADMIN', isActive: true } },
      },
    });
    const musteri = await p.customer.create({ data: { tenantId: tenant.id, name: 'Fark Müşteri', phone: '5550000000' } });

    const csrfY = await fetch(`${KOKURL}/api/auth/csrf`);
    const csrfCerez = (csrfY.headers.get('set-cookie') || '').split(';')[0];
    const { csrfToken } = await csrfY.json();
    const gy = await fetch(`${KOKURL}/api/auth/callback/credentials`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: csrfCerez },
      body: new URLSearchParams({ email: 'fark@test.local', password: 'test1234', csrfToken, redirect: 'false', json: 'true' }),
      redirect: 'manual',
    });
    const cerezler = [csrfCerez];
    for (const c of (gy.headers.getSetCookie?.() ?? [])) cerezler.push(c.split(';')[0]);
    const cerez = cerezler.join('; ');

    /** Kiralık cihaz + başlangıç okuması (10.000 sayfa). */
    const cihazKur = async (seri, baslangic = 10000) => {
      const c = await p.device.create({
        data: {
          tenantId: tenant.id, customerId: musteri.id, brand: 'Kyocera', model: 'M2540',
          serialNo: seri, isRental: true, monthlyRent: 0, includedBlack: 0, includedColor: 0,
          publicCode: `FRK-${seri}`, qrTokenHash: 'x', counterBlack: baslangic, counterColor: 0,
        },
      });
      await p.counterReading.create({
        data: {
          tenantId: tenant.id, deviceId: c.id, counterBlack: baslangic, counterColor: 0,
          deltaBlack: 0, deltaColor: 0, calculatedCost: 0, billed: false, source: 'ELLE',
          readingDate: new Date(Date.now() - 30 * 86400000),
        },
      });
      return c;
    };

    console.log('\nCİHAZ KARTI İLE SAYAÇ TURU AYNI PARAYI YAZMALI\n');
    {
      // Aynı olay: 480.000 sayfalık ikinci el makine takıldı, bayi beyan etti.
      const kart = await cihazKur('FARK-KART');
      const tur = await cihazKur('FARK-TUR');

      const y1 = await fetch(`${KOKURL}/api/devices/${kart.id}/readings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
        body: JSON.stringify({ counterBlack: 480000, counterColor: 0, includeMonthlyRent: false, reset: true, resetTur: 'CIHAZ_DEGISTI' }),
      });
      const d1 = await y1.json();

      const y2 = await fetch(`${KOKURL}/api/readings/bulk`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
        body: JSON.stringify({ rows: [{ deviceId: tur.id, counterBlack: 480000, counterColor: 0, reset: true, resetTur: 'CIHAZ_DEGISTI' }] }),
      });
      const d2 = await y2.json();
      const satir = (d2.results || [])[0];

      t('cihaz kartı kabul etti', y1.ok, d1);
      t('sayaç turu kabul etti', satir?.ok === true, d2);
      t('cihaz kartında fark 0 (yeni makinenin geçmişi faturalanmıyor)', d1.deltaBlack === 0, d1);
      t('sayaç turunda da fark 0', satir?.deltaBlack === 0 || satir?.cost === 0, satir);
      t('İKİ EKRAN AYNI TUTARI YAZDI', Number(d1.calculatedCost) === Number(satir?.cost ?? -1),
        { kart: d1.calculatedCost, tur: satir?.cost });
    }
    {
      // Aynı olay, bu kez GERÇEK sıfırlama: aynı makine, 12.000 sayfa basılmış.
      // Gerçek sıfırlamada sayaç DÜŞER: 620.000da duran makine sıfırlanmış,
      // ardından 12.000 sayfa basılmış. (İlk denemede fikstürü 10.000den
      // başlatmıştım; 12.000 > 10.000 olduğu için sıfırlama değil normal fark
      // çıkıyordu — kural doğruydu, test yanlıştı.)
      const kart = await cihazKur('SIFIR-KART', 620000);
      const tur = await cihazKur('SIFIR-TUR', 620000);

      const y1 = await fetch(`${KOKURL}/api/devices/${kart.id}/readings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
        body: JSON.stringify({ counterBlack: 12000, counterColor: 0, includeMonthlyRent: false, reset: true, resetTur: 'SAYAC_SIFIRLANDI' }),
      });
      const d1 = await y1.json();
      const y2 = await fetch(`${KOKURL}/api/readings/bulk`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
        body: JSON.stringify({ rows: [{ deviceId: tur.id, counterBlack: 12000, counterColor: 0, reset: true, resetTur: 'SAYAC_SIFIRLANDI' }] }),
      });
      const satir = ((await y2.json()).results || [])[0];

      t('cihaz kartı "sayaç sıfırlandı" beyanını artık KABUL EDİYOR', y1.ok, d1);
      t('sıfırlamada okunan değer faturalanıyor (kart)', d1.deltaBlack === 12000, d1);
      t('sıfırlamada okunan değer faturalanıyor (tur)', satir?.ok === true, satir);
      t('İKİ EKRAN AYNI TUTARI YAZDI', Number(d1.calculatedCost) === Number(satir?.cost ?? -1),
        { kart: d1.calculatedCost, tur: satir?.cost });
      t('bu para gerçekten sıfır DEĞİL (sessiz kayıp yok)', Number(d1.calculatedCost) === 6000, d1.calculatedCost);
    }

    console.log('\nKUYRUK EKRANI DA AYNI KURALI KULLANMALI\n');
    {
      // Cihazdan Sayaç kuyruğunda TEK kutu vardı: "Sayaç sıfırlandı". Ama uç
      // sebebi almadığı için sistem CIHAZ_DEGISTI sayıp farkı SIFIR yazıyordu —
      // etiket bir şey vaat ediyor, sistem başkasını yapıyordu. Bu iki durum,
      // bir kiralamacı için ayın tüm kullanımı kadar fark demek.
      const kuyrukKur = async (seri) => {
        const c = await cihazKur(seri, 620000);
        const k = await p.counterEmail.create({
          data: { tenantId: tenant.id, rawText: 'test raporu', serial: seri, status: 'BEKLIYOR', parsedBlack: 12000, parsedColor: 0 },
        });
        return { c, k };
      };

      const a = await kuyrukKur('KUYRUK-SIFIR');
      const ya = await fetch(`${KOKURL}/api/sayac/eposta/bekleyen`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
        body: JSON.stringify({ id: a.k.id, deviceId: a.c.id, counterBlack: 12000, counterColor: 0, reset: true, resetTur: 'SAYAC_SIFIRLANDI' }),
      });
      const da = await ya.json();
      const oa = await p.counterReading.findFirst({ where: { deviceId: a.c.id }, orderBy: { readingDate: 'desc' } });
      t('kuyruk "sayaç sıfırlandı" beyanını kabul etti', ya.ok, da);
      t('kuyrukta sıfırlama gerçek kullanımı faturalıyor (eskiden 0 yazıyordu)',
        oa?.deltaBlack === 12000, oa);

      const b = await kuyrukKur('KUYRUK-DEGISTI');
      const yb = await fetch(`${KOKURL}/api/sayac/eposta/bekleyen`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
        body: JSON.stringify({ id: b.k.id, deviceId: b.c.id, counterBlack: 12000, counterColor: 0, reset: true, resetTur: 'CIHAZ_DEGISTI' }),
      });
      const ob = await p.counterReading.findFirst({ where: { deviceId: b.c.id }, orderBy: { readingDate: 'desc' } });
      t('kuyrukta cihaz değişimi fark üretmiyor', yb.ok && ob?.deltaBlack === 0, ob);

      t('ÜÇ EKRAN DA AYNI BEYANDA AYNI FARKI YAZIYOR',
        oa?.deltaBlack === 12000 && ob?.deltaBlack === 0,
        { sifirlandi: oa?.deltaBlack, degisti: ob?.deltaBlack });
    }

    console.log('\nSERVİS FİŞİ YOLU DA AYNI KURALI KULLANMALI\n');
    {
      // Fiş açılırken sayaç da yazılıyor (SERVIS_FISI kaynağı). Bu yol sebebi
      // hiç geçirmiyordu; formda sebep sorusu olmadığı için yanlış bir vaat
      // yoktu ama kural yine çatallanmış oluyordu. Beş yazma yolunun beşi de
      // aynı kurala bağlı olmalı, yoksa bir sonraki ekran yine ayrışır.
      const c1 = await cihazKur('FIS-DEGISTI', 10000);
      const y1 = await fetch(`${KOKURL}/api/tickets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
        body: JSON.stringify({ customerId: musteri.id, deviceId: c1.id, issueText: 'test arıza',
          counterBlack: 480000, counterColor: 0, counterReset: true, counterResetTur: 'CIHAZ_DEGISTI' }),
      });
      const o1 = await p.counterReading.findFirst({ where: { deviceId: c1.id }, orderBy: { readingDate: 'desc' } });
      t('fiş yolunda cihaz değişimi fark üretmiyor', y1.ok && o1?.deltaBlack === 0, { ok: y1.ok, delta: o1?.deltaBlack });

      const c2 = await cihazKur('FIS-SIFIR', 620000);
      const y2 = await fetch(`${KOKURL}/api/tickets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
        body: JSON.stringify({ customerId: musteri.id, deviceId: c2.id, issueText: 'test arıza',
          counterBlack: 12000, counterColor: 0, counterReset: true, counterResetTur: 'SAYAC_SIFIRLANDI' }),
      });
      const o2 = await p.counterReading.findFirst({ where: { deviceId: c2.id }, orderBy: { readingDate: 'desc' } });
      t('fiş yolunda sıfırlama gerçek kullanımı faturalıyor', y2.ok && o2?.deltaBlack === 12000, { ok: y2.ok, delta: o2?.deltaBlack });
    }

    console.log('\nDÜZENLEME UCU DA AYNI KURALI KULLANMALI\n');
    {
      // PATCH kendi kopyasını taşıyordu: cihaz değişimi beyan edilse bile
      // artış yönünde ham farkı yazıyordu.
      const c = await cihazKur('FARK-PATCH');
      const y = await fetch(`${KOKURL}/api/devices/${c.id}/readings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', cookie: cerez },
        body: JSON.stringify({ counterBlack: 11000, counterColor: 0, includeMonthlyRent: false }),
      });
      const oku = await y.json();
      t('düzenlenecek okuma oluştu', y.ok && oku.deltaBlack === 1000, oku);

      const yp = await fetch(`${KOKURL}/api/devices/${c.id}/readings?readingId=${oku.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', cookie: cerez },
        body: JSON.stringify({ counterBlack: 480000, counterColor: 0, reset: true, resetTur: 'CIHAZ_DEGISTI' }),
      });
      const dp = await yp.json();
      t('düzenleme kabul edildi', yp.ok, dp);
      t('DÜZENLEMEDE de cihaz değişimi fark üretmiyor (eski kopya 470.000 yazıyordu)',
        dp.reading?.deltaBlack === 0, dp);
    }
  } finally {
    const e = await p.tenant.findFirst({ where: { slug: SLUG } });
    if (e) await p.tenant.delete({ where: { id: e.id } });
    console.log('\n  (temizlik: test bayisi silindi)');
  }
}
await p.$disconnect();

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
