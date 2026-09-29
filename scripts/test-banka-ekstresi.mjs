// BANKA EKSTRESİNDEN TOPLU TAHSİLAT
// Çalıştır:  node scripts/test-banka-ekstresi.mjs
//   Saf motor ve dosya okuyucu her zaman; veritabanı katmanı yalnız yerel
//   DATABASE_URL varsa; HTTP kapısı yalnız geliştirme sunucusu açıksa.
//
// NEDEN BU TEST
// Burası paraya dokunuyor. Üç hata sessizce para kaybettirir:
//   • yanlış müşteriye eşleşme (başkasının borcu düşer),
//   • aynı havalenin iki kez işlenmesi (müşteri ödemediği parayı ödemiş görünür),
//   • tutarı yanlış okumak ("1.500" → 1,5 TL).
// Her biri burada somut dosya ve somut rakamla deneniyor.
import { PrismaClient } from '@prisma/client';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-banka-'));

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};

// ── DERLEME ──────────────────────────────────────────────────────────────
const istemci = pathToFileURL(join(KOK, 'node_modules/@prisma/client/default.js')).href;
let motor, okuyucu, zip, veri = null, bakiye = null;
try {
  try {
    execFileSync(process.execPath, [
      join(KOK, 'node_modules/typescript/bin/tsc'),
      ...['banka-ekstresi', 'banka-ekstresi-veri', 'tablo-oku', 'ek-dosya', 'sheet-import', 'zip', 'invoicing', 'musteri-bakiye', 'tr-katla']
        .map((f) => join(KOK, `src/lib/${f}.ts`)),
      '--outDir', g, '--module', 'esnext', '--target', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck',
    ], { stdio: 'pipe' });
  } catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
  writeFileSync(join(g, 'prisma-shim.js'), `import { PrismaClient } from ${JSON.stringify(istemci)};\nexport const prisma = new PrismaClient();\n`);
  const duzelt = (dosya, ciftler) => {
    const yol = join(g, dosya);
    let s = readFileSync(yol, 'utf8');
    for (const [a, b] of ciftler) s = s.split(a).join(b);
    writeFileSync(yol, s, 'utf8');
  };
  const ortak = [["'@/lib/prisma'", "'./prisma-shim.js'"], ["'@prisma/client'", JSON.stringify(istemci)]];
  duzelt('banka-ekstresi.js', [["'@/lib/tr-katla'", "'./tr-katla.js'"]]);
  duzelt('tablo-oku.js', [["'@/lib/ek-dosya'", "'./ek-dosya.js'"], ["'@/lib/sheet-import'", "'./sheet-import.js'"]]);
  duzelt('banka-ekstresi-veri.js', [...ortak, ["'@/lib/invoicing'", "'./invoicing.js'"], ["'@/lib/banka-ekstresi'", "'./banka-ekstresi.js'"]]);
  duzelt('invoicing.js', ortak);
  duzelt('musteri-bakiye.js', ortak);
  duzelt('banka-ekstresi-veri.js', [["'@/lib/musteri-bakiye'", "'./musteri-bakiye.js'"]]);
  motor = await import(pathToFileURL(join(g, 'banka-ekstresi.js')).href);
  okuyucu = await import(pathToFileURL(join(g, 'tablo-oku.js')).href);
  zip = await import(pathToFileURL(join(g, 'zip.js')).href);
} catch (e) {
  console.log('✗ derlenemedi:', e?.message);
  rmSync(g, { recursive: true, force: true });
  process.exit(1);
}
const { tutarOku, tarihOku, kolonlariBul, hareketleriCikar, izHesapla, eslestir, dagit, katla } = motor;
const { tabloOku, ayracBul } = okuyucu;

// ── TUTAR ────────────────────────────────────────────────────────────────
console.log('\nBanka ekstresi — tutar ve tarih\n');
{
  const ornekler = [
    ['1.234,56', 1234.56], ['1,234.56', 1234.56], ['-250,00', -250], ['(75,00)', -75],
    ['1.500,00 TL', 1500], ['₺1.500', 1500], ['+1500', 1500], ['1500-', -1500], ['12,5', 12.5],
    ['12.5', 12.5], ['1.234.567,89', 1234567.89], ['1,234,567.89', 1234567.89], ['1500,5', 1500.5], ['0,01', 0.01],
  ];
  const yanlis = ornekler.filter(([g2, b]) => tutarOku(g2) !== b).map(([g2, b]) => [g2, tutarOku(g2), b]);
  t('tutar yazımları (TR, EN, işaret, birim, parantez)', yanlis.length === 0, yanlis);
  t('★ "1.500" bin beş yüz lira okunuyor, 1,5 değil', tutarOku('1.500') === 1500);
  t('sayı olmayan tutar null', tutarOku('abc') === null && tutarOku('') === null && tutarOku(null) === null && tutarOku('12a') === null);
}
{
  const ornekler = [
    ['29.09.2026', '2026-09-29'], ['29/09/2026 14:35', '2026-09-29'], ['2026-09-29', '2026-09-29'],
    ['29-09-26', '2026-09-29'], ['1.9.2026', '2026-09-01'], ['46294', '2026-09-29'], ['46294,5', '2026-09-29'],
  ];
  const yanlis = ornekler.filter(([g2, b]) => tarihOku(g2) !== b).map(([g2, b]) => [g2, tarihOku(g2), b]);
  t('tarih yazımları (gün önce, ISO, 2 haneli yıl, Excel seri no)', yanlis.length === 0, yanlis);
  t('geçersiz tarih reddediliyor (31 Şubat, metin, saçma seri)', tarihOku('31.02.2026') === null && tarihOku('Devreden') === null && tarihOku('12345') === null);
}

