// KAÇAN TONER — müşteri toneri başka yerden aldı (lib/kacan-toner.ts)
// Çalıştır:  node scripts/test-kacan-toner.mjs   (veritabanı kısmı yerel DATABASE_URL ister)
//
// NEDEN BU TEST
// Bu ekran bayiye "müşterin seni atlattı" diyor. Yanlış pozitif (bayinin
// kendi verdiği toneri "kaçan" saymak) güveni bir kerede bitirir; yanlış
// negatif ise ekranı boş ve değersiz bırakır. İkisi de burada kilitli.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUNUCU = process.env.SAYAC_TEST_KOK || 'http://localhost:3002';
const require = createRequire(join(KOK, 'package.json'));
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const oku = (yol) => readFileSync(join(KOK, yol), 'utf8');

const g = mkdtempSync(join(tmpdir(), 'st-kacan-'));
try {
  execFileSync(process.execPath, [join(KOK, 'node_modules/typescript/bin/tsc'), join(KOK, 'src/lib/kacan-toner.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz */ }
const istemci = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(istemci)};\nexport const prisma = new PrismaClient();\n`);
const yol = join(g, 'kacan-toner.js');
writeFileSync(yol, readFileSync(yol, 'utf8').replace(/'@\/lib\/prisma'/g, "'./prisma-shim.js'"));
const kt = await import(pathToFileURL(yol).href);

const GUN = 86_400_000;
const simdi = new Date('2026-10-14T12:00:00Z');
const once = (n) => new Date(simdi.getTime() - n * GUN);

// ── SAF KARAR ────────────────────────────────────────────────────────────
console.log('\nKarar\n');
{
  const bos = { sevk: new Map(), fis: new Map(), satis: new Map() };
  const d = { changedAt: once(20), deviceId: 'D', customerId: 'M', onceki: once(50) };
  t('kanıt yoksa bayi vermemiş', kt.bayiVerdiMi(d, bos) === false);
  t('★ önceki değişimin fişindeki toner kanıt SAYILMAZ (o toner o değişimde takıldı)',
    kt.bayiVerdiMi(d, { ...bos, fis: new Map([['D', [once(50)]]]) }) === false);
  t('önceki değişimden sonra fişle toner → bayi verdi', kt.bayiVerdiMi(d, { ...bos, fis: new Map([['D', [once(30)]]]) }) === true);
  t('sevk (değişimden 5 gün önce) → bayi verdi', kt.bayiVerdiMi(d, { ...bos, sevk: new Map([['D', [once(25)]]]) }) === true);
  t('müşteriye cari toner satışı → bayi verdi', kt.bayiVerdiMi(d, { ...bos, satis: new Map([['M', [once(18)]]]) }) === true);
  t('değişimden 7 gün sonrasına kadar girilen kayıt da sayılır', kt.bayiVerdiMi(d, { ...bos, fis: new Map([['D', [once(14)]]]) }) === true);
  t('8 gün sonra girilen kayıt bu değişimin değil', kt.bayiVerdiMi(d, { ...bos, fis: new Map([['D', [once(11)]]]) }) === false);
  t('önceki değişim yoksa 60 gün geriye bakılır', kt.bayiVerdiMi({ ...d, onceki: null }, { ...bos, sevk: new Map([['D', [once(75)]]]) }) === true
    && kt.bayiVerdiMi({ ...d, onceki: null }, { ...bos, sevk: new Map([['D', [once(81)]]]) }) === false);
  t('başka makinenin kanıtı bu makineye sayılmaz', kt.bayiVerdiMi(d, { ...bos, sevk: new Map([['X', [once(25)]]]) }) === false);
}

// ── KAYNAK ───────────────────────────────────────────────────────────────
console.log('\nKaynak\n');
t('★ Kaçan Gelir sayfasının üstünde', /<KacanToner \/>/.test(oku('src/app/(dashboard)/kacan-gelir/page.tsx')));
t('demoda "Bizden aldı" kapalı (listeyi herkese boşaltmasın)', oku('src/lib/demo-yazma.ts').includes("'/api/kacan-toner'"));
t('uç yalnız yönetici, yalnız bu bayinin tarayıcı kaydı', /BU_EKRAN_ICIN_YONETICI_YETKISI/.test(oku('src/app/api/kacan-toner/route.ts'))
  && /tenantId: y\.user\.tenantId, source: 'TARAYICI'/.test(oku('src/app/api/kacan-toner/route.ts')));
t('göç her açılışta yeniden koşabilir', /ADD COLUMN IF NOT EXISTS "bizdenAlindi"/.test(oku('prisma/migrations/20261014100000_kacan_toner/migration.sql')));
const bilesen = oku('src/components/KacanToner.tsx');
t('★ müşteriye giden mesaj "izliyoruz" demiyor', !/gördük|izledik|tarayıcı/i.test(oku('src/lib/i18n/tr.ts').match(/musteriMesaji: '([^']+)'/)?.[1] ?? 'x'));
t('tarayıcı çalışmıyorsa "0 kaçan" değil, nasıl görüleceği yazıyor', /izlenenCihaz === 0/.test(bilesen));

// ── VERİTABANI ───────────────────────────────────────────────────────────
function veritabaniUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const s = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x));
    return s ? s.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const yerel = /@(localhost|127\.0\.0\.1)[:/]/.test(veritabaniUrl());

if (!yerel) {
  console.log('\n  ⊘ veritabanı kısmı atlandı: DATABASE_URL yerel değil');
} else {
  console.log('\nVeritabanı\n');
  await p.tenant.deleteMany({ where: { slug: { startsWith: 'kacan-testi-' } } });
  const b = await p.tenant.create({ data: { name: 'Kaçan Testi', slug: `kacan-testi-${Date.now()}` } });
  try {
    const u = await p.user.create({ data: { tenantId: b.id, email: `kacan.${Date.now()}@ornek.local`, passwordHash: 'x', name: 'Y', role: 'ADMIN' } });
    const m1 = await p.customer.create({ data: { tenantId: b.id, name: 'Müşteri Bir', phone: '05321112233' } });
    const m2 = await p.customer.create({ data: { tenantId: b.id, name: 'Müşteri İki', phone: '05321112244' } });
    const cihaz = (m, seri) => p.device.create({ data: { tenantId: b.id, customerId: m.id, brand: 'Pantum', model: 'M7100DW', serialNo: seri, publicCode: `${seri}-${Date.now()}`, qrTokenHash: `${seri}-${Date.now()}-q`, olcumAt: once(1) } });
    const [A, B, C, D, E, F] = await Promise.all([cihaz(m1, 'KT-A'), cihaz(m1, 'KT-B'), cihaz(m2, 'KT-C'), cihaz(m1, 'KT-D'), cihaz(m1, 'KT-E'), cihaz(m1, 'KT-F')]);
    const toner = await p.part.create({ data: { tenantId: b.id, sku: `KT-${Date.now()}`, name: 'Pantum TL-410X Toner', group: 'TONER', sellPrice: 990 } });
    const degisim = (d, gun, ek = {}) => p.tonerChange.create({ data: { tenantId: b.id, deviceId: d.id, channel: 'BLACK', counterValue: 1000 + gun, changedAt: once(gun), source: 'TARAYICI', ...ek } });
    // A: önceki değişim fişle (50 gün önce, parça bağlı); sonra tarayıcı (20 gün önce) — kaçan.
    const fisA = await p.serviceTicket.create({ data: { tenantId: b.id, customerId: m1.id, deviceId: A.id, ticketNumber: `KT-${Date.now()}-A`, issueText: 'toner', createdAt: once(50), createdByUserId: u.id } });
    await p.ticketPart.create({ data: { tenantId: b.id, ticketId: fisA.id, partId: toner.id, quantity: 1, unitPrice: 990, createdAt: once(50) } });
    await degisim(A, 50, { source: 'FIS', partId: toner.id });
    const kacanA = await degisim(A, 20, { note: '%6 → %96' });
    // B: sevk 25 gün önce → bayi verdi.
    await degisim(B, 20);
    await p.tonerSevki.create({ data: { tenantId: b.id, deviceId: B.id, channel: 'BLACK', partId: toner.id, gonderildiAt: once(25) } });
    // C: müşteriye cari toner satışı 15 gün önce → bayi verdi.
    await degisim(C, 20);
    await p.accountEntry.create({ data: { tenantId: b.id, customerId: m2.id, type: 'SALE', product: 'Pantum TL-410X Toner ×2', amount: 1980, date: once(15) } });
    // D: 3 gün önce → henüz sayılmaz (fiş girilmesi bekleniyor).
    await degisim(D, 3);
    // E: fişle parça bağlanmış tarayıcı kaydı → bayi verdi.
    await degisim(E, 20, { partId: toner.id });
    // F: bayi "bizden aldı" dedi.
    await degisim(F, 20, { bizdenAlindi: true });

    const r = await kt.kacanTonerler(b.id, simdi);
    const ids = r.kayitlar.map((k) => k.id);
    t('★ yalnız A kaçan: sevk, satış, fiş, yeni ve "bizden" olanlar düştü', ids.length === 1 && ids[0] === kacanA.id, r.kayitlar.map((k) => k.seri));
    const a = r.kayitlar[0];
    t('★ tutar: o makineye son takılan tonerin fiyatı', a?.tutar === 990 && a?.parca === 'Pantum TL-410X Toner' && r.tutar === 990, a);
    t('satırda müşteri, cihaz, not var', a?.musteri?.name === 'Müşteri Bir' && a?.cihaz === 'Pantum M7100DW' && a?.not === '%6 → %96');
    t('izlenen makine sayısı (son 30 günde tarayıcının gördüğü)', r.izlenenCihaz === 6, r.izlenenCihaz);
    const baska = await kt.kacanTonerler('olmayan-bayi', simdi);
    t('başka bayinin kaydı görünmüyor', baska.adet === 0);

    const demo = await p.tenant.findFirst({ where: { slug: 'demo', demo: true }, select: { id: true } });
    if (demo) {
      const dr = await kt.kacanTonerler(demo.id);
      t('★ herkese açık demoda kaçan toner örneği var, tutarlı', dr.adet >= 1 && dr.tutar > 0, { adet: dr.adet, tutar: dr.tutar });
    } else {
      console.log('  ⊘ demo yerelde kurulu değil');
    }
  } finally {
    await p.tenant.delete({ where: { id: b.id } }).catch(() => {});
  }
}

// ── HTTP ─────────────────────────────────────────────────────────────────
const r = await fetch(`${SUNUCU}/api/kacan-toner`, { signal: AbortSignal.timeout(30000) }).catch(() => null);
if (!r) console.log('\n  ⊘ HTTP kısmı atlandı: sunucu kapalı');
else { console.log('\nSunucu\n'); t('oturumsuz istek reddediliyor', r.status === 401, r.status); }

await p.$disconnect();
rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exitCode = kaldi ? 1 : 0;
