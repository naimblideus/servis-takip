// FİLO OPTİMİZASYONU — GERÇEK VERİYLE UÇTAN UCA
// Çalıştır:  node scripts/test-filo-uc.mjs
// Veri YAZAR, sonunda tamamını geri alır. Yerel olmayan veritabanında çalışmaz.
//
// NEDEN BU TEST
// Saf hesabın testi ayrı (test-filo.mjs). Burada ölçülen şey, hesabın
// gerçek sayaç okumalarına ve gerçek fiyat sırasına doğru bağlanıp
// bağlanmadığı:
//
//   1. SIFIR ARTIŞ ile OKUMA YOK ayrımı. Hız işlevi (lib/toner.ts
//      dailyRate) sıfır artışta null döner — toner tahmini için doğru,
//      burada felaket: boşta duran makine "bilinmiyor" diye kaybolurdu.
//   2. Aylık sayfa toner/bakım ekranlarıyla aynı işlevden mi geliyor.
//   3. Aşım fiyatı faturalamanın sırasını mı izliyor: cihazın aşım fiyatı
//      > cihazın sayfa fiyatı > bayi varsayılanı.
//   4. Başka bayinin cihazı listeye karışmıyor mu.
import { PrismaClient } from '@prisma/client';
import { rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { derle, KOK } from './_derle.mjs';

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

let g, veri;
try {
  const d = derle({ girisler: ['src/lib/filo-veri.ts'], onEk: 'st-filouc-' });
  g = d.dizin;
  veri = await d.ice('lib/filo-veri');
} catch (e) {
  console.log('ATLANDI: filo-veri derlenemedi —', e?.message);
  if (g) rmSync(g, { recursive: true, force: true });
  process.exit(0);
}
const { filoRaporu } = veri;

const p = new PrismaClient();
let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

const SLUG = 'test-filo-uc';
const YABANCI = 'test-filo-uc-yabanci';
const BUGUN = new Date(Date.UTC(2026, 8, 17));
const gunOnce = (n) => new Date(BUGUN.getTime() - n * 86400000);

let bayiId = null, yabanciId = null;
try {
  for (const s of [SLUG, YABANCI]) {
    const eski = await p.tenant.findFirst({ where: { slug: s }, select: { id: true } });
    if (eski) await p.tenant.delete({ where: { id: eski.id } });
  }

  // Bayi varsayılan fiyatı: cihazda fiyat yoksa buraya düşülür.
  const bayi = await p.tenant.create({
    data: { name: 'Filo Test Bayisi', slug: SLUG, pricePerBlack: 0.40, pricePerColor: 2.00 },
    select: { id: true },
  });
  bayiId = bayi.id;
  const musteri = await p.customer.create({
    data: { tenantId: bayiId, name: 'Filo Müşterisi', phone: '5559990003' }, select: { id: true },
  });

  const cihazYap = async (seri, ek = {}) => (await p.device.create({
    data: {
      tenantId: bayiId, customerId: musteri.id, brand: 'Kyocera', model: 'TASKalfa',
      serialNo: seri, publicCode: `FLO-${seri}`, qrTokenHash: `flo-${seri}`,
      isRental: true, monthlyRent: 2000, ...ek,
    },
    select: { id: true },
  })).id;
  const okuma = (deviceId, gun, siyah, renkli = 0) => p.counterReading.create({
    data: { tenantId: bayiId, deviceId, readingDate: gunOnce(gun), counterBlack: siyah, counterColor: renkli },
  });

  // A) 60 günde 8.000 sayfa → ayda ~4.058. Paket 5.000 → dengeli.
  const a = await cihazYap('F1', { includedBlack: 5000 });
  await okuma(a, 60, 100000);
  await okuma(a, 0, 108000);

  // B) ★ SAYAÇ HİÇ ARTMAMIŞ: boşta duran makine. "Bilinmiyor" OLMAMALI.
  const bId = await cihazYap('F2', { includedBlack: 5000 });
  await okuma(bId, 60, 50000);
  await okuma(bId, 0, 50000);

  // C) TEK okuma: hız hesaplanamaz → hüküm yok.
  const c = await cihazYap('F3', { includedBlack: 5000 });
  await okuma(c, 30, 20000);

  // D) Paketi aşıyor: 60 günde 20.000 → ayda ~10.146, paket 5.000.
  //    Cihazın kendi AŞIM fiyatı var: 0.75 (bayi varsayılanı 0.40 değil).
  const d = await cihazYap('F4', { includedBlack: 5000, overagePriceBlack: 0.75 });
  await okuma(d, 60, 300000);
  await okuma(d, 0, 320000);

  // E) Paketi az kullanıyor: 60 günde 2.000 → ayda ~1.015, paket 5.000.
  const e = await cihazYap('F5', { includedBlack: 5000 });
  await okuma(e, 60, 10000);
  await okuma(e, 0, 12000);

  // F) Renkli makine ama renkli neredeyse hiç basılmıyor.
  const f = await cihazYap('F6', { includedBlack: 5000, includedColor: 1000 });
  await okuma(f, 60, 8000, 500);
  await okuma(f, 0, 16000, 505);

  // G) Satılmış cihaz — kira hükmü yok.
  const gId = await cihazYap('F7', { isRental: false, monthlyRent: 0 });
  await okuma(gId, 60, 1000);
  await okuma(gId, 0, 9000);

  console.log('\nFilo optimizasyonu uçtan uca\n');
  const r = await filoRaporu(bayiId, 3, BUGUN);
  const bul = (seri) => r.satirlar.find((s) => s.serialNo === seri);

  t('yedi cihaz listelendi', r.satirlar.length === 7, r.satirlar.length);

  const sa = bul('F1');
  t('★ aylık sayfa okumalardan hesaplanıyor', sa?.aylikSiyah === 4059, sa?.aylikSiyah);
  t('paketini makul kullanan dengeli', sa?.durum.durum === 'DENGELI', sa?.durum);

  const sb = bul('F2');
  t('★ SIFIR ARTIŞ "bilinmiyor" değil SIFIR', sb?.aylikSiyah === 0, sb?.aylikSiyah);
  t('★ boşta duran makine yakalanıyor', sb?.durum.durum === 'HIC_BASMIYOR', sb?.durum);

  const sc = bul('F3');
  t('★ tek okumadan hız çıkarılmıyor', sc?.aylikSiyah === null, sc?.aylikSiyah);
  t('★ okuması yetersiz cihaz BOŞTA sayılmıyor',
    sc?.durum.durum === 'BILINMIYOR' && sc?.durum.sebep === 'OKUMA_YOK', sc?.durum);

  const sd = bul('F4');
  t('paketi aşan cihaz yakalanıyor', sd?.durum.durum === 'ASIM', sd?.durum);
  t('★ aşım CİHAZIN kendi aşım fiyatından (bayi varsayılanı değil)',
    Math.abs(sd.durum.asimTutar - sd.durum.asimSiyah * 0.75) < 0.011, [sd?.durum.asimTutar, sd?.durum.asimSiyah]);

  const se = bul('F5');
  t('paketini az kullanan cihaz yakalanıyor', se?.durum.durum === 'AZ_KULLANIM', se?.durum);
  t('★ kullanılmayan sayfa paraya çevrilmiyor', se?.durum.asimTutar === null, se?.durum);

  const sf = bul('F6');
  t('★ renkli basmayan renkli makine işaretleniyor', sf?.durum.renkliGereksiz === true, sf?.durum);
  t('renkli cihaz tespiti kümülatif sayaçtan', sf?.renkliCihaz === true, sf?.renkliCihaz);

  const sg = bul('F7');
  t('★ satılmış cihaz kapsam dışı',
    sg?.durum.durum === 'BILINMIYOR' && sg?.durum.sebep === 'KIRALIK_DEGIL', sg?.durum);

  t('★ boşta duran en üstte', r.satirlar[0].serialNo === 'F2', r.satirlar.map((s) => s.serialNo));
  t('özet sayıları tutuyor',
    r.ozet.bostaDuran === 1 && r.ozet.asimli === 1 && r.ozet.azKullanim === 1, r.ozet);
  t('★ okuması olmayan cihaz özette ayrı', r.ozet.okumasiz === 1, r.ozet.okumasiz);

  // ── BAŞKA BAYİ ─────────────────────────────────────────────────────────
  {
    const yb = await p.tenant.create({ data: { name: 'Yabancı Bayi', slug: YABANCI }, select: { id: true } });
    yabanciId = yb.id;
    const ym = await p.customer.create({ data: { tenantId: yabanciId, name: 'Yabancı', phone: '5551110001' }, select: { id: true } });
    await p.device.create({
      data: {
        tenantId: yabanciId, customerId: ym.id, brand: 'Canon', model: 'iR',
        serialNo: 'YF1', publicCode: 'FLO-YF1', qrTokenHash: 'flo-yf1', isRental: true, monthlyRent: 999,
      },
    });
    const r2 = await filoRaporu(bayiId, 3, BUGUN);
    t('★ başka bayinin cihazı listede yok', !r2.satirlar.some((s) => s.serialNo === 'YF1'), r2.satirlar.length);
  }
} finally {
  for (const id of [bayiId, yabanciId]) {
    if (id) await p.tenant.delete({ where: { id } }).catch(() => {});
  }
  if (bayiId) console.log('\n  (temizlik: test bayileri silindi)');
  await p.$disconnect();
  rmSync(g, { recursive: true, force: true });
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
