// KİRA / FİYAT KOLONLARI + ÖRNEK ŞABLON — kiralık filo kiralık mı aktarılıyor?
// Çalıştır:  node scripts/test-kira-eslesme.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST (ölçülmüş hata)
// Aylık kira kalıbı /(kira|aylik|rent)/ idi ve kalıp sırasında "Kiralık mı"dan
// ÖNCE geliyordu. Bayinin tipik dosyasında "Kiralık" (Evet/Hayır) ve "Aylık
// Kira" (₺) yan yana: "Kiralık" KİRA TUTARI sanılıyor, "Aylık Kira" boşta
// kalıyordu. Sonuç: kiralık filo "kiralık değil" ve kirasız aktarılıyor → kira
// faturası kesilmiyor, cihazlar Sayaç Turu'nda görünmüyor. Bayi bunu ay sonu
// fatura çıkmayınca fark eder.
//
// Aynı aileden ikinci hata: sayaç kalıbı /s\/?b/ "S/B Fiyat"ı, konum kalıbı
// /birim/ "S/B Birim Fiyatı"nı yakalıyordu — sayfa fiyatı sayaç/konum oluyordu.
//
// Şablon: "Excel'den kendiniz aktarın" için indirilen örnek dosyanın HER başlığı
// doğru alana düşmeli; bayi şablonu doldurup yüklediğinde elle eşleme yapmasın.
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-kira-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/sheet-import.ts'), join(KOK, 'src/lib/ice-aktar-sablon.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
const { autoMap, parseCSV, detectDelimiter, trNumber, trBool } = await import(pathToFileURL(join(g, 'sheet-import.js')).href);
const { SABLON, sablonCsv } = await import(pathToFileURL(join(g, 'ice-aktar-sablon.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const esle = (baslik) => autoMap([baslik])[0];
const ayni = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\n★ ÖLÇÜLMÜŞ HATA: "Kiralık" + "Aylık Kira" yan yana\n');
{
  const m = autoMap(['Kiralık', 'Aylık Kira']);
  t('★ Kiralık → kiralık mı, Aylık Kira → aylık kira', ayni(m, ['isRental', 'monthlyRent']), m);
  const r = autoMap(['Aylık Kira', 'Kiralık']);
  t('ters sırada da doğru', ayni(r, ['monthlyRent', 'isRental']), r);
  const b = autoMap(['KİRALIK', 'AYLIK KİRA']);
  t('büyük harfli Türkçe başlıkta da doğru', ayni(b, ['isRental', 'monthlyRent']), b);
}

console.log('\nKİRALIK MI? — yaygın yazımlar\n');
for (const h of ['Kiralık', 'Kiralık mı', 'KİRALIK MI?', 'Kiralık?', 'Kiralık (E/H)', 'Kiralık Cihaz', 'Kira mı', 'Kirada mı', 'Rental']) {
  t(`"${h}" → kiralık mı`, esle(h) === 'isRental', esle(h));
}
t('"Kiralama Firması" kiralık bayrağı sanılmıyor', esle('Kiralama Firması') !== 'isRental', esle('Kiralama Firması'));

console.log('\nAYLIK KİRA — yaygın yazımlar\n');
for (const h of ['Aylık Kira', 'Kira', 'Aylık Kira Bedeli', 'Kira Bedeli', 'Kira Tutarı', 'Kira Ücreti', 'Kira (TL)', 'Aylık Aidat', 'Aidat', 'Monthly Rent']) {
  t(`"${h}" → aylık kira`, esle(h) === 'monthlyRent', esle(h));
}

console.log('\n★ SAYFA FİYATI sayaç/konum sanılmıyor\n');
{
  const cases = [
    ['S/B Fiyat', 'pricePerBlack'], ['S/B Sayfa Fiyatı', 'pricePerBlack'], ['S/B Birim Fiyatı', 'pricePerBlack'],
    ['Siyah Birim Fiyat', 'pricePerBlack'], ['Sayfa Fiyatı', 'pricePerBlack'], ['Black Page Price', 'pricePerBlack'],
    ['Renkli Fiyat', 'pricePerColor'], ['Renkli Sayfa Fiyatı', 'pricePerColor'], ['Renkli Birim Fiyat', 'pricePerColor'],
    ['S/B Sayaç', 'counterBlack'], ['Siyah Sayaç', 'counterBlack'], ['Sayaç', 'counterBlack'],
    ['Renkli Sayaç', 'counterColor'], ['Color Counter', 'counterColor'],
  ];
  for (const [h, beklenen] of cases) t(`"${h}" → ${beklenen}`, esle(h) === beklenen, esle(h));
  const m = autoMap(['S/B Fiyat', 'S/B Sayaç']);
  t('★ fiyat kolonu ÖNCE gelse de sayaç kolonu sayaç kalıyor', ayni(m, ['pricePerBlack', 'counterBlack']), m);
}

console.log('\nESKİ EŞLEMELER BOZULMADI\n');
{
  t('Konum → konum', esle('Konum') === 'location', esle('Konum'));
  t('BÖLÜM → konum', esle('BÖLÜM') === 'location', esle('BÖLÜM'));
  t('Model → model', esle('Model') === 'model', esle('Model'));
  t('Cihaz → model', esle('Cihaz') === 'model', esle('Cihaz'));
  t('Müşteri Adı → müşteri', esle('Müşteri Adı') === 'customerName', esle('Müşteri Adı'));
  t('İlçe → ilçe', esle('İlçe') === 'district', esle('İlçe'));
}

console.log('\n★ ÖRNEK ŞABLON — her başlık doğru alana düşüyor\n');
{
  const beklenen = ['customerName', 'phone', 'address', 'brand', 'model', 'serialNo', 'location',
    'counterBlack', 'counterColor', 'isRental', 'monthlyRent', 'pricePerBlack', 'pricePerColor'];
  for (const dil of ['tr', 'en']) {
    const m = autoMap(SABLON[dil][0]);
    t(`★ ${dil} şablonu: 13 başlığın 13'ü tanındı, sırası doğru`, ayni(m, beklenen),
      SABLON[dil][0].map((h, i) => `${h}→${m[i]}`).filter((_, i) => m[i] !== beklenen[i]));
  }

  const csv = sablonCsv('tr');
  t('TR şablonu BOM ile başlıyor (Excel Türkçe karakteri bozmasın)', csv.charCodeAt(0) === 0xfeff);
  t('TR şablonu noktalı virgüllü', detectDelimiter(csv) === ';', detectDelimiter(csv));
  const satir = parseCSV(csv);
  t('TR şablonu başlık + 1 örnek satır, 13 kolon', satir.length === 2 && satir.every((s) => s.length === 13), satir.map((s) => s.length));
  t('başlıklar CSV\'den aynen geri okunuyor', ayni(satir[0], SABLON.tr[0]), satir[0]);
  const deger = (k) => satir[1][beklenen.indexOf(k)];
  t('örnek cihaz Pantum M7100DW', deger('brand') === 'Pantum' && deger('model') === 'M7100DW', satir[1]);
  t('örnek kiralık: Evet → true', trBool(deger('isRental')) === true, deger('isRental'));
  t('örnek aylık kira sayı olarak okunuyor', trNumber(deger('monthlyRent')) === 1500, deger('monthlyRent'));
  t('örnek S/B fiyat 0,45 → 0.45', trNumber(deger('pricePerBlack')) === 0.45, deger('pricePerBlack'));
  t('siyah-beyaz örnek: renkli fiyat boş', deger('pricePerColor') === '', deger('pricePerColor'));

  const en = sablonCsv('en');
  t('EN şablonu virgüllü (İngilizce Excel tek hücreye doldurmasın)', detectDelimiter(en) === ',', detectDelimiter(en));
  const es = parseCSV(en);
  t('EN şablonu 13 kolon, değerler okunuyor', es.length === 2 && es[1].length === 13 && trNumber(es[1][11]) === 0.45 && trBool(es[1][9]) === true, es[1]);
}

rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