// ── KOLONLAR VE HAREKETLER ───────────────────────────────────────────────
console.log('\nBanka ekstresi — kolonlar ve hareketler\n');
{
  const tablo = [
    ['Hesap No: 1234 5678'],
    ['Dönem: 01.09.2026 - 30.09.2026'],
    ['İşlem Tarihi', 'Valör', 'Açıklama', 'İşlem Tutarı', 'Bakiye', 'Dekont No'],
    ['01.09.2026', '01.09.2026', 'EFT - ABC BİLİŞİM LTD ŞTİ FATURA SF-FAT-2026-00012', '1.500,00', '10.000,00', 'D1'],
    ['02.09.2026', '02.09.2026', 'KİRA ÖDEMESİ', '-5.000,00', '5.000,00', 'D2'],
    ['', '', 'Devreden bakiye', '', '5.000,00', ''],
    ['bozuk', '', 'tarihi okunmayan', '250,00', '', ''],
  ];
  const k = kolonlariBul(tablo);
  t('★ başlık satırı üstteki bilgi satırlarının altında bulunuyor', k?.baslikSatiri === 2, k);
  t('valör tarihi ve bakiye bilerek alınmıyor', k?.tarih === 0 && k?.tutar === 3 && k?.aciklama === 2 && k?.referans === 5, k);
  const o = hareketleriCikar(tablo);
  t('gelen havale çıkarıldı, giden atlandı', o.ok && o.hareketler.length === 1 && o.giden === 1, o);
  t('hareketin alanları doğru', o.ok && o.hareketler[0].tarih === '2026-09-01' && o.hareketler[0].tutar === 1500 && o.hareketler[0].referans === 'D1', o.ok && o.hareketler[0]);
  t('★ tutarı olan ama tarihi okunmayan satır bayiye bildiriliyor (sessizce kaybolmuyor)', o.ok && o.okunamayan.join() === '7', o.ok && o.okunamayan);
}
{
  const o = hareketleriCikar([
    ['Tarih', 'Açıklama', 'Borç', 'Alacak', 'Bakiye'],
    ['03.09.2026', 'GELEN EFT', '', '750,00', '1.000'],
    ['04.09.2026', 'KART ODEME', '120,00', '', '880'],
  ]);
  t('ayrı Borç / Alacak kolonlu ekstre', o.ok && o.hareketler.length === 1 && o.hareketler[0].tutar === 750 && o.giden === 1, o);
}
{
  const o = hareketleriCikar([
    ['Tarih', 'Açıklama', 'Tutar', 'B/A'],
    ['03.09.2026', 'GELEN', '1.000,00', 'A'],
    ['04.09.2026', 'GIDEN', '200,00', 'B'],
  ]);
  t('işaretsiz tutar + B/A kolonu', o.ok && o.hareketler.length === 1 && o.hareketler[0].tutar === 1000 && o.giden === 1, o);
}
{
  const satir = ['05.09.2026', 'ALFA OFIS AIDAT', '400,00'];
  const a = hareketleriCikar([['Tarih', 'Açıklama', 'Tutar'], satir, satir]);
  t('★ aynı gün aynı içerikli iki havale İKİ ayrı satır (sıra ayırıyor)', a.ok && a.hareketler.length === 2 && a.hareketler[0].iz !== a.hareketler[1].iz, a.ok && a.hareketler.map((h) => h.sira));
  const b = hareketleriCikar([['X'], ['Tarih', 'Açıklama', 'Tutar'], ['04.09.2026', 'BAŞKA', '10,00'], satir]);
  t('★ aynı havale başka tarih aralıklı ekstrede AYNI iz (satır no ize girmiyor)', a.ok && b.ok && b.hareketler[1].iz === a.hareketler[0].iz);
  t('iz içerikten yeniden hesaplanabiliyor', a.ok && izHesapla(a.hareketler[0]) === a.hareketler[0].iz);
}
{
  const bos = hareketleriCikar([['A', 'B', 'C'], ['05.09.2026', 'x', '10']]);
  t('tarih/tutar başlığı yoksa BASLIK_YOK', !bos.ok && bos.hata === 'BASLIK_YOK');
  const elle = hareketleriCikar([['A', 'B', 'C'], ['05.09.2026', 'x', '10,00']],
    { baslikSatiri: 0, tarih: 0, aciklama: 1, tutar: 2, alacak: -1, borc: -1, yon: -1, gonderen: -1, referans: -1 });
  t('bayi kolonları elle seçince okunuyor', elle.ok && elle.hareketler[0].tutar === 10, elle);
  const yok = hareketleriCikar([['Tarih', 'Açıklama', 'Tutar'], ['05.09.2026', 'x', '-10,00']]);
  t('yalnız giden varsa HAREKET_YOK', !yok.ok && yok.hata === 'HAREKET_YOK');
}

