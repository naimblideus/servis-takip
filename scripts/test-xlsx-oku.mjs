// XLSX OKUYUCU — bayinin Excel dosyası CSV'ye çevirmeden okunuyor mu?
// Çalıştır:  node scripts/test-xlsx-oku.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// "Excel'den kendiniz aktarın" yalnız CSV kabul ediyordu; bayinin elindeki
// dosya ise .xlsx. Okuyucu bağımlılıksız (lib/xlsx-oku.ts): ZIP'i kendimiz
// açıyoruz. Bu test bellekte GERÇEK bir .xlsx üretir (elle yazılmış ZIP:
// sıkıştırılmış + sıkıştırılmamış girdiler) ve okuyucunun Excel'in gerçekten
// yazdığı biçimleri doğru çözdüğünü ölçer: ortak metin tablosu, satır içi
// metin, zengin metin parçaları, sayı, boş hücre, XML varlıkları, Türkçe harf.
//
// ★ Sayı tuzağı: XLSX'te 0,125 ₺ "0.125" diye yazılır; CSV'ye aynen konup
// trNumber'a verilirse üçlü grup kalıbına uyar ve BİNLİK sanılır → 125.
// İçe aktarma sayıları ondalık VİRGÜLLE geçiriyor; test bunu tutuyor.
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { deflateRawSync } from 'node:zlib';
import * as zlib from 'node:zlib';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-xlsx-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/xlsx-oku.ts'), join(KOK, 'src/lib/sheet-import.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz (DOM tipleri yok), tsc ayrıca koşuyor */ }
const { xlsxOku, satirlarCsv, kolonNo, xmlCoz, XlsxHatasi } = await import(pathToFileURL(join(g, 'xlsx-oku.js')).href);
const { parseCSV, autoMap, trNumber } = await import(pathToFileURL(join(g, 'sheet-import.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const ayni = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── Elle ZIP yazıcı (yerel başlık + veri + merkez dizin + EOCD) ─────────────
const crcTablo = (() => {
  const tb = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; tb[n] = c >>> 0; }
  return tb;
})();
const crc32 = (buf) => {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  let c = 0xffffffff;
  for (const b of buf) c = crcTablo[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function zipYaz(girdiler, { yorum = '' } = {}) {
  const yereller = [], merkez = [];
  let ofset = 0;
  for (const { ad, icerik, sakla } of girdiler) {
    const veri = Buffer.from(icerik, 'utf8');
    const sikisik = sakla ? veri : deflateRawSync(veri);
    const adB = Buffer.from(ad, 'utf8');
    const crc = crc32(veri);
    const yerel = Buffer.alloc(30);
    yerel.writeUInt32LE(0x04034b50, 0); yerel.writeUInt16LE(20, 4); yerel.writeUInt16LE(0x0800, 6);
    yerel.writeUInt16LE(sakla ? 0 : 8, 8); yerel.writeUInt32LE(crc, 14);
    yerel.writeUInt32LE(sikisik.length, 18); yerel.writeUInt32LE(veri.length, 22);
    yerel.writeUInt16LE(adB.length, 26); yerel.writeUInt16LE(0, 28);
    yereller.push(yerel, adB, sikisik);
    const m = Buffer.alloc(46);
    m.writeUInt32LE(0x02014b50, 0); m.writeUInt16LE(20, 4); m.writeUInt16LE(20, 6); m.writeUInt16LE(0x0800, 8);
    m.writeUInt16LE(sakla ? 0 : 8, 10); m.writeUInt32LE(crc, 16);
    m.writeUInt32LE(sikisik.length, 20); m.writeUInt32LE(veri.length, 24);
    m.writeUInt16LE(adB.length, 28); m.writeUInt32LE(ofset, 42);
    merkez.push(m, adB);
    ofset += 30 + adB.length + sikisik.length;
  }
  const merkezB = Buffer.concat(merkez);
  const yorumB = Buffer.from(yorum, 'utf8');
  const son = Buffer.alloc(22);
  son.writeUInt32LE(0x06054b50, 0);
  son.writeUInt16LE(girdiler.length, 8); son.writeUInt16LE(girdiler.length, 10);
  son.writeUInt32LE(merkezB.length, 12); son.writeUInt32LE(ofset, 16); son.writeUInt16LE(yorumB.length, 20);
  const tum = Buffer.concat([...yereller, merkezB, son, yorumB]);
  return tum.buffer.slice(tum.byteOffset, tum.byteOffset + tum.byteLength);
}

// ── Excel'in yazdığı biçimde küçük bir çalışma kitabı ──────────────────────
const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const RNS = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>`;
const kokRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
// İlk sayfa GİZLİ: okuyucu ilk GÖRÜNEN sayfayı almalı. Görünen sayfanın dosyası
// sheet2.xml değil sheet1.xml — dosya adı sıradan değil rels'ten çözülmeli.
const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook ${NS} ${RNS}><sheets><sheet name="Ayarlar" sheetId="2" state="hidden" r:id="rId9"/><sheet name="Müşteri Listesi" sheetId="1" r:id="rId3"/></sheets></workbook>`;
const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet1.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`;
// Ortak metinler x: önekiyle (.NET OpenXML SDK böyle yazar), zengin metin,
// fonetik (<rPh>, okunmamalı), varlıklar, sayısal karakter başvurusu (&#304; = İ),
// Excel'in _x000D_ kaçışı ve boş <t/>.
const sst = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<x:sst xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="9" uniqueCount="9">
<x:si><x:t>Müşteri Adı</x:t></x:si>
<x:si><x:t>Telefon</x:t></x:si>
<x:si><x:t>Seri No</x:t></x:si>
<x:si><x:t>Kiralık</x:t></x:si>
<x:si><x:t>Aylık Kira</x:t></x:si>
<x:si><x:r><x:rPr><x:b/></x:rPr><x:t>Çetin </x:t></x:r><x:r><x:t xml:space="preserve">Kırtasiye &amp; Ofis</x:t></x:r><x:rPh sb="0" eb="1"><x:t>FONETIK</x:t></x:rPh></x:si>
<x:si><x:t>&#304;stanbul &lt;Şişli&gt; &quot;Ğ&quot; &apos;ü&apos; &#x15F;</x:t></x:si>
<x:si><x:t/></x:si>
<x:si><x:t>Satır_x000D_Sonu</x:t></x:si>
</x:sst>`;
// Hücreler: başlık ortak metin; veri satırında satır içi metin, sayılar,
// boş hücre (C2 hiç yazılmamış), mantıksal, formül metni, hata hücresi ve
// en sağda biçimli ama BOŞ hücre (XFD2 — genişliği patlatmamalı). Satır 3 boş
// (yalnız biçim), satır 5 r ile atlayarak geliyor.
const sheet1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet ${NS} ${RNS}><dimension ref="A1:F5"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><cols><col min="1" max="1" width="30" customWidth="1"/></cols><sheetData>
<row r="1" spans="1:6"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c><c r="E1" t="s"><v>4</v></c><c r="F1" t="inlineStr"><is><t>S/B Sayfa Fiyatı</t></is></c></row>
<row r="2" spans="1:6"><c r="A2" t="s"><v>5</v></c><c r="B2"><v>5551112233</v></c><c r="D2" t="b"><v>1</v></c><c r="E2" s="3"><v>1500</v></c><c r="F2"><v>0.125</v></c><c r="XFD2" s="7"/></row>
<row r="3" spans="1:6" ht="20" customHeight="1"><c r="A3" s="2"/></row>
<row r="5"><c r="A5" t="s"><v>6</v></c><c r="B5" t="inlineStr"><is><r><t>05</t></r><r><t xml:space="preserve">32 000 00 00</t></r></is></c><c r="C5" t="str"><f>CONCAT("PN","-1")</f><v>PN-1</v></c><c r="D5" t="b"><v>0</v></c><c r="E5" t="e"><v>#N/A</v></c><c r="F5"><v>0.30000000000000004</v></c></row>
<row r="6"><c r="A6" t="s"><v>7</v></c><c r="B6" t="s"><v>8</v></c><c r="C6"><v>1.5E-7</v></c><c r="D6"><v>-12.5</v></c><c r="F6"><v>108491</v></c></row>
</sheetData><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;
// Gizli sayfa — okunmamalı.
const sheet2 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet ${NS}><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>GİZLİ</t></is></c></row></sheetData></worksheet>`;

const kitap = zipYaz([
  { ad: '[Content_Types].xml', icerik: contentTypes },
  { ad: '_rels/.rels', icerik: kokRels, sakla: true },
  { ad: 'xl/workbook.xml', icerik: workbook },
  { ad: 'xl/_rels/workbook.xml.rels', icerik: wbRels, sakla: true },
  { ad: 'xl/sharedStrings.xml', icerik: sst },
  { ad: 'xl/worksheets/sheet1.xml', icerik: sheet1 },
  { ad: 'xl/worksheets/sheet2.xml', icerik: sheet2 },
], { yorum: 'zip sonu yorumu — EOCD taraması bunu atlamalı' });

console.log('\n★ BELLEKTE ÜRETİLEN XLSX OKUNUYOR\n');
let satirlar = null;
try { satirlar = await xlsxOku(kitap); } catch (e) { t('okuyucu patlamadı', false, String(e?.stack || e)); }
if (satirlar) {
  t('★ ilk GÖRÜNEN sayfa okundu (gizli sayfa değil)', !satirlar.flat().includes('GİZLİ'), satirlar[0]);
  t('başlık satırı: ortak metin + satır içi metin', ayni(satirlar[0], ['Müşteri Adı', 'Telefon', 'Seri No', 'Kiralık', 'Aylık Kira', 'S/B Sayfa Fiyatı']), satirlar[0]);
  t('★ genişlik en sağdaki DOLU hücre (biçimli boş XFD2 16 bin kolon açmadı)', satirlar.every((s) => s.length === 6), satirlar.map((s) => s.length));
  t('tamamen boş satır (3) atıldı, atlanan satır numarası (5) sorun değil', satirlar.length === 4, satirlar.length);

  const [, s2, s5, s6] = satirlar;
  t('★ zengin metin parçaları birleşti, fonetik okunmadı, &amp; çözüldü', s2[0] === 'Çetin Kırtasiye & Ofis', s2[0]);
  t('tam sayı olduğu gibi (telefon)', s2[1] === '5551112233', s2[1]);
  t('★ yazılmamış hücre boş kalıyor, kolon kaymıyor', s2[2] === '' && s2[3] === 'TRUE' && s2[4] === '1500', s2);
  t('kesirli sayı (ayar yokken) JS biçiminde', s2[5] === '0.125', s2[5]);
  t('★ Türkçe harf + varlıklar + sayısal karakter başvurusu', s5[0] === 'İstanbul <Şişli> "Ğ" \'ü\' ş', s5[0]);
  t('satır içi zengin metin (boşluk korunarak)', s5[1] === '0532 000 00 00', s5[1]);
  t('formül hücresinin metin sonucu', s5[2] === 'PN-1', s5[2]);
  t('mantıksal 0 → FALSE', s5[3] === 'FALSE', s5[3]);
  t('hata hücresi (#N/A) veri sayılmıyor', s5[4] === '', s5[4]);
  t('kayan nokta artığı temizlendi (0.30000000000000004 → 0.3)', s5[5] === '0.3', s5[5]);
  t('boş <t/> ortak metni boş', s6[0] === '', s6[0]);
  t('Excel _x000D_ kaçışı çözüldü', s6[1] === 'Satır\rSonu', s6[1]);
  t('üslü küçük sayı düz ondalığa çevrildi (1.5E-7)', s6[2] === '0.00000015', s6[2]);
  t('eksi ondalık', s6[3] === '-12.5', s6[3]);
  t('büyük tam sayı (sayaç) aynen', s6[5] === '108491', s6[5]);
}

console.log('\n★ İÇE AKTARMA YOLU: sayılar Türk biçiminde, CSV aynı ayrıştırıcıdan geçiyor\n');
{
  const tr = await xlsxOku(kitap, { ondalikVirgul: true });
  t('★ 0.125 → "0,125" (binlik sanılmasın)', tr[1][5] === '0,125', tr[1][5]);
  t('★ trNumber("0,125") = 0.125 — ayarsız hâli 125 olurdu (ölçülmüş tuzak)', trNumber(tr[1][5]) === 0.125 && trNumber('0.125') === 125, [trNumber(tr[1][5]), trNumber('0.125')]);
  t('tam sayılara dokunulmadı', tr[1][1] === '5551112233' && tr[3][5] === '108491', [tr[1][1], tr[3][5]]);
  t('METİN hücresine dokunulmadı (yalnız sayı hücresi virgüllenir)', tr[0][5] === 'S/B Sayfa Fiyatı');

  const csv = satirlarCsv(tr);
  const geri = parseCSV(csv);
  // CSV ayrıştırıcısı satır sonlarını LF'e indiriyor (CR → LF); hücre içi CR de öyle.
  const crsiz = tr.map((s) => s.map((h) => h.replace(/\r\n?/g, '\n')));
  t('★ CSV gidiş-dönüş birebir (tırnak, ; ve satır sonu içeren hücreler dahil)', ayni(geri, crsiz), { geri, crsiz });
  const m = autoMap(geri[0]);
  t('başlıklar eşleyiciye doğru düşüyor (Kiralık/Aylık Kira dahil)', ayni(m, ['customerName', 'phone', 'serialNo', 'isRental', 'monthlyRent', 'pricePerBlack']), m);
  t('içinde ; olan hücre tırnaklanıyor', satirlarCsv([['a;b', 'c"d']]) === '"a;b";"c""d"', satirlarCsv([['a;b', 'c"d']]));
}

console.log('\nYARDIMCILAR\n');
{
  t('kolon harfi → sıra: A=0, Z=25, AA=26, XFD=16383', kolonNo('A1') === 0 && kolonNo('Z9') === 25 && kolonNo('AA3') === 26 && kolonNo('XFD1') === 16383);
  t('XML varlıkları tek geçişte (&amp;lt; → &lt;, iki kez çözülmüyor)', xmlCoz('&amp;lt;') === '&lt;', xmlCoz('&amp;lt;'));
}

console.log('\nBOZUK / YANLIŞ DOSYA\n');
{
  // .xls (ve parolalı .xlsx) CFB kabıdır: D0 CF 11 E0 — ZIP değil.
  const cfb = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...new Array(600).fill(0)]).buffer;
  let hata = null;
  try { await xlsxOku(cfb); } catch (e) { hata = e; }
  t('★ eski .xls açıkça reddediliyor (sessiz boş liste değil)', hata instanceof XlsxHatasi && hata.kod === 'ZIP_DEGIL', hata && String(hata));
  let hata2 = null;
  try { await xlsxOku(zipYaz([{ ad: 'readme.txt', icerik: 'xlsx değil' }])); } catch (e) { hata2 = e; }
  t('içinde sayfa olmayan ZIP reddediliyor', hata2 instanceof XlsxHatasi && hata2.kod === 'SAYFA_YOK', hata2 && String(hata2));
  const kesik = kitap.slice(0, Math.floor(kitap.byteLength / 2));
  let hata3 = null;
  try { await xlsxOku(kesik); } catch (e) { hata3 = e; }
  t('yarım inmiş dosya hata veriyor', hata3 != null, hata3 && String(hata3));
}

console.log('\nBİLEŞEN XLSX\'İ BU YOLDAN GEÇİRİYOR (kaynak denetimi)\n');
{
  const bilesen = readFileSync(join(KOK, 'src/components/ExcelImport.tsx'), 'utf8');
  t('dosya seçici .xlsx kabul ediyor', /accept="\.csv,\.txt,\.xlsx"/.test(bilesen));
  t('★ .xlsx ondalık virgülle okunup CSV yoluna veriliyor', /xlsxOku\(await f\.arrayBuffer\(\), \{ ondalikVirgul: true \}\)/.test(bilesen) && /satirlarCsv\(/.test(bilesen));
  t('önizlemede kiralık ve aylık kira kolonları var', /alanKiralik, t\.excelAktar\.alanKira\]/.test(bilesen) && /s\.isRental \?/.test(bilesen) && /s\.monthlyRent != null/.test(bilesen));
  t('örnek şablon düğmesi var', /sablonCsv\(/.test(bilesen) && /onClick=\{sablonIndir\}/.test(bilesen));
}

rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
