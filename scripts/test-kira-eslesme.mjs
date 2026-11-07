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
const { autoMap, parseCSV, detectDelimiter, trNumber, trBool, donemCoz, kurulumTarihiCoz } = await import(pathToFileURL(join(g, 'sheet-import.js')).href);
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

console.log('\n★ KİRALIK ŞARTLARI — dahil sayfa, aşım, kurulum tarihi, son faturalanan ay\n');
{
  const cases = [
    ['Dahil S/B Sayfa', 'includedBlack'], ['Dahil Sayfa', 'includedBlack'], ['DAHİL SAYFA', 'includedBlack'],
    ['S/B Dahil', 'includedBlack'], ['Dahil Siyah', 'includedBlack'], ['Sayfa Kotası', 'includedBlack'],
    ['Kota', 'includedBlack'], ['Dahil', 'includedBlack'], ['Included Pages', 'includedBlack'],
    ['Aylık Kiraya Dahil Sayfa', 'includedBlack'],
    ['Dahil Renkli Sayfa', 'includedColor'], ['Renkli Dahil', 'includedColor'], ['Renkli Kota', 'includedColor'],
    ['Included Colour Pages', 'includedColor'],
    ['Aşım Fiyatı', 'overagePriceBlack'], ['AŞIM FİYATI', 'overagePriceBlack'], ['Aşım S/B Fiyatı', 'overagePriceBlack'],
    ['S/B Aşım', 'overagePriceBlack'], ['Fazla Sayfa Ücreti', 'overagePriceBlack'], ['Overage Price', 'overagePriceBlack'],
    ['Aşım Renkli Fiyatı', 'overagePriceColor'], ['Renkli Aşım', 'overagePriceColor'], ['Colour Overage Price', 'overagePriceColor'],
    ['Kurulum Tarihi', 'installedAt'], ['KURULUM TARİHİ', 'installedAt'], ['Teslim Tarihi', 'installedAt'],
    ['Montaj Tarihi', 'installedAt'], ['Kurulduğu Tarih', 'installedAt'], ['Kurulum', 'installedAt'], ['Install Date', 'installedAt'],
    ['Son Faturalanan Ay', 'lastInvoicedPeriod'], ['Son Fatura Dönemi', 'lastInvoicedPeriod'], ['Son Fatura Tarihi', 'lastInvoicedPeriod'],
    ['Last Invoiced Month', 'lastInvoicedPeriod'],
  ];
  for (const [h, beklenen] of cases) t(`"${h}" → ${beklenen}`, esle(h) === beklenen, esle(h));
}

console.log('\n★ YENİ KALIPLAR ESKİ KOLONLARI YEMİYOR\n');
{
  t('"Kasım Sayacı" aşım fiyatı sanılmıyor (ay adı)', esle('Kasım Sayacı') === 'counterBlack', esle('Kasım Sayacı'));
  t('"Toner Dahil" dahil sayfa sanılmıyor (evet/hayır kolonu)', esle('Toner Dahil') !== 'includedBlack', esle('Toner Dahil'));
  t('"Sarf Dahil mi" dahil sayfa sanılmıyor', esle('Sarf Dahil mi') !== 'includedBlack', esle('Sarf Dahil mi'));
  t('"KDV Dahil Fiyat" dahil sayfa sanılmıyor', esle('KDV Dahil Fiyat') !== 'includedBlack', esle('KDV Dahil Fiyat'));
  t('"Kurulum Yeri" konum kalıyor', esle('Kurulum Yeri') === 'location', esle('Kurulum Yeri'));
  t('"Kurulum Adresi" adres kalıyor', esle('Kurulum Adresi') === 'address', esle('Kurulum Adresi'));
  t('"Fatura Adresi" son fatura sanılmıyor', esle('Fatura Adresi') === 'address', esle('Fatura Adresi'));
  t('"Renkli Sayfa Fiyatı" renkli fiyat kalıyor', esle('Renkli Sayfa Fiyatı') === 'pricePerColor', esle('Renkli Sayfa Fiyatı'));
  t('"Konum" dahil (kota) sanılmıyor', esle('Konum') === 'location', esle('Konum'));
  const m = autoMap(['S/B Sayfa Fiyatı', 'Dahil S/B Sayfa', 'Aşım S/B Fiyatı', 'S/B Sayaç', 'Aylık Kira', 'Kiralık']);
  t('★ fiyat + dahil + aşım + sayaç + kira yan yana: her biri kendi alanında',
    ayni(m, ['pricePerBlack', 'includedBlack', 'overagePriceBlack', 'counterBlack', 'monthlyRent', 'isRental']), m);
  const r = autoMap(['Dahil Renkli Sayfa', 'Dahil S/B Sayfa', 'Renkli Sayaç', 'S/B Sayaç']);
  t('renkli dahil siyah dahili, renkli sayaç siyah sayacı yemiyor',
    ayni(r, ['includedColor', 'includedBlack', 'counterColor', 'counterBlack']), r);
}