// ── EŞLEŞTİRME ───────────────────────────────────────────────────────────
console.log('\nBanka ekstresi — eşleştirme\n');
{
  const musteriler = [
    { id: 'm1', ad: 'ABC Bilişim Ltd. Şti.', unvan: null, vergiNo: '1234567890' },
    { id: 'm2', ad: 'İpek Ofis', unvan: 'İPEK OFİS MAKİNELERİ SANAYİ VE TİCARET A.Ş.', vergiNo: null },
    { id: 'm3', ad: 'Yıldız Kırtasiye', unvan: null, vergiNo: null },
    { id: 'm4', ad: 'Yıldız Ofis', unvan: null, vergiNo: null },
    { id: 'm5', ad: 'Aksa', unvan: null, vergiNo: null },
    { id: 'm6', ad: 'ABC', unvan: null, vergiNo: null },
    { id: 'm7', ad: 'Deniz Teknoloji Hizmetleri', unvan: null, vergiNo: null },
    { id: 'm8', ad: 'Mavi Büro', unvan: null, vergiNo: '11111111111' },
  ];
  const faturalar = [
    { id: 'f1', musteriId: 'm1', no: 'SF-FAT-2026-00012', gibNo: null, acik: 1500 },
    { id: 'f2', musteriId: 'm3', no: 'SF-FAT-2026-00020', gibNo: null, acik: 900 },
    { id: 'f3', musteriId: 'm4', no: 'SF-FAT-2026-00021', gibNo: null, acik: 1200 },
    { id: 'f4', musteriId: 'm5', no: 'SF-FAT-2026-00030', gibNo: null, acik: 2500 },
    { id: 'f5', musteriId: 'm7', no: 'SF-FAT-2026-00044', gibNo: 'NXS2026000000044', acik: 3000 },
    { id: 'f6', musteriId: 'm8', no: 'SF-FAT-2026-00050', gibNo: null, acik: 777.77 },
    { id: 'f7', musteriId: 'm2', no: 'SF-FAT-2026-00005', gibNo: null, acik: 0 },
  ];
  let sira = 0;
  const hk = (aciklama, tutar, tarih = '2026-09-10') => {
    const h = { satir: ++sira, tarih, tutar, aciklama, gonderen: '', referans: '', sira: 0 };
    return { ...h, iz: izHesapla(h) };
  };
  const tek = (h, ek = {}) => eslestir([h], { musteriler, faturalar, odemeler: [], islenmis: new Set(), ...ek })[0];
  const ozet = (s) => ({ d: s.durum, m: s.musteriId, n: s.neden, a: s.adaylar, sec: s.secili });

  let s = tek(hk('EFT FATURA SF-FAT-2026-00012', 1500));
  t('★ fatura numarası → o faturanın müşterisi, tutar tutuyor, işaretli', s.durum === 'ESLESTI' && s.musteriId === 'm1' && s.neden === 'FATURA_NO' && s.tutarTutuyor && s.secili && s.faturaNo === 'SF-FAT-2026-00012', ozet(s));
  s = tek(hk('havale fatura no 2026-00012', 500));
  t('fatura numarası öneksiz yazılmış (2026-00012)', s.musteriId === 'm1' && s.neden === 'FATURA_NO' && !s.tutarTutuyor, ozet(s));
  s = tek(hk('SFFAT202600012', 10));
  t('fatura numarası ayraçsız yazılmış', s.musteriId === 'm1' && s.neden === 'FATURA_NO', ozet(s));
  s = tek(hk('odeme NXS2026000000044', 3000));
  t('e-Fatura (GİB) numarası', s.musteriId === 'm7' && s.neden === 'FATURA_NO', ozet(s));
  s = tek(hk('eski fatura SF-FAT-2026-00005', 100));
  t('ödenmiş faturanın numarası da müşteriyi söylüyor', s.musteriId === 'm2' && s.neden === 'FATURA_NO', ozet(s));
  s = tek(hk('VKN 1234567890 ODEME', 100));
  t('vergi numarası', s.musteriId === 'm1' && s.neden === 'VERGI_NO' && s.durum === 'ESLESTI', ozet(s));
  s = tek(hk('TCKN:11111111111', 100));
  t('TC kimlik numarası', s.musteriId === 'm8' && s.neden === 'VERGI_NO', ozet(s));
  s = tek(hk('IPEK OFIS MAKINELERI SAN VE TIC AS', 2000));
  t('★ ticari unvan (şirket türü kelimeleri yok sayılarak)', s.musteriId === 'm2' && s.neden === 'ISIM' && s.durum === 'ESLESTI', ozet(s));
  s = tek(hk('EFT İPEK OFİS', 2000));
  t('★ büyük noktalı İ ("İPEK OFİS") müşteri adıyla eşleşiyor', s.musteriId === 'm2', ozet(s));
  s = tek(hk('YILDIZ OFIS KIRTASIYE', 900));
  t('★ iki müşteri aynı tutuyor → beraberliği açık fatura tutarı bozuyor', s.musteriId === 'm3' && s.durum === 'ESLESTI', ozet(s));
  s = tek(hk('YILDIZ OFIS KIRTASIYE', 50));
  t('★ iki müşteri aynı tutuyor, tutar da bozmuyor → SEÇMİYOR, ikisini gösteriyor', s.durum === 'BELIRSIZ' && !s.musteriId && s.adaylar.sort().join() === 'm3,m4' && !s.secili, ozet(s));
  s = tek(hk('AKSA ODEME', 2500));
  t('4 harfli ad + tutar tutuyor → eşleşti', s.musteriId === 'm5' && s.durum === 'ESLESTI', ozet(s));
  s = tek(hk('AKSA ODEME', 100));
  t('★ 4 harfli ad, tutar tutmuyor → yalnız öneri, işaretsiz', s.musteriId === 'm5' && s.durum === 'ONERI' && !s.secili, ozet(s));
  s = tek(hk('ABC ODEME', 10));
  t('★ 3 harfli ad hiç eşleşmiyor ("ABC" her açıklamada geçebilir)', s.durum === 'ESLESMEDI' && !s.musteriId, ozet(s));
  s = tek(hk('DENIZ TEKNOLO', 5));
  t('bankanın kestiği kelime ("TEKNOLO") sayılıyor', s.musteriId === 'm7' && s.neden === 'ISIM', ozet(s));
  s = tek(hk('HAVALE', 777.77));
  t('★ yalnız tutar tutuyor → öneri, işaretsiz', s.durum === 'ONERI' && s.musteriId === 'm8' && s.neden === 'TUTAR' && !s.secili, ozet(s));
  s = tek(hk('HAVALE', 5));
  t('hiçbir ipucu yok → eşleşmedi', s.durum === 'ESLESMEDI' && s.adaylar.length === 0, ozet(s));
  s = tek(hk('TEL 5321234567 ODEME', 5));
  t('açıklamadaki telefon numarası vergi numarası sanılmıyor', s.durum === 'ESLESMEDI', ozet(s));
  const h1 = hk('EFT FATURA SF-FAT-2026-00012', 1500);
  s = tek(h1, { islenmis: new Set([h1.iz]) });
  t('★ daha önce işlenmiş satır İŞLENMİŞ, işaretsiz', s.durum === 'ISLENMIS' && !s.secili, ozet(s));
  s = tek(hk('SF-FAT-2026-00012', 1500, '2026-09-10'), { odemeler: [{ musteriId: 'm1', tutar: 1500, tarih: '2026-09-08' }] });
  t('★ aynı tutar 3 gün içinde elle girilmiş → uyarı, işaretsiz', s.durum === 'ESLESTI' && s.elleGirilmisOlabilir && !s.secili, ozet(s));
  s = tek(hk('SF-FAT-2026-00012', 1500, '2026-09-10'), { odemeler: [{ musteriId: 'm1', tutar: 1500, tarih: '2026-09-01' }] });
  t('elle giriş 3 günden eski → uyarı yok', !s.elleGirilmisOlabilir && s.secili, ozet(s));
  t('Türkçe katlama', katla('İPEK ŞİŞLİ ĞÜÇÖ') === 'ipek sisli guco');
  t('★ arama: "adliye" yazan "ADLİYE"yi buluyor (düz toLowerCase bulamıyordu)', 'ADLİYE'.toLowerCase().includes('adliye') === false && katla('ADLİYE').includes('adliye'));
}
{
  const d = (a, b2, c) => JSON.stringify(dagit(a, b2, c));
  t('★ dağıtım: önce fatura, sonra servis, sonra avans', d(1000, 600, 300) === JSON.stringify({ faturaya: 600, servise: 300, avans: 100 }));
  t('dağıtım: fatura borcu yeterse hepsi faturaya', d(500, 800, 300) === JSON.stringify({ faturaya: 500, servise: 0, avans: 0 }));
  t('dağıtım: fatura yoksa servise', d(500, 0, 300) === JSON.stringify({ faturaya: 0, servise: 300, avans: 200 }));
  t('dağıtım: borç yoksa hepsi avans', d(500, 0, 0) === JSON.stringify({ faturaya: 0, servise: 0, avans: 500 }));
  t('dağıtım kuruş hassas', d(100.1, 33.33, 33.33) === JSON.stringify({ faturaya: 33.33, servise: 33.33, avans: 33.44 }));
}

