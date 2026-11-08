// ESKİ PROGRAM DÖKÜMLERİ — ".xls" diye inen HTML ve XML 2003 tabloları
// Çalıştır:  node scripts/test-tablo-metin.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// Eski servis/muhasebe programlarının "Excel'e aktar" düğmesi çoğu zaman
// gerçek Excel değil, .xls uzantılı bir HTML tablosu ya da XML 2003 dosyası
// üretir. Müşteri/cihaz aktarımı bu dosyaları "desteklenmiyor" diye
// reddediyordu. Okuyucu (lib/tablo-metin) tarayıcıda çalışır; burada:
//   · HTML tablosu Windows Türkçe (1254) kodlamayla bile doğru okunur;
//   · XML 2003 hücre atlaması (ss:Index) kolonları kaydırmaz;
//   · gerçek eski ikili .xls ve .xlsx (ZIP) içerikten tanınır;
//   · düz CSV'ye karışılmaz (null döner, CSV yolu okur).
import { derle } from './_derle.mjs';

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const ayni = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const { ice, temizle } = derle({ girisler: ['src/lib/tablo-metin.ts', 'src/lib/xlsx-oku.ts'], onEk: 'st-tablo-metin-' });
try {
  const tm = await ice('lib/tablo-metin');
  const { satirlarCsv } = await ice('lib/xlsx-oku');

  console.log('\n★ HTML TABLOSU (.xls)\n');
  const html = `<html><head><meta charset="windows-1254"></head><body><table border=1>
<tr><th>Müşteri Ünvanı</th><th>Seri No</th><th colspan="2">Sayaç</th><th>Aylık Kira</th></tr>
<tr><td>Çağrı &amp; Şükrü Ltd.</td><td>SN-1</td><td>1200</td><td>30</td><td>1.250,50</td></tr>
<tr><td>İğdır Ofis<br>Şube</td><td>SN-2</td><td></td><td></td><td>900</td></tr>
</table></body></html>`;
  // 1254 baytı: "Ş", "ğ", "İ" UTF-8'de geçersiz → 1254 çözülmeli.
  const bayt1254 = Uint8Array.from([...html].map((ch) => ({ 'Ş': 0xde, 'ş': 0xfe, 'Ğ': 0xd0, 'ğ': 0xf0, 'İ': 0xdd, 'ı': 0xfd, 'Ü': 0xdc, 'ü': 0xfc, 'Ç': 0xc7, 'ç': 0xe7, 'Ö': 0xd6, 'ö': 0xf6 })[ch] ?? ch.charCodeAt(0)));
  const metin = tm.metniCoz(bayt1254);
  t('Windows Türkçe (1254) kodlama çözüldü', metin.includes('Müşteri Ünvanı') && metin.includes('İğdır'));
  const tablo = tm.metinTablosu(metin);
  t('★ HTML tablosu olarak tanındı', tablo?.bicim === 'HTML', tablo?.bicim);
  t('başlık: colspan sağdaki kolonu kaydırmadı', ayni(tablo?.satirlar[0], ['Müşteri Ünvanı', 'Seri No', 'Sayaç', '', 'Aylık Kira']), tablo?.satirlar[0]);
  t('hücre metni: varlık çözüldü, <br> boşluk oldu', tablo?.satirlar[1][0] === 'Çağrı & Şükrü Ltd.' && tablo?.satirlar[2][0] === 'İğdır Ofis Şube', tablo?.satirlar.map((s) => s[0]));
  const csv = satirlarCsv(tablo.satirlar);
  t('aktarımın beklediği CSV\'ye çevrildi (noktalı virgül)', csv.split('\n')[1] === 'Çağrı & Şükrü Ltd.;SN-1;1200;30;1.250,50', csv.split('\n')[1]);

  console.log('\n★ XML ELEKTRONİK TABLO 2003\n');
  const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Liste"><Table>
<Row><Cell><Data ss:Type="String">Müşteri</Data></Cell><Cell><Data ss:Type="String">Seri No</Data></Cell><Cell><Data ss:Type="String">Kira</Data></Cell></Row>
<Row><Cell><Data ss:Type="String">Ege Ltd</Data></Cell><Cell ss:Index="3"><Data ss:Type="Number">1250.5</Data></Cell></Row>
</Table></Worksheet></Workbook>`;
  const x = tm.metinTablosu(xml);
  t('★ XML 2003 olarak tanındı', x?.bicim === 'XML2003', x?.bicim);
  t('★ ss:Index atlaması kolonu kaydırmadı, sayı ondalık virgülle', ayni(x?.satirlar[1], ['Ege Ltd', '', '1250,5']), x?.satirlar[1]);

  console.log('\nBİÇİM İÇERİKTEN\n');
  t('gerçek eski ikili .xls tanınır', tm.eskiXlsMi(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0])));
  t('.xlsx (ZIP) tanınır', tm.zipMi(Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0])));
  t('HTML eski .xls sayılmaz', !tm.eskiXlsMi(bayt1254) && !tm.zipMi(bayt1254));
  t('düz CSV\'ye karışılmaz (null)', tm.metinTablosu('Müşteri;Seri No\nA;1') === null);
  t('CSV okuyucu ayracı kendi buluyor', ayni(tm.csvTablosu('Ad;Kira\nA;1.250,50\nB;900'), [['Ad', 'Kira'], ['A', '1.250,50'], ['B', '900']]));
} catch (e) {
  kaldi++;
  console.log('  ✗ beklenmeyen hata:', e?.stack ?? e);
} finally {
  temizle();
}

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
