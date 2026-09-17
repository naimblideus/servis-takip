// PERİYODİK BAKIM — GERÇEK VERİYLE UÇTAN UCA
// Çalıştır:  node scripts/test-bakim-uc.mjs
// Veri YAZAR, sonunda tamamını geri alır. Yerel olmayan veritabanında çalışmaz.
//
// NEDEN BU TEST
// Saf hesabın testi ayrı (test-bakim.mjs). Burada ölçülen şey o hesabın
// gerçek okumalara ve politika zincirine doğru bağlanıp bağlanmadığı:
//
//   1. CİHAZA ÖZEL eşik, filo varsayılanını EZİYOR mu — ezmezse bayi tek tek
//      girdiği değerlerin işe yaramadığını fark etmez.
//   2. Güncel sayaç, hız penceresi DIŞINDA kalmış cihazda da bulunuyor mu.
//      Bulunmazsa uzun süredir okunmayan makine plandan sessizce düşerdi —
//      oysa bakımı en muhtemel kaçan makine tam olarak odur.
//   3. Hız TOPLAM sayfadan mı hesaplanıyor — bakım kiti siyah/renkli ayırmaz.
//   4. "Bakım yapıldı" damgası sayacı son okumadan alıyor mu.
import { PrismaClient } from '@prisma/client';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');

function veritabaniUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const s = readFileSync(join(KOK, '.env'), 'utf8').split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x));
    return s ? s.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(veritabaniUrl())) {
  console.log('ATLANDI: DATABASE_URL yerel değil. Bu test veri yazar.');
  process.exit(0);
}

const g = mkdtempSync(join(tmpdir(), 'st-bakimuc-'));
let veri;
// tsc '@/...' takma yolunu çözemez ve HATA verir; JS'i yine de üretir.
// Tip denetimi ayrıca koşuyor (npx tsc --noEmit).
try { execFileSync(process.execPath, [
  join(KOK, 'node_modules/typescript/bin/tsc'),
  join(KOK, 'src/lib/bakim-veri.ts'), join(KOK, 'src/lib/bakim.ts'), join(KOK, 'src/lib/toner.ts'),
  '--outDir', g, '--module', 'esnext', '--target', 'es2022',
  '--moduleResolution', 'bundler', '--skipLibCheck',
], { stdio: 'pipe' }); } catch { /* yukarıdaki not */ }

try {
  writeFileSync(join(g, 'prisma-shim.js'),
    `import { PrismaClient } from ${JSON.stringify(pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href)};\nexport const prisma = new PrismaClient();\n`);
  const yol = join(g, 'bakim-veri.js');
  writeFileSync(yol, readFileSync(yol, 'utf8')
    .replace("'@/lib/prisma'", "'./prisma-shim.js'")
    .replace("'@/lib/toner'", "'./toner.js'")
    .replace("'@/lib/bakim'", "'./bakim.js'"), 'utf8');
  veri = await import(pathToFileURL(yol).href);
} catch (e) {
  console.log('ATLANDI: bakim-veri derlenemedi —', e?.message);
  rmSync(g, { recursive: true, force: true });
  process.exit(0);
}
const { bakimPlani, bakimYapildi } = veri;

const p = new PrismaClient();
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const SLUG = 'test-bakim-uc';
const BUGUN = new Date(Date.UTC(2026, 8, 17));
const gunOnce = (n) => new Date(BUGUN.getTime() - n * 86400000);

