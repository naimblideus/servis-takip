/**
 * ÇOK CİHAZLI SAYAÇ E-POSTASI testleri — veritabanı GEREKTİRMEZ.
 *   node scripts/test-counter-email-coklu.mjs
 *
 * NEDEN AYRI DOSYA: tek-cihaz okuyucusunun testleri (test-counter-email.mjs)
 * bir sözleşmeyi doğruluyor, bu dosya bambaşkasını — tek e-postada ONLARCA
 * cihaz. Onlarca makinesi olan bir firma cihazları tek tek e-posta attırmaz;
 * filo yazılımı tek raporda hepsini gönderir.
 *
 * BURADAKİ ASIL RİSK: tek-cihaz okuyucusu böyle bir e-postada SESSİZCE
 * yanlış yapar — ilk eşleşen seriyi bulur ve TÜM belgenin en büyük sayısını
 * ona yazar. 200 cihazlık raporun en büyük sayacı rastgele bir cihaza
 * faturalanır. "en büyük sayı başka cihaza SIZMAZ" testi tam olarak bunu
 * bekliyor.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const gecici = mkdtempSync(join(tmpdir(), 'st-coklu-test-'));
let parseCounterEmailCoklu;
try {
  execFileSync(
    process.execPath,
    [join(kok, 'node_modules/typescript/bin/tsc'), join(kok, 'src/lib/counter-email.ts'),
      '--outDir', gecici, '--module', 'esnext', '--target', 'es2022', '--skipLibCheck'],
    { stdio: 'pipe' },
  );
  ({ parseCounterEmailCoklu } = await import(pathToFileURL(join(gecici, 'counter-email.js')).href));
} finally {
  rmSync(gecici, { recursive: true, force: true });
}

let gecti = 0, kaldi = 0;
const t = (ad, fn) => {
  try { fn(); console.log(`  ✓ ${ad}`); gecti++; }
  catch (e) { console.log(`  ✗ ${ad}\n      ${e.message}`); kaldi++; }
};
const esit = (a, b, m) => { if (a !== b) throw new Error(`${m ?? ''} beklenen ${b}, gelen ${a}`); };
const dogru = (v, m) => { if (!v) throw new Error(m ?? 'doğru bekleniyordu'); };

const SERI = ['ABC12345', 'WXY9988', 'KM-4471', 'QRS777'];

console.log('\nÇok cihazlı sayaç e-postası testleri\n');

// Gerçek filo raporlarının en yaygın biçimi: her cihaz bir satır.
const FILO_TABLO = [
  'Aylik Filo Sayac Raporu - 3 cihaz',
  '',
  'Seri No        Model              Siyah      Renkli',
  'ABC12345       Canon iR2530       145.230    22.410',
  'WXY9988        Ricoh IM C300       98.450     1.200',
  'KM-4471        Kyocera M2540        5.310         0',
].join('\n');

const filo = parseCounterEmailCoklu(FILO_TABLO, SERI);
const bul = (s) => filo.okumalar.find((o) => o.serial === s);

t('filo raporunda üç cihaz da ayrı ayrı bulunur', () => {
  esit(filo.seriYok, false);
  esit(filo.cihazSayisi, 3, 'cihaz sayısı —');
});

t('her cihaz KENDİ satırındaki siyah sayacı alır', () => {
  esit(bul('ABC12345')?.black, 145230, 'ABC12345 —');
  esit(bul('WXY9988')?.black, 98450, 'WXY9988 —');
  esit(bul('KM-4471')?.black, 5310, 'KM-4471 —');
});

t('renkli sayaçlar da satır bazında doğru', () => {
  esit(bul('ABC12345')?.color, 22410, 'ABC12345 renkli —');
  esit(bul('WXY9988')?.color, 1200, 'WXY9988 renkli —');
});

t('ASIL RİSK: en büyük sayı başka cihaza SIZMAZ', () => {
  // Tek-cihaz okuyucusu burada 145.230'u üçüne birden yazardı.
  dogru(bul('KM-4471').black < 10000, 'KM-4471 belgenin en büyük sayacını almamalı');
  dogru(bul('WXY9988').black < 145230, 'WXY9988 başka satırın sayacını almamalı');
});

t('üçü de otomatik işlenebilir işaretlenir', () => {
  esit(filo.okumalar.filter((o) => o.guvenli).length, 3);
});

// HTML tablo — çoğu filo yazılımı HTML gönderir
const FILO_HTML = `
<table>
  <tr><th>Seri</th><th>Siyah</th><th>Renkli</th></tr>
  <tr><td>ABC12345</td><td>145230</td><td>22410</td></tr>
  <tr><td>WXY9988</td><td>98450</td><td>1200</td></tr>
</table>`;

t('HTML tabloda da satırlar ayrışır', () => {
  const h = parseCounterEmailCoklu(FILO_HTML, SERI);
  esit(h.cihazSayisi, 2);
  esit(h.okumalar.find((o) => o.serial === 'ABC12345')?.black, 145230);
  esit(h.okumalar.find((o) => o.serial === 'WXY9988')?.black, 98450);
});

t('tek cihazlı e-postada davranış değişmez', () => {
  const tek = parseCounterEmailCoklu(
    'Serial Number: ABC12345\nTotal 1: 145.230\nColor Total: 22,410', SERI);
  esit(tek.cihazSayisi, 1);
  esit(tek.okumalar[0].black, 145230);
  esit(tek.okumalar[0].color, 22410);
  esit(tek.okumalar[0].guvenli, true);
});

t('bilinmeyen seri içeren rapor: seriYok', () => {
  const b = parseCounterEmailCoklu('Seri: ZZZ0000 Total: 500', SERI);
  esit(b.seriYok, true);
  esit(b.cihazSayisi, 0);
});

t('sayacı okunamayan cihaz güvenli=false ile işaretlenir', () => {
  const e = parseCounterEmailCoklu('Seri ABC12345 aylık rapor ektedir', SERI);
  esit(e.cihazSayisi, 1);
  esit(e.okumalar[0].guvenli, false);
  dogru(e.okumalar[0].sebep, 'sebep yazılmalı');
});

t('aynı seri başlıkta ve tabloda geçerse tek okuma üretir', () => {
  const y = parseCounterEmailCoklu(
    'Cihaz ABC12345 icin aylik rapor\n\nSeri ABC12345 Toplam: 88.000', SERI);
  esit(y.cihazSayisi, 1, 'aynı cihaz iki kez sayılmamalı —');
  esit(y.okumalar[0].black, 88000);
});

t('karışık rapor: biri okunur biri kuyruğa kalır', () => {
  const k = parseCounterEmailCoklu(
    'ABC12345  Toplam: 12.000\nWXY9988   (sayac okunamadi)', SERI);
  esit(k.cihazSayisi, 2);
  esit(k.okumalar.find((o) => o.serial === 'ABC12345')?.guvenli, true);
  esit(k.okumalar.find((o) => o.serial === 'WXY9988')?.guvenli, false);
});

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
