// SESSİZ SAYAÇ YANMASI — karma park ve kopya başı anlaşma
// Çalıştır:  node scripts/test-sayac-yanmasi.mjs   (yerel veritabanı gerekir)
//
// NEDEN BU TEST
// Aylık fatura müşterinin BÜTÜN cihazlarının okumalarını "faturalandı" diye
// kapatıyor, ücreti ise yalnız kiralık cihaz için hesaplıyordu. Aynı
// müşteride kiralık + kopya başı anlaşmalı müşteri makinesi olan bayide
// (karma park) anlaşmalı makinenin sayfaları hiç faturalanmadan kapanıyor ve
// bir daha hiçbir faturaya girmiyordu. Rota belgesinde bu yüzden karma
// parklı bayiye ve servis-only segmente teklif verilmesi KİLİTLİYDİ.
//
// Kural (lib/invoicing sayfaUcretliMi): sayfa faturalanır ⇔ kiralık cihaz
// YA DA cihaz kartında kendi sayfa fiyatı olan müşteri makinesi. Bayinin
// genel varsayılan fiyatı müşteri makinesine uygulanmaz.
import { PrismaClient } from '@prisma/client';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-yanma-'));
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const P = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/invoicing.ts'), join(KOK, 'src/lib/period-charges.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz */ }
writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(P)};\nexport const prisma = new PrismaClient();\n`);
const duzelt = (dosya, ciftler) => {
  const yol = join(g, dosya);
  let s = readFileSync(yol, 'utf8');
  for (const [a, b] of ciftler) s = s.split(a).join(b);
  writeFileSync(yol, s, 'utf8');
};
const ortak = [["'@/lib/prisma'", "'./prisma-shim.js'"], ["'@prisma/client'", JSON.stringify(P)]];
duzelt('invoicing.js', ortak);
duzelt('period-charges.js', [...ortak, ["'@/lib/invoicing'", "'./invoicing.js'"]]);
const inv = await import(pathToFileURL(join(g, 'invoicing.js')).href);
const pc = await import(pathToFileURL(join(g, 'period-charges.js')).href);

console.log('\nSayaç yanması — kural\n');
{
  const { sayfaUcretliMi, fiyatTabani } = inv;
  t('kiralık → ücretli', sayfaUcretliMi({ isRental: true, pricePerBlack: null, pricePerColor: null }));
  t('müşteri makinesi + kendi S/B fiyatı → ücretli (kopya başı)', sayfaUcretliMi({ isRental: false, pricePerBlack: 0.25, pricePerColor: null }));
  t('★ müşteri makinesi, fiyat yok → ÜCRETSİZ (tamire gelen makine sayfa başı faturalanmaz)', !sayfaUcretliMi({ isRental: false, pricePerBlack: null, pricePerColor: null }));
  const taban = fiyatTabani({ isRental: false }, { pricePerBlack: 0.1, pricePerColor: 1 });
  t('★ müşteri makinesine bayinin varsayılan fiyatı uygulanmıyor', taban.pricePerBlack === 0 && taban.pricePerColor === 0);
  t('kiralıkta varsayılan fiyat geçerli', fiyatTabani({ isRental: true }, { pricePerBlack: 0.1, pricePerColor: 1 }).pricePerBlack === 0.1);
}

function veritabaniUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const s = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x));
    return s ? s.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(veritabaniUrl())) {
  console.log('\n  ⊘ veritabanı katmanı atlandı: DATABASE_URL yerel değil');
} else {
  console.log('\nSayaç yanması — karma park (gerçek veritabanı)\n');
  const p = new PrismaClient();
  const SLUG = 'test-sayac-yanmasi';
  try {
    const eski = await p.tenant.findFirst({ where: { slug: SLUG }, select: { id: true } });
    if (eski) await p.tenant.delete({ where: { id: eski.id } });
    const tenant = await p.tenant.create({ data: { name: 'Yanma Testi', slug: SLUG, plan: 'professional', pricePerBlack: 0.1, pricePerColor: 1, vatRate: 20 } });
    const m = await p.customer.create({ data: { tenantId: tenant.id, name: 'Karma Park', phone: '05000000077' } });
    const cihaz = (seri, ek) => p.device.create({ data: {
      tenantId: tenant.id, customerId: m.id, brand: 'Kyocera', model: seri, serialNo: seri, publicCode: seri, qrTokenHash: seri,
      counterBlack: 0, counterColor: 0, ...ek,
    } });
    const kiralik = await cihaz('YANMA-KIRA', { isRental: true, monthlyRent: 1000 });
    const kopya = await cihaz('YANMA-KOPYA', { isRental: false, pricePerBlack: 0.25 });   // renkli fiyat yok
    const sahipsiz = await cihaz('YANMA-SAHIP', { isRental: false });                       // anlaşma yok
    const simdi = new Date();
    const okuma = (d, b, c) => p.counterReading.create({ data: {
      tenantId: tenant.id, deviceId: d.id, counterBlack: b, counterColor: c, deltaBlack: b, deltaColor: c,
      readingDate: new Date(simdi.getFullYear(), simdi.getMonth(), 10, 12), billed: false,
    } });
    const oK = await okuma(kiralik, 2000, 0);
    const oP = await okuma(kopya, 1000, 200);
    const oS = await okuma(sahipsiz, 3000, 0);

    // Önizleme (cari "Kira/Sayaç Ekle") faturayla aynı kuralı kullanmalı
    const on = await pc.previewPeriodCharges(tenant.id, m.id);
    t('cari önizlemesi kopya başı makinenin sayfasını görüyor (1000 × ₺0,25 = ₺250)', on.counterDetail.some((x) => x.device.endsWith('YANMA-KOPYA') && x.amount === 250), on.counterDetail);
    t('cari önizlemesi anlaşmasız makineye ücret yazmıyor', !on.counterDetail.some((x) => x.device.endsWith('YANMA-SAHIP')) && !on.readingIds.includes(oS.id));

    const f = await inv.buildInvoiceForCustomerPeriod(tenant.id, m.id, inv.periodOf(simdi));
    const satirlar = await p.invoiceLine.findMany({ where: { invoiceId: f.id } });
    const cihazin = (d) => satirlar.filter((s) => s.deviceId === d.id);
    t('kiralık: kira + sayaç (2000 × ₺0,10)', cihazin(kiralik).some((s) => s.kind === 'RENTAL' && Number(s.lineTotal) === 1000)
      && cihazin(kiralik).some((s) => s.kind === 'COUNTER' && Number(s.lineTotal) === 200), cihazin(kiralik).map((s) => [s.kind, Number(s.lineTotal)]));
    t('★ kopya başı müşteri makinesi FATURALANIYOR (1000 × ₺0,25 = ₺250), kirası yok', cihazin(kopya).length === 1 && cihazin(kopya)[0].kind === 'COUNTER' && Number(cihazin(kopya)[0].lineTotal) === 250,
      cihazin(kopya).map((s) => [s.kind, Number(s.lineTotal), s.description]));
    t('fiyatı girilmemiş renk ₺0 satır olarak düşmüyor', !cihazin(kopya).some((s) => /Renkli/.test(s.description)));
    t('★ anlaşmasız müşteri makinesine bayinin varsayılan fiyatıyla ücret YAZILMIYOR', cihazin(sahipsiz).length === 0);

    const durum = async (o) => (await p.counterReading.findUnique({ where: { id: o.id }, select: { billed: true } })).billed;
    t('kiralık ve kopya başı okumalar faturalandı olarak kapandı', (await durum(oK)) && (await durum(oP)));
    t('★ ANLAŞMASIZ MAKİNENİN OKUMASI YAKILMADI (faturalanmadı diye açık kalıyor)', (await durum(oS)) === false);

    // Sonradan anlaşma yapılırsa aynı dönemin sayfaları hâlâ faturalanabiliyor
    await p.device.update({ where: { id: sahipsiz.id }, data: { pricePerBlack: 0.2 } });
    const f2 = await inv.buildInvoiceForCustomerPeriod(tenant.id, m.id, inv.periodOf(simdi));
    const s2 = f2 ? await p.invoiceLine.findMany({ where: { invoiceId: f2.id } }) : [];
    t('★ sonradan anlaşma girilince o ayın sayfaları kaybolmamış: 3000 × ₺0,20 = ₺600', s2.length === 1 && s2[0].deviceId === sahipsiz.id && Number(s2[0].lineTotal) === 600,
      s2.map((s) => [s.description, Number(s.lineTotal)]));
    const f3 = await inv.buildInvoiceForCustomerPeriod(tenant.id, m.id, inv.periodOf(simdi));
    t('üçüncü tur mükerrer fatura yazmıyor', f3 === null);
  } catch (e) {
    kaldi++;
    console.log('  ✗ veritabanı testi çöktü —', e?.message);
  } finally {
    const eski = await p.tenant.findFirst({ where: { slug: SLUG }, select: { id: true } }).catch(() => null);
    if (eski) await p.tenant.delete({ where: { id: eski.id } }).catch(() => {});
    await p.$disconnect();
    const shim = await import(pathToFileURL(join(g, 'prisma-shim.js')).href);
    await shim.prisma.$disconnect();
  }
}

console.log('\nSayaç yanması — bağlantılar\n');
{
  const oku = (p2) => readFileSync(join(KOK, p2), 'utf8');
  t('Kaçan Gelir aynı kuralla (kopya başı makineler de dahil, varsayılan fiyat yok)', /pricePerBlack: \{ not: null \}/.test(oku('src/app/api/revenue-risk/route.ts')) && /fiyatTabani\(d, tenant\)/.test(oku('src/app/api/revenue-risk/route.ts')));
  t('cihaz ekleme ve düzenlemede "kopya başı" seçeneği var', /kopyaBasi/.test(oku('src/app/(dashboard)/devices/new/page.tsx')) && /kopyaBasi/.test(oku('src/components/DeviceEditPanel.tsx')));
  t('uçlar kopya başı fiyatı siliyor değil, koruyor', /body\.kopyaBasi === true/.test(oku('src/app/api/devices/route.ts')) && /body\.kopyaBasi !== true/.test(oku('src/app/api/devices/[id]/route.ts')));
}

rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exitCode = kaldi ? 1 : 0;