// ── DOSYA OKUMA ──────────────────────────────────────────────────────────
console.log('\nBanka ekstresi — dosya biçimleri\n');
{
  const csv = '﻿Hesap: 1234\nDönem: Eylül\nTarih;Açıklama;Tutar;Bakiye\n01.09.2026;ABC BILISIM, FATURA;1.500,00;2.000,50\n02.09.2026;X;250,75;2.251,25\n';
  const r = tabloOku(Buffer.from(csv, 'utf8'));
  t('★ CSV: başlıktan önce ayraçsız satırlar varken noktalı virgül seçiliyor', ayracBul(csv) === ';' && r.ok && r.satirlar[3][1] === 'ABC BILISIM, FATURA', r);
  const o = r.ok && hareketleriCikar(r.satirlar);
  t('CSV uçtan uca', o?.ok && o.hareketler.length === 2 && o.hareketler[0].tutar === 1500, o);
}
{
  // Windows-1254: ş=FE ı=FD İ=DD Ş=DE ğ=F0 ç=E7 ü=FC ö=F6 Ç=C7 Ö=D6 Ü=DC Ğ=D0
  const tablo1254 = { 'ş': 0xfe, 'ı': 0xfd, 'İ': 0xdd, 'Ş': 0xde, 'ğ': 0xf0, 'ç': 0xe7, 'ü': 0xfc, 'ö': 0xf6, 'Ç': 0xc7, 'Ö': 0xd6, 'Ü': 0xdc, 'Ğ': 0xd0 };
  const metin = 'Tarih;Açıklama;Tutar\r\n01.09.2026;İPEK OFİS ŞTİ ÖDEME;1.500,00\r\n';
  const bayt = Buffer.from([...metin].map((c) => tablo1254[c] ?? c.charCodeAt(0)));
  const r = tabloOku(bayt);
  t('★ Windows Türkçe (1254) kodlu metin doğru çözülüyor', r.ok && r.satirlar[1][1] === 'İPEK OFİS ŞTİ ÖDEME', r.ok && r.satirlar[1]);
  const u16 = tabloOku(Buffer.from('﻿Tarih\tAçıklama\tTutar\n01.09.2026\tŞİŞLİ OFİS\t99,90\n', 'utf16le'));
  t('Excel "Unicode Metin" (UTF-16, sekmeli)', u16.ok && u16.satirlar[1][1] === 'ŞİŞLİ OFİS' && u16.satirlar[1][2] === '99,90', u16);
}
{
  const kitap = '<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Hareketler" sheetId="1" r:id="rId7"/></sheets></workbook>';
  const iliski = '<?xml version="1.0"?><Relationships><Relationship Id="rId7" Type="worksheet" Target="worksheets/hareket.xml"/></Relationships>';
  const paylasilan = '<sst><si><t>İşlem Tarihi</t></si><si><t>Açıklama</t></si><si><t>Tutar</t></si><si><r><t>ABC </t></r><r><rPr><b/></rPr><t>BİLİŞİM &amp; CO</t></r></si></sst>';
  const sayfa = '<worksheet><sheetData>'
    + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c><c r="D1" t="s"><v>2</v></c></row>'
    + '<row r="2"><c r="A2" s="3"><v>46294</v></c><c r="C2" t="s"><v>3</v></c><c r="D2"><v>1500.5</v></c></row>'
    + '<row r="3"><c r="A3" t="inlineStr"><is><t>30.09.2026</t></is></c><c r="C3" t="str"><v>FORMUL</v></c><c r="D3"><v>-20</v></c></row>'
    + '</sheetData></worksheet>';
  const xlsx = zip.zipUret([
    { ad: '[Content_Types].xml', icerik: '<Types/>' },
    { ad: 'xl/workbook.xml', icerik: kitap },
    { ad: 'xl/_rels/workbook.xml.rels', icerik: iliski },
    { ad: 'xl/sharedStrings.xml', icerik: paylasilan },
    { ad: 'xl/worksheets/sheet1.xml', icerik: '<worksheet><sheetData><row><c><v>1</v></c></row></sheetData></worksheet>' },
    { ad: 'xl/worksheets/hareket.xml', icerik: sayfa },
  ]);
  const r = tabloOku(xlsx);
  t('★ XLSX: çalışma kitabındaki İLK sayfa okunuyor (dosya adına göre değil)', r.ok && r.bicim === 'XLSX' && r.satirlar[0][0] === 'İşlem Tarihi', r);
  t('XLSX: boş hücre kolonu kaydırmıyor, biçimli metin birleşiyor', r.ok && r.satirlar[1][1] === '' && r.satirlar[1][2] === 'ABC BİLİŞİM & CO', r.ok && r.satirlar[1]);
  t('★ XLSX: ondalıklı sayı virgülle yazılıyor (binlik sanılmasın)', r.ok && r.satirlar[1][3] === '1500,5', r.ok && r.satirlar[1]);
  const o = r.ok && hareketleriCikar(r.satirlar);
  t('XLSX uçtan uca: Excel seri tarihi + tutar', o?.ok && o.hareketler.length === 1 && o.hareketler[0].tarih === '2026-09-29' && o.hareketler[0].tutar === 1500.5 && o.giden === 1, o);
}
{
  const html = '<html><body><table><tr><th>Tarih</th><th>Açıklama</th><th>Tutar</th></tr><tr><td>01.09.2026</td><td><b>ABC</b> &amp; Co</td><td>1.500,00</td></tr></table></body></html>';
  const r = tabloOku(Buffer.from(html, 'utf8'));
  t('.xls diye inen HTML tablosu', r.ok && r.bicim === 'HTML' && r.satirlar[1][1] === 'ABC & Co', r);
  const x = '<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="S"><Table>'
    + '<Row><Cell><Data ss:Type="String">Tarih</Data></Cell><Cell><Data ss:Type="String">Açıklama</Data></Cell><Cell><Data ss:Type="String">Tutar</Data></Cell></Row>'
    + '<Row><Cell><Data ss:Type="String">01.09.2026</Data></Cell><Cell ss:Index="3"><Data ss:Type="Number">250.75</Data></Cell></Row>'
    + '</Table></Worksheet></Workbook>';
  const r2 = tabloOku(Buffer.from(x, 'utf8'));
  t('XML Elektronik Tablo 2003 (ss:Index boşluğu korunuyor)', r2.ok && r2.bicim === 'XML2003' && r2.satirlar[1].join('|') === '01.09.2026||250,75', r2);
  const biff = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
  t('★ gerçek eski .xls tahmin edilmiyor, açık hata', (() => { const r3 = tabloOku(biff); return !r3.ok && r3.hata === 'ESKI_XLS'; })());
  t('boş dosya', (() => { const r3 = tabloOku(Buffer.alloc(0)); return !r3.ok && r3.hata === 'BOS'; })());
  t('bozuk ZIP okunamadı der, çökmez', (() => { const r3 = tabloOku(Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])); return !r3.ok && r3.hata === 'OKUNAMADI'; })());
}

