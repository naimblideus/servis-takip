// BASKI İŞİ → CARİ — uzlaştırma idempotent mi
// Çalıştır:  node scripts/test-baski-cari.mjs   (sunucu ve veritabanı gerekmez)
//
// NEDEN BU TEST
// Cari her iş yazmasından sonra yeniden uzlaştırılıyor. Uzlaştırma iki kez
// çalışınca borç ikiye katlanırsa ya da iptal edilen işin borcu cari
// ekstrede kalırsa müşteri yanlış ekstreyle aranır.
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-baski-cari-'));
let C;
try {
  try {
    execFileSync(process.execPath, [
      join(KOK, 'node_modules/typescript/bin/tsc'), join(KOK, 'src/lib/baski-cari.ts'),
      '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck',
    ], { stdio: 'pipe' });
  } catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
  C = await import(pathToFileURL(join(g, 'baski-cari.js')).href);
} finally {
  rmSync(g, { recursive: true, force: true });
}

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const { cariPlani, planBosMu, CARI_YONTEM } = C;

// Planı bellekteki deftere uygular (veritabanındaki uygulamanın aynısı).
let sayac = 0;
function uygula(defter, plan, is) {
  let d = defter.filter((e) => !plan.sil.includes(e.id));
  d = d.map((e) => { const gu = plan.guncelle.find((x) => x.id === e.id); return gu ? { ...e, ...gu.data } : e; });
  for (const y of plan.olustur) d.push({ id: `e${++sayac}`, ...y, customerId: is.customerId });
  return d;
}
const T0 = new Date('2026-11-02T09:00:00Z');
const isi = (ek = {}) => ({ id: 'i1', no: 1042, durum: 'SIRADA', toplam: 12550, customerId: 'm1', createdAt: T0, odemeler: [], kim: 'Ayşe', ...ek });
const esitle = (defter, is) => uygula(defter, cariPlani(is, defter), is);

console.log('\nBaskı işi → cari\n');

{
  const d1 = esitle([], isi());
  t('★ kabul edilmiş, müşterili iş cariye borç (TL, ürün adı iş no)', d1.length === 1 && d1[0].type === 'SALE' && d1[0].amount === 125.5 && d1[0].product === 'Baskı B-1042' && d1[0].method === 'OPEN_ACCOUNT', d1);
  t('★ ikinci uzlaştırma hiçbir şey yapmıyor (borç ikiye katlanmıyor)', planBosMu(cariPlani(isi(), d1)));
  t('satış tarihi iş tarihi', +d1[0].date === +T0);

  const odemeli = isi({ odemeler: [{ tutar: 5000, yol: 'NAKIT', tarih: new Date('2026-11-02T10:00:00Z') }, { tutar: 2550, yol: 'KART', tarih: new Date('2026-11-02T11:00:00Z') }] });
  const d2 = esitle(d1, odemeli);
  const tah = d2.find((e) => e.type === 'PAYMENT');
  t('★ ödemeler tek tahsilat satırında toplanıyor, son ödemenin tarihi ve yöntemi', tah?.amount === 75.5 && tah.method === 'CARD' && +tah.date === +new Date('2026-11-02T11:00:00Z'), tah);
  t('ödemeli işte de ikinci uzlaştırma boş', planBosMu(cariPlani(odemeli, d2)));

  const tutarDegisti = isi({ toplam: 20000, odemeler: odemeli.odemeler });
  const d3 = esitle(d2, tutarDegisti);
  t('tutar değişince satış güncelleniyor, yeni satır açılmıyor', d3.filter((e) => e.type === 'SALE').length === 1 && d3.find((e) => e.type === 'SALE').amount === 200, d3);

  t('★ iptal edilen işin cari kayıtları siliniyor', esitle(d3, isi({ durum: 'IPTAL', odemeler: odemeli.odemeler })).length === 0);
  t('★ henüz kabul edilmemiş online iş (GELEN) cariye yazılmıyor', esitle([], isi({ durum: 'GELEN' })).length === 0);
  t('müşterisiz (kayıtsız) iş cariye yazılmıyor', esitle([], isi({ customerId: null })).length === 0);
  t('tutarsız iş cariye yazılmıyor', esitle([], isi({ toplam: 0 })).length === 0);
  t('ödeme silinince tahsilat satırı siliniyor', esitle(d2, isi()).every((e) => e.type !== 'PAYMENT'));

  const cift = [...d2, { ...d2[0], id: 'kopya' }];
  t('çoğalmış satış satırı temizleniyor', esitle(cift, odemeli).filter((e) => e.type === 'SALE').length === 1);
  const baskaMusteri = esitle(d2, { ...odemeli, customerId: 'm2' });
  t('müşteri değişince kayıtlar yeni müşteriye taşınıyor', baskaMusteri.every((e) => e.customerId === 'm2') && baskaMusteri.length === 2, baskaMusteri);
  t('yöntem adları PaymentMethod ile aynı', CARI_YONTEM.NAKIT === 'CASH' && CARI_YONTEM.KART === 'CARD' && CARI_YONTEM.HAVALE === 'TRANSFER');

  // Rastgele işlem dizisi: her adımdan sonra iki kez uzlaştır, ikincisi boş olmalı.
  let defter = [], hata = null, odemeler = [];
  const durumlar = ['GELEN', 'SIRADA', 'BASKIDA', 'HAZIR', 'TESLIM', 'IPTAL', 'SIRADA'];
  for (let i = 0; i < 300 && !hata; i++) {
    if (i % 3 === 0) odemeler = [...odemeler, { tutar: 100 + i, yol: ['NAKIT', 'KART', 'HAVALE'][i % 3], tarih: new Date(+T0 + i * 60000) }];
    if (i % 11 === 0) odemeler = [];
    const is = isi({ durum: durumlar[i % durumlar.length], toplam: 5000 + (i % 4) * 1000, customerId: i % 13 === 0 ? null : 'm1', odemeler });
    defter = esitle(defter, is);
    if (!planBosMu(cariPlani(is, defter))) hata = { i, plan: cariPlani(is, defter) };
    const satis = defter.filter((e) => e.type === 'SALE').length, tahs = defter.filter((e) => e.type === 'PAYMENT').length;
    if (satis > 1 || tahs > 1) hata = { i, satis, tahs };
  }
  t('★ 300 rastgele adım: her uzlaştırmadan sonra ikincisi boş, en çok bir satış ve bir tahsilat', hata === null, hata);
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