let bayiId = null;
try {
  const eski = await p.tenant.findFirst({ where: { slug: SLUG }, select: { id: true } });
  if (eski) await p.tenant.delete({ where: { id: eski.id } });

  const bayi = await p.tenant.create({
    data: { name: 'Bakım Test Bayisi', slug: SLUG, pmDefaultPages: 150000, pmDefaultMonths: 12 },
    select: { id: true },
  });
  bayiId = bayi.id;
  const musteri = await p.customer.create({
    data: { tenantId: bayiId, name: 'Bakım Müşterisi', phone: '5559990001' }, select: { id: true },
  });

  const cihazYap = async (seri, ek = {}) => (await p.device.create({
    data: {
      tenantId: bayiId, customerId: musteri.id, brand: 'Kyocera', model: 'TASKalfa',
      serialNo: seri, publicCode: `BKM-${seri}`, qrTokenHash: `bkm-${seri}`, ...ek,
    },
    select: { id: true },
  })).id;

  const okuma = async (deviceId, gun, siyah, renkli = 0) => p.counterReading.create({
    data: { tenantId: bayiId, deviceId, readingDate: gunOnce(gun), counterBlack: siyah, counterColor: renkli },
  });

  // A) Varsayılan eşikli, düzenli okunan cihaz — 30 günde 9.000 sayfa (300/gün).
  const a = await cihazYap('BK-1', { lastPmAt: gunOnce(60), lastPmCounter: 300000 });
  await okuma(a, 30, 300000);
  await okuma(a, 0, 309000);

  // B) Cihaza ÖZEL eşik: 30.000 sayfa. Varsayılanı ezmeli.
  const b2 = await cihazYap('BK-2', {
    lastPmAt: gunOnce(60), lastPmCounter: 300000, pmIntervalPages: 30000,
  });
  await okuma(b2, 30, 300000);
  await okuma(b2, 0, 331000); // 31.000 basıldı → 30.000'lik eşik AŞILDI

  // C) Hız penceresi DIŞINDA okunmuş cihaz (200 gün önce) — sayaç yine bulunmalı.
  const c = await cihazYap('BK-3', { lastPmAt: gunOnce(400), lastPmCounter: 100000 });
  await okuma(c, 200, 260000);

  // D) RENKLİ basan cihaz — bakım kiti toplam sayfayla aşınır.
  const d = await cihazYap('BK-4', { lastPmAt: gunOnce(60), lastPmCounter: 0 });
  await okuma(d, 30, 5000, 5000);
  await okuma(d, 0, 8000, 8000);

  console.log('\nPeriyodik bakım uçtan uca\n');
  const r = await bakimPlani(bayiId, BUGUN);
  const bul = (seri) => r.satirlar.find((s) => s.serialNo === seri);

  t('dört cihaz listelendi', r.satirlar.length === 4, r.satirlar.length);
  t('filo varsayılanı okunuyor', r.varsayilanSayfa === 150000 && r.varsayilanAy === 12);

  const sa = bul('BK-1');
  t('varsayılan eşik uygulanıyor', sa?.sayfaAraligi === 150000 && sa?.politikaKaynak === 'VARSAYILAN', sa?.politikaKaynak);
  t('günlük hız 300 sayfa', Math.round(sa?.gunlukHiz ?? 0) === 300, sa?.gunlukHiz);
  t('kalan sayfa 141.000', sa?.durum.sayfaKalan === 141000, sa?.durum.sayfaKalan);
  t('durum planlı', sa?.durum.durum === 'PLANLI', sa?.durum);

  const sb = bul('BK-2');
  t('★ cihaza özel eşik varsayılanı EZİYOR', sb?.sayfaAraligi === 30000 && sb?.politikaKaynak === 'CIHAZ', sb?.sayfaAraligi);
  t('★ özel eşikte GECİKTİ', sb?.durum.durum === 'GECIKTI' && sb?.durum.sebep === 'SAYFA', sb?.durum);
  t('★ özel eşik ay aralığını da devralmıyor', sb?.ayAraligi === null, sb?.ayAraligi);

  const sc = bul('BK-3');
  t('★ hız penceresi dışındaki cihazın sayacı bulunuyor', sc?.guncelSayac === 260000, sc?.guncelSayac);
  t('★ hız hesaplanamıyor ama cihaz listede', sc?.gunlukHiz === null && sc?.durum.durum !== 'BILINMIYOR', sc?.durum);
  t('hız yokken tarih söylenmiyor', sc?.durum.tahminiTarih === null);
  t('★ 13 ay geçmiş: süre eşiği GECİKTİ', sc?.durum.durum === 'GECIKTI', sc?.durum);

  const sd = bul('BK-4');
  t('★ hız TOPLAM sayfadan (siyah+renkli)', Math.round(sd?.gunlukHiz ?? 0) === 200, sd?.gunlukHiz);
  t('güncel sayaç toplam', sd?.guncelSayac === 16000, sd?.guncelSayac);

  t('özet gecikeni sayıyor', r.ozet.geciken === 2, r.ozet);
  t('★ liste gecikenler önde sıralı', r.satirlar[0].durum.durum === 'GECIKTI');

  // ── BAKIM YAPILDI ───────────────────────────────────────────────────
  const damga = await bakimYapildi(bayiId, a, BUGUN);
  t('★ bakım damgası sayacı son okumadan alıyor', damga?.lastPmCounter === 309000, damga);

  const r2 = await bakimPlani(bayiId, BUGUN);
  t('★ bakım sonrası kalan sıfırlandı', bul.call(null, 'BK-1') && r2.satirlar.find((s) => s.serialNo === 'BK-1')?.durum.sayfaKalan === 150000,
    r2.satirlar.find((s) => s.serialNo === 'BK-1')?.durum.sayfaKalan);

  // Başka bayinin cihazına damga vurulamaz.
  const yabanci = await bakimYapildi('yok-boyle-bir-bayi', a, BUGUN);
  t('★ başka bayinin cihazına damga vurulamıyor', yabanci === null);
} finally {
  if (bayiId) {
    await p.tenant.delete({ where: { id: bayiId } }).catch(() => {});
    console.log('\n  (temizlik: test bayisi silindi)');
  }
  await p.$disconnect();
  rmSync(g, { recursive: true, force: true });
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