// ── KAYNAK BAĞLANTILARI ──────────────────────────────────────────────────
console.log('\nBanka ekstresi — bağlantılar\n');
{
  const oku = (p) => readFileSync(join(KOK, p), 'utf8');
  const onizle = oku('src/app/api/collections/banka/onizle/route.ts');
  const isle = oku('src/app/api/collections/banka/route.ts');
  t('★ iki uç da yalnız yönetici', /requireAdminUser\(\)/.test(onizle) && (isle.match(/requireAdminUser\(\)/g) ?? []).length === 2);
  t('önizleme ucu veritabanına yazmıyor', !/\.create\(|\.update\(|ekstreIsle/.test(onizle));
  const inv = oku('src/lib/invoicing.ts');
  t('★ tek yazma yolu: elle tahsilat da aynı mahsup fonksiyonundan geçiyor', /return prisma\.\$transaction\(\(tx\) => allocatePaymentTx\(tx, params\)\)/.test(inv));
  t('★ mahsup müşteri satırını kilitliyor (eşzamanlı tahsilat kaybolmasın)', /FOR UPDATE/.test(inv) && /await musteriyiKilitle\(tx, tenantId, customerId\)/.test(inv));
  const g2 = oku('prisma/migrations/20260929130000_banka_hareketi/migration.sql');
  t('★ (bayi, iz) veritabanında tekil', /CREATE UNIQUE INDEX IF NOT EXISTS "BankaHareketi_tenantId_iz_key" ON "BankaHareketi"\("tenantId", "iz"\)/.test(g2));
  t('şema ile migrasyon aynı kısıtı söylüyor', /@@unique\(\[tenantId, iz\]\)/.test(oku('prisma/schema.prisma')));
  const veriKod = oku('src/lib/banka-ekstresi-veri.ts');
  t('★ istemciden gelen iz sunucuda yeniden hesaplanıyor', /izHesapla\(h\) === h\.iz/.test(veriKod));
  t('★ iki ekranın müşteri araması Türkçe katlıyor', /icerir\(c\.name, custSearch\)/.test(oku('src/app/(dashboard)/collections/page.tsx'))
    && /icerir\(m\.ad, ara\)/.test(oku('src/app/(dashboard)/collections/banka/page.tsx')));
  t('ekran sunucu motorunu değer olarak almıyor (node:crypto tarayıcıya gitmesin)', !/^import \{[^}]*\} from '@\/lib\/banka-ekstresi'/m.test(oku('src/app/(dashboard)/collections/banka/page.tsx')));
  t('tahsilat ekranından yeni ekrana yol var', /href="\/collections\/banka"/.test(oku('src/app/(dashboard)/collections/page.tsx')));
  t('ekran INVOICING paketine bağlı (alt yol /collections altında)', /INVOICING:\s*\{ hrefs: \['\/invoices', '\/collections'\] \}/.test(oku('src/lib/modules.ts')));
}

// ── VERİTABANI ───────────────────────────────────────────────────────────
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
  try {
    veri = await import(pathToFileURL(join(g, 'banka-ekstresi-veri.js')).href);
    bakiye = await import(pathToFileURL(join(g, 'musteri-bakiye.js')).href);
  } catch (e) {
    console.log('  ✗ veri katmanı derlenemedi —', e?.message);
    kaldi++;
  }
}