console.log('\n★ SON FATURALANAN AY → YYYY-AA\n');
{
  const cases = [
    ['10.2026', '2026-10'], ['10/2026', '2026-10'], ['2026-10', '2026-10'], ['2026/10', '2026-10'],
    ['Ekim 2026', '2026-10'], ['EKİM 2026', '2026-10'], ['ekim-26', '2026-10'], ['Kasım 2026', '2026-11'],
    ['Şubat 2027', '2027-02'], ['Ağustos 2026', '2026-08'], ['Aralık 2025', '2025-12'], ['October 2026', '2026-10'],
    ['31.10.2026', '2026-10'], ['2026-10-31', '2026-10'], ['202610', '2026-10'],
    ['46326', '2026-10'], // Excel seri numarası: 31.10.2026
  ];
  for (const [v, beklenen] of cases) t(`"${v}" → ${beklenen}`, donemCoz(v) === beklenen, donemCoz(v));
  for (const v of ['2026', '', 'yok', '13.2026', '31.02.2026', 'Ekimm 2026', '1.1.1']) {
    t(`"${v}" okunamaz → null (tahmin yok)`, donemCoz(v) === null, donemCoz(v));
  }
}

console.log('\n★ KURULUM TARİHİ → gün + hassasiyet\n');
{
  const simdi = new Date('2026-11-07T12:00:00Z');
  const k = (v) => { const s = kurulumTarihiCoz(v, simdi); return s ? `${s.tarih.toISOString().slice(0, 10)}/${s.hassasiyet}` : null; };
  const cases = [
    ['15.03.2024', '2024-03-15/DAY'], ['15/03/2024', '2024-03-15/DAY'], ['2024-03-15', '2024-03-15/DAY'],
    ['2024-03-15 10:30:00', '2024-03-15/DAY'], ['03.2024', '2024-03-01/MONTH'], ['Mart 2024', '2024-03-01/MONTH'],
    ['2024', '2024-01-01/YEAR'], ['45366', '2024-03-15/DAY'],
  ];
  for (const [v, beklenen] of cases) t(`"${v}" → ${beklenen}`, k(v) === beklenen, k(v));
  t('gelecek tarih okunamaz', k('15.03.2027') === null, k('15.03.2027'));
  t('1990 öncesi okunamaz', k('1985') === null, k('1985'));
  t('31.02 okunamaz', k('31.02.2024') === null, k('31.02.2024'));
}

console.log('\n★ ÖRNEK ŞABLON — her başlık doğru alana düşüyor\n');
{
  const beklenen = ['customerName', 'phone', 'address', 'brand', 'model', 'serialNo', 'location',
    'counterBlack', 'counterColor', 'isRental', 'monthlyRent', 'pricePerBlack', 'pricePerColor',
    'includedBlack', 'includedColor', 'installedAt', 'lastInvoicedPeriod'];
  const N = beklenen.length;
  for (const dil of ['tr', 'en']) {
    const m = autoMap(SABLON[dil][0]);
    t(`★ ${dil} şablonu: ${N} başlığın ${N}'si tanındı, sırası doğru`, ayni(m, beklenen),
      SABLON[dil][0].map((h, i) => `${h}→${m[i]}`).filter((_, i) => m[i] !== beklenen[i]));
  }

  const csv = sablonCsv('tr');
  t('TR şablonu BOM ile başlıyor (Excel Türkçe karakteri bozmasın)', csv.charCodeAt(0) === 0xfeff);
  t('TR şablonu noktalı virgüllü', detectDelimiter(csv) === ';', detectDelimiter(csv));
  const satir = parseCSV(csv);
  t(`TR şablonu başlık + 1 örnek satır, ${N} kolon`, satir.length === 2 && satir.every((s) => s.length === N), satir.map((s) => s.length));
  t('başlıklar CSV\'den aynen geri okunuyor', ayni(satir[0], SABLON.tr[0]), satir[0]);
  const deger = (k) => satir[1][beklenen.indexOf(k)];
  t('örnek cihaz Pantum M7100DW', deger('brand') === 'Pantum' && deger('model') === 'M7100DW', satir[1]);
  t('örnek kiralık: Evet → true', trBool(deger('isRental')) === true, deger('isRental'));
  t('örnek aylık kira sayı olarak okunuyor', trNumber(deger('monthlyRent')) === 1500, deger('monthlyRent'));
  t('örnek S/B fiyat 0,45 → 0.45', trNumber(deger('pricePerBlack')) === 0.45, deger('pricePerBlack'));
  t('siyah-beyaz örnek: renkli fiyat boş', deger('pricePerColor') === '', deger('pricePerColor'));
  t('örnek dahil sayfa 1000', trNumber(deger('includedBlack')) === 1000, deger('includedBlack'));
  t('örnek kurulum tarihi okunuyor', kurulumTarihiCoz(deger('installedAt'), new Date('2026-11-07T12:00:00Z'))?.hassasiyet === 'DAY', deger('installedAt'));
  t('örnek son faturalanan ay okunuyor', donemCoz(deger('lastInvoicedPeriod')) === '2026-10', deger('lastInvoicedPeriod'));

  const en = sablonCsv('en');
  t('EN şablonu virgüllü (İngilizce Excel tek hücreye doldurmasın)', detectDelimiter(en) === ',', detectDelimiter(en));
  const es = parseCSV(en);
  t(`EN şablonu ${N} kolon, değerler okunuyor`, es.length === 2 && es[1].length === N && trNumber(es[1][11]) === 0.45 && trBool(es[1][9]) === true
    && donemCoz(es[1][16]) === '2026-10', es[1]);
}

rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
