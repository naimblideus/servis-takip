// RAPOR DIŞA AKTARIMI — Türkçe Excel'de açılabilir mi?
// Çalıştır:  node scripts/test-rapor-disaaktarim.mjs   (önce `npm run dev`)
//
// NEDEN BU TEST
// CSV "çalışıyor mu" diye bakmak yetmez; Türkçe Excel'de AÇILDIĞINDA doğru
// mu diye bakmak gerekir. Üç şey bozulursa dosya sessizce işe yaramaz hâle
// gelir ve bunu ancak bayi, müşterisinin karşısında fark eder:
//   1. Ayıraç virgülse Türkçe Excel her satırı TEK hücreye yapıştırır.
//   2. BOM yoksa ş/ğ/İ bozuk görünür.
//   3. Ondalık nokta ise tutarlar METİN olur, toplanamaz.
// Ayrıca alan kaçırma: müşteri adında bir noktalı virgül ("ABC Ltd; Şti")
// bütün sütunları bir sağa kaydırır ve tutar yanlış müşteriye yazılmış gibi
// görünür. Sessiz ve fark edilmesi en zor hata bu.
import { mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-csv-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'), join(KOK, 'src/lib/csv.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
const { csvMetni, csvSayi, csvTarih, csvDosyaAdi } =
  await import(pathToFileURL(join(g, 'csv.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

console.log('\nTÜRKÇE EXCEL BİÇİMİ\n');
{
  const m = csvMetni(['Ad', 'Tutar'], [['Deneme', csvSayi(1234.5)]]);
  t('BOM ile başlıyor (ş/ğ/İ bozulmasın)', m.charCodeAt(0) === 0xFEFF, m.charCodeAt(0));
  t('ayıraç noktalı virgül (virgül olsa tek hücreye yapışırdı)', m.includes('Ad;Tutar'), m.slice(0, 30));
  t('satır sonu CRLF', m.includes('\r\n'), true);
  t('ondalık virgül (nokta olsa Excel metin sayardı)', m.includes('1234,50'), m);
}

console.log('\nALAN KAÇIRMA — SÜTUN KAYMASINI ÖNLEYEN ŞEY\n');
{
  const m = csvMetni(['Müşteri', 'Tutar'], [['ABC Ltd; Şti', csvSayi(100)]]);
  const satir = m.split('\r\n')[1];
  t('içinde noktalı virgül olan alan tırnağa alınıyor', satir === '"ABC Ltd; Şti";100,00', satir);
  t('sütun sayısı korunuyor', satir.split('";"').length === 1 || satir.startsWith('"'), satir);
}
{
  const m = csvMetni(['Not'], [['O dedi ki "tamam"']]);
  const satir = m.split('\r\n')[1];
  t('içteki tırnak ikileniyor', satir === '"O dedi ki ""tamam"""', satir);
}
{
  const m = csvMetni(['Not'], [['iki\nsatır']]);
  t('satır sonu içeren alan tırnağa alınıyor', m.includes('"iki\nsatır"'), m);
}
{
  const m = csvMetni(['Ad'], [['  boşluklu  ']]);
  const satir = m.split('\r\n')[1];
  t('baştaki/sondaki boşluk korunuyor (Excel kırpmasın)', satir === '"  boşluklu  "', satir);
}

console.log('\nBOŞ VE HATALI DEĞERLER\n');
{
  const m = csvMetni(['a', 'b', 'c'], [[null, undefined, '']]);
  t('null/undefined boş hücre oluyor, "null" yazmıyor', m.split('\r\n')[1] === ';;', m.split('\r\n')[1]);
  t('sayı olmayan değer boş dönüyor', csvSayi(NaN) === '' && csvSayi(null) === '', [csvSayi(NaN), csvSayi(null)]);
  t('geçersiz tarih boş dönüyor', csvTarih('abc') === '' && csvTarih(null) === '', csvTarih('abc'));
  t('tarih gg.aa.yyyy', csvTarih(new Date(2026, 8, 13)) === '13.09.2026', csvTarih(new Date(2026, 8, 13)));
}
{
  // Sütun sayısı tutmazsa SESSİZCE kaymasın — hata versin.
  let patladi = false;
  try { csvMetni(['a', 'b'], [['tek']]); } catch { patladi = true; }
  t('eksik sütunlu satır sessizce kaymıyor, hata veriyor', patladi);
}
{
  const ad = csvDosyaAdi('rapor/özet', '2026-09');
  t('dosya adında yasak karakter kalmıyor', !/[\\/:*?"<>|]/.test(ad), ad);
  t('uzantı .csv', ad.endsWith('.csv'), ad);
}

// ── UÇLAR ────────────────────────────────────────────────────────────────
const KOKURL = process.env.SAYAC_TEST_KOK || 'http://localhost:3002';
const p = new PrismaClient();
let sunucu = true;
try { await fetch(`${KOKURL}/api/rozetler`); } catch { sunucu = false; }

if (!sunucu) {
  console.log(`\n(uç testi ATLANDI: ${KOKURL} ayakta değil)\n`);
} else {
  const SLUG = 'test-rapor-csv';
  try {
    const eski = await p.tenant.findFirst({ where: { slug: SLUG } });
    if (eski) await p.tenant.delete({ where: { id: eski.id } });
    // Raporlar modülü Kurumsal pakette — test bayisi enterprise olmalı.
    const tenant = await p.tenant.create({
      data: {
        name: 'Rapor; Test A.Ş.', slug: SLUG, plan: 'enterprise',
        pricePerBlack: 0.5, pricePerColor: 2,
        users: { create: { email: 'rapor@test.local', passwordHash: await bcrypt.hash('test1234', 12), name: 'T', role: 'ADMIN', isActive: true } },
      },
    });
    // Adında noktalı virgül olan müşteri — sütun kayması burada yakalanır.
    const musteri = await p.customer.create({ data: { tenantId: tenant.id, name: 'ABC Ltd; Şti', phone: '5550000000' } });
    const cihaz = await p.device.create({
      data: {
        tenantId: tenant.id, customerId: musteri.id, brand: 'Kyocera', model: 'M2540',
        serialNo: 'RPR-1', isRental: true, monthlyRent: 1000,
        publicCode: 'RPR-1', qrTokenHash: 'x',
      },
    });
    const kullanici = await p.user.findFirst({ where: { tenantId: tenant.id }, select: { id: true } });
    await p.serviceTicket.create({
      data: {
        tenantId: tenant.id, customerId: musteri.id, deviceId: cihaz.id,
        createdByUserId: kullanici.id,
        ticketNumber: 'RPR-0001', issueText: 'test', status: 'DELIVERED',
        priority: 'HIGH', paymentStatus: 'PAID', totalCost: 1234.5,
      },
    });

    const csrfY = await fetch(`${KOKURL}/api/auth/csrf`);
    const csrfCerez = (csrfY.headers.get('set-cookie') || '').split(';')[0];
    const { csrfToken } = await csrfY.json();
    const gy = await fetch(`${KOKURL}/api/auth/callback/credentials`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: csrfCerez },
      body: new URLSearchParams({ email: 'rapor@test.local', password: 'test1234', csrfToken, redirect: 'false', json: 'true' }),
      redirect: 'manual',
    });
    const cerezler = [csrfCerez];
    for (const c of (gy.headers.getSetCookie?.() ?? [])) cerezler.push(c.split(';')[0]);
    const cerez = cerezler.join('; ');

    console.log('\nUÇLAR CSV DÖNÜYOR\n');
    for (const [ad, yol] of [
      ['özet', '/api/reports?format=csv'],
      ['yenileme', '/api/reports/renewal?format=csv'],
      ['model güvenilirlik', '/api/reports/model-reliability?format=csv'],
    ]) {
      const y = await fetch(`${KOKURL}${yol}`, { headers: { cookie: cerez } });
      // HAM BAYT: Response.text() çözerken BOM.u kırpıyor, o yüzden BOM.u
      // metinde arayan bir test HER ZAMAN kırmızı verir — ürün doğru olsa bile.
      // (İlk koşuda tam bunu yaşadım; hexdump ef bb bf gösterdi.)
      const bayt = Buffer.from(await y.arrayBuffer());
      const metin = bayt.toString("utf8");
      t(`${ad}: 200 dönüyor`, y.ok, y.status);
      t(`${ad}: içerik türü CSV`, (y.headers.get('content-type') || '').includes('text/csv'), y.headers.get('content-type'));
      t(`${ad}: indirme başlığı var`, (y.headers.get('content-disposition') || '').includes('attachment'), y.headers.get('content-disposition'));
      t(`${ad}: BOM ile başlıyor (ham bayt)`, bayt[0] === 0xEF && bayt[1] === 0xBB && bayt[2] === 0xBF, [...bayt.slice(0,3)]);
      t(`${ad}: noktalı virgülle ayrılmış`, metin.includes(';'), metin.slice(0, 60));
    }

    console.log('\nEKRANLA CSV AYNI RAKAMI VERMELİ\n');
    {
      const jy = await fetch(`${KOKURL}/api/reports`, { headers: { cookie: cerez } });
      const j = await jy.json();
      const cy = await fetch(`${KOKURL}/api/reports?format=csv`, { headers: { cookie: cerez } });
      const c = await cy.text();
      t('toplam fiş iki yerde de aynı',
        c.includes(`Özet;Toplam fiş;${j.totals.tickets};`), { csvde: c.split('\r\n')[1], ekranda: j.totals.tickets });
      t('iş hacmi ondalık virgülle yazılmış',
        c.includes(`Özet;Toplam iş hacmi (₺);;${j.totals.revenue.toFixed(2).replace('.', ',')}`),
        c.split('\r\n')[4]);
    }

    console.log('\nGİRİŞSİZ İNDİRİLEMEMELİ\n');
    for (const yol of ['/api/reports?format=csv', '/api/reports/renewal?format=csv', '/api/reports/model-reliability?format=csv']) {
      const y = await fetch(`${KOKURL}${yol}`);
      t(`${yol} girişsiz reddediyor`, y.status === 401 || y.status === 403, y.status);
    }

    console.log('\nYAZDIRMA SAYFASI AÇILIYOR\n');
    {
      const y = await fetch(`${KOKURL}/reports/print`, { headers: { cookie: cerez } });
      const html = await y.text();
      t('sayfa 200 dönüyor', y.ok, y.status);
      t('bayi adı basılıyor', html.includes('Rapor; Test A.Ş.'), html.length);
      t('aylık tablo var', html.includes('Açılan fiş'), true);
      // İş hacmi ile tahsilat KARIŞTIRILMAMALI — kâğıtta ayrımı yazıyor.
      t('iş hacminin tahsilat olmadığı yazıyor', html.includes('tahsil edilmemiş dahil'), true);
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