if (veri) {
  console.log('\nBanka ekstresi — veritabanı\n');
  const { ekstreOnizle, ekstreIsle, sonIslenenler } = veri;
  const p = new PrismaClient();
  const SLUG = 'test-banka-ekstresi', SLUG2 = 'test-banka-ekstresi-2';
  const kullanici = { id: 'test-kullanici', name: 'Test Yönetici' };
  try {
    for (const sl of [SLUG, SLUG2]) {
      const eski = await p.tenant.findFirst({ where: { slug: sl }, select: { id: true } });
      if (eski) await p.tenant.delete({ where: { id: eski.id } });
    }
    const bayi = (await p.tenant.create({ data: { name: 'Banka Test Bayisi', slug: SLUG }, select: { id: true } })).id;
    const bayi2 = (await p.tenant.create({ data: { name: 'Başka Bayi', slug: SLUG2 }, select: { id: true } })).id;
    let tel = 5550000000;
    const musteri = async (tenantId, name) => (await p.customer.create({ data: { tenantId, name, phone: String(tel++) }, select: { id: true } })).id;
    const A = await musteri(bayi, 'Alfa Ofis');
    const B = await musteri(bayi, 'Beta Büro');
    const C = await musteri(bayi, 'Gama Kırtasiye');
    const X = await musteri(bayi2, 'Alfa Ofis');
    const fatura = async (customerId, no, tutar, gunOnce) => (await p.customerInvoice.create({
      data: {
        tenantId: bayi, customerId, invoiceNumber: no, period: '2026-08',
        invoiceDate: new Date(Date.now() - gunOnce * 86400000), dueDate: new Date(Date.now() - (gunOnce - 10) * 86400000),
        subtotal: tutar, vatAmount: 0, totalAmount: tutar, status: 'OPEN',
      },
      select: { id: true },
    })).id;
    const a1 = await fatura(A, 'SF-FAT-2026-90001', 1000, 60);
    const a2 = await fatura(A, 'SF-FAT-2026-90002', 500, 30);
    await fatura(C, 'SF-FAT-2026-90003', 300, 30);
    await p.accountEntry.create({ data: { tenantId: bayi, customerId: B, type: 'SALE', product: 'Servis', amount: 800 } });
    await p.accountEntry.create({ data: { tenantId: bayi, customerId: C, type: 'SALE', product: 'Servis', amount: 200 } });

    let sira = 0;
    const hk = (aciklama, tutar, tarih = '2026-09-15', ek = {}) => {
      const h = { satir: ++sira, tarih, tutar, aciklama, gonderen: '', referans: '', sira: 0, ...ek };
      return { ...h, iz: motor.izHesapla(h) };
    };
    const hA = hk('ALFA OFIS FATURA', 1200);
    const hB = hk('BETA BURO SERVIS', 500);
    const hC = hk('GAMA KIRTASIYE', 700);

    const r1 = await ekstreIsle(bayi, kullanici, [{ hareket: hA, musteriId: A }, { hareket: hB, musteriId: B }, { hareket: hC, musteriId: C }]);
    t('üç satır işlendi', r1.every((x) => x.durum === 'TAMAM'), r1);
    const [rA, rB, rC] = r1;
    t('★ A: hepsi faturalara (en eski önce)', rA.faturaya === 1200 && rA.servise === 0 && rA.avans === 0, rA);
    const fa = await p.customerInvoice.findMany({ where: { id: { in: [a1, a2] } }, select: { id: true, status: true, paidAmount: true } });
    const fa1 = fa.find((f) => f.id === a1), fa2 = fa.find((f) => f.id === a2);
    t('A: eski fatura KAPANDI, yenisi kısmi', fa1.status === 'PAID' && Number(fa1.paidAmount) === 1000 && fa2.status === 'PARTIAL' && Number(fa2.paidAmount) === 200, fa);
    t('★ B: servis borcuna yazıldı, avansa kaçmadı', rB.faturaya === 0 && rB.servise === 500 && rB.avans === 0, rB);
    t('B için tahsilat (Payment) açılmadı — servis carisi kendi kaydıyla', (await p.payment.count({ where: { tenantId: bayi, customerId: B } })) === 0);
    t('B servis carisinde banka izli ödeme', (await p.accountEntry.count({ where: { tenantId: bayi, customerId: B, type: 'PAYMENT', importKey: `banka:${hB.iz}` } })) === 1);
    t('★ C: fatura 300 + servis 200 + avans 200', rC.faturaya === 300 && rC.servise === 200 && rC.avans === 200, rC);
    const pC = await p.payment.findFirst({ where: { tenantId: bayi, customerId: C }, select: { amount: true, notes: true, method: true } });
    t('C tahsilatı fatura + avans kadar, havale, not düşülmüş', Number(pC?.amount) === 500 && pC?.method === 'TRANSFER' && /Banka ekstresi/.test(pC?.notes ?? ''), pC);
    const gelir = await p.financialTransaction.aggregate({ where: { tenantId: bayi, type: 'INCOME' }, _sum: { amount: true } });
    t('nakit esaslı gelir yalnız faturaya mahsup edilen kadar (1200 + 300)', Number(gelir._sum.amount) === 1500, gelir._sum);

    const b1 = await bakiye.tumBakiyeler(bayi);
    t('★ müşterilerin TOPLAM borcu ödenen kadar düştü', b1.get(A).toplamBorc === 300 && b1.get(B).toplamBorc === 300 && b1.get(C).toplamBorc === 0,
      [...b1.values()].map((x) => [x.customerId === A ? 'A' : x.customerId === B ? 'B' : 'C', x.toplamBorc]));

    const sayim = async () => ({
      p: await p.payment.count({ where: { tenantId: bayi } }),
      e: await p.accountEntry.count({ where: { tenantId: bayi, type: 'PAYMENT' } }),
      h: await p.bankaHareketi.count({ where: { tenantId: bayi } }),
    });
    const once = await sayim();
    const r2 = await ekstreIsle(bayi, kullanici, [{ hareket: hA, musteriId: A }, { hareket: hB, musteriId: B }, { hareket: hC, musteriId: C }]);
    const sonra = await sayim();
    t('★ aynı satırlar ikinci kez: hepsi İŞLENMİŞ, tek kayıt eklenmedi', r2.every((x) => x.durum === 'ISLENMIS') && JSON.stringify(once) === JSON.stringify(sonra), { r2, once, sonra });
    const r2b = await ekstreIsle(bayi, kullanici, [{ hareket: hA, musteriId: B }]);
    t('★ aynı satır BAŞKA müşteriye de ikinci kez işlenemiyor', r2b[0].durum === 'ISLENMIS' && JSON.stringify(await sayim()) === JSON.stringify(once), r2b);

    const hEs = hk('ALFA OFIS EK', 100);
    const [e1, e2] = await Promise.all([ekstreIsle(bayi, kullanici, [{ hareket: hEs, musteriId: A }]), ekstreIsle(bayi, kullanici, [{ hareket: hEs, musteriId: A }])]);
    t('★ aynı satır iki sekmeden aynı anda: yalnız biri işliyor', [e1[0].durum, e2[0].durum].sort().join() === 'ISLENMIS,TAMAM', [e1, e2]);

    const [k1, k2] = await Promise.all([
      ekstreIsle(bayi, kullanici, [{ hareket: hk('ALFA OFIS 1', 150), musteriId: A }]),
      ekstreIsle(bayi, kullanici, [{ hareket: hk('ALFA OFIS 2', 150), musteriId: A }]),
    ]);
    const fa2b = await p.customerInvoice.findUnique({ where: { id: a2 }, select: { status: true, paidAmount: true } });
    const avansA = (await p.bankaHareketi.aggregate({ where: { tenantId: bayi, customerId: A }, _sum: { avans: true } }))._sum.avans;
    t('★ aynı müşteriye iki FARKLI havale aynı anda: ödenen tutar kaybolmuyor', k1[0].durum === 'TAMAM' && k2[0].durum === 'TAMAM'
      && Number(fa2b.paidAmount) === 500 && fa2b.status === 'PAID' && Number(avansA) === 100, { fa2b, avansA: Number(avansA) });

    const bozuk = { ...hk('ALFA', 50), tutar: 5000 };
    const r3 = await ekstreIsle(bayi, kullanici, [{ hareket: bozuk, musteriId: A }]);
    t('★ tutarı değiştirilmiş satır (iz tutmuyor) reddediliyor', r3[0].durum === 'GECERSIZ');
    const r4 = await ekstreIsle(bayi, kullanici, [{ hareket: hk('ALFA OFIS', 10), musteriId: X }]);
    t('★ başka bayinin müşterisine yazılamıyor', r4[0].durum === 'MUSTERI_YOK' && (await p.payment.count({ where: { customerId: X } })) === 0);
    const r5 = await ekstreIsle(bayi, kullanici, [{ hareket: { ...hk('x', 10), tarih: '2026-13-45' }, musteriId: A }, { hareket: null, musteriId: A }, { hareket: hk('x', -5), musteriId: A }]);
    t('biçimsiz gövde yazmadan reddediliyor', r5.every((x) => x.durum === 'GECERSIZ'));

    // Önizleme — işlenmiş satır, adla eşleşme, elle girilmiş uyarısı
    await p.payment.create({ data: { tenantId: bayi, customerId: B, amount: 999, method: 'TRANSFER', paymentDate: new Date('2026-09-20T10:00:00Z') } });
    const hYeni = hk('EFT ALFA OFIS', 42);
    const hElle = hk('BETA BURO', 999, '2026-09-21');
    const on = await ekstreOnizle(bayi, [hA, hYeni, hElle]);
    const bul = (h) => on.satirlar.find((x) => x.hareket.iz === h.iz);
    t('★ önizleme: işlenmiş satırı işaretliyor ve hangi müşteriye işlendiğini söylüyor', bul(hA).durum === 'ISLENMIS' && bul(hA).musteriId === A && !bul(hA).secili);
    t('önizleme: yeni satır adla eşleşiyor', bul(hYeni).durum === 'ESLESTI' && bul(hYeni).musteriId === A, bul(hYeni));
    t('★ adla eşleşen ama borcu olmayan müşteri işaretli GELMİYOR (para avansa gidecek)', !bul(hYeni).secili);
    const hBorclu = hk('BETA BURO', 120, '2026-10-05');
    t('adla eşleşen ve borcu olan müşteri işaretli geliyor', (await ekstreOnizle(bayi, [hBorclu])).satirlar[0].secili === true);
    t('★ önizleme: elle girilmiş tahsilatı uyarıyor', bul(hElle).musteriId === B && bul(hElle).elleGirilmisOlabilir && !bul(hElle).secili, bul(hElle));
    t('önizleme: bankadan işlenen tahsilat "elle girilmiş" sayılmıyor', (() => {
      const s = on.satirlar.find((x) => x.hareket.iz === hYeni.iz);
      return !s.elleGirilmisOlabilir;
    })());
    t('önizleme başka bayinin müşterisini listelemiyor', !on.musteriler.some((m) => m.id === X) && on.musteriler.length === 3);
    const borcu = (id) => on.musteriler.find((m) => m.id === id)?.borc;
    t('★ önizleme müşterinin güncel TOPLAM borcunu veriyor (servis + fatura)', borcu(A) === 0 && borcu(B) === 300 && borcu(C) === 0, on.musteriler);

    const son = await sonIslenenler(bayi);
    t('son işlenenler: yeniden eskiye, müşteri adı ve işleyen', son.length === 6 && son.every((k) => k.musteriAd && k.isleyen === 'Test Yönetici'), son.length);
    t('başka bayinin listesi boş', (await sonIslenenler(bayi2)).length === 0);
  } catch (e) {
    kaldi++;
    console.log('  ✗ veritabanı testi çöktü —', e?.message);
  } finally {
    for (const sl of [SLUG, SLUG2]) {
      const eski = await p.tenant.findFirst({ where: { slug: sl }, select: { id: true } }).catch(() => null);
      if (eski) await p.tenant.delete({ where: { id: eski.id } }).catch(() => {});
    }
    await p.$disconnect();
    // Veri katmanının kendi istemcisi de kapanmalı: açık bağlantıyla çıkan
    // süreç Windows'ta Prisma motorunu kapanırken çökertiyordu (0xC0000409).
    const shim = await import(pathToFileURL(join(g, 'prisma-shim.js')).href);
    await shim.prisma.$disconnect();
  }
}

// ── HTTP ─────────────────────────────────────────────────────────────────
{
  const SUNUCU = process.env.TEST_SUNUCU || 'http://localhost:3002';
  // Yanıt gövdeleri HEP okunuyor: okunmamış gövdeyle açık kalan soket,
  // process.exit sırasında Windows'ta libuv onayını patlatıyordu
  // (UV_HANDLE_CLOSING) — testler geçtiği hâlde süreç çöküş koduyla bitiyordu.
  const durum = async (...a) => { const r = await fetch(...a); await r.arrayBuffer().catch(() => {}); return r.status; };
  const acik = await durum(`${SUNUCU}/api/collections/banka`, { signal: AbortSignal.timeout(4000) }).then(() => true).catch(() => false);
  if (!acik) console.log('\n  ⊘ HTTP katmanı atlandı: sunucu kapalı');
  else {
    console.log('\nBanka ekstresi — HTTP\n');
    t('liste oturumsuz açılmıyor', (await durum(`${SUNUCU}/api/collections/banka`)) === 401);
    const form = new FormData();
    form.append('dosya', new Blob(['Tarih;Tutar\n01.09.2026;10,00']), 'x.csv');
    t('önizleme oturumsuz açılmıyor', (await durum(`${SUNUCU}/api/collections/banka/onizle`, { method: 'POST', body: form })) === 401);
    t('işleme oturumsuz açılmıyor', (await durum(`${SUNUCU}/api/collections/banka`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"satirlar":[]}' })) === 401);
  }
}

rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
// process.exit() DEĞİL: Prisma motorunun iş parçacıkları kapanırken süreç
// zorla kesilince Windows'ta libuv onayı patlıyordu (async.c:76,
// UV_HANDLE_CLOSING) — testler geçtiği hâlde çıkış kodu çöküş oluyordu.
// Çıkış kodu verilip döngünün kendiliğinden bitmesi bekleniyor.
process.exitCode = kaldi ? 1 : 0;
