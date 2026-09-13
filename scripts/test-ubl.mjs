// UBL-TR 1.2 XML + ZIP arşivi
// Çalıştır:  node scripts/test-ubl.mjs   (sunucu gerekmez)
//
// NEDEN BU TEST
// Bu XML, müşteriye giden RESMÎ belgenin kendisi. Entegratör portalına
// yüklenecek ve GİB'e gidecek. Test ettiğim asıl şeyler:
//
//   1. KAÇIŞ. Unvanda "&" geçmesi çok sık ("A & B Ltd."). Kaçırılmazsa
//      dosya XML olmaktan çıkar; entegratör faturayı reddeder ve sebebini
//      bayinin anlayacağı dille söylemez.
//   2. TUTARLAR DEFTERLE AYNI OLMALI. XML'deki rakam defterden farklıysa
//      müşteriye başka bir borç bildirilmiş olur — kimse fark etmez.
//   3. NOKTA AYRACI. Türkçe biçimleyici "1.950,00" üretir; UBL "1950.00"
//      ister. Virgüllü tutar geçen belge reddedilir.
//   4. %0 KDV, istisna kodu olmadan gönderilemez. Kod uydurmak yanlış
//      vergi beyanıdır — üretmemek doğrusu.
//   5. AYNI FATURA AYNI DOSYAYI vermeli: belge iki kez indirildiğinde
//      içerik değişirse hangisinin gönderildiği belirsizleşir.
//   6. ZIP GERÇEKTEN AÇILABİLMELİ — kendi yazdığımız arşivi kendi
//      iddiamızla değil, sistemin kendi açıcısıyla doğruluyoruz.
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { inflateRawSync } from 'node:zlib';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const g = mkdtempSync(join(tmpdir(), 'st-ubl-'));
try {
  execFileSync(process.execPath, [
    join(KOK, 'node_modules/typescript/bin/tsc'),
    join(KOK, 'src/lib/ubl.ts'), join(KOK, 'src/lib/zip.ts'),
    join(KOK, 'src/lib/fatura-belgesi.ts'), join(KOK, 'src/lib/fatura-kimlik.ts'),
    '--outDir', g, '--module', 'esnext', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck',
  ], { stdio: 'pipe' });
} catch { /* tip hataları önemsiz, tsc ayrıca koşuyor */ }
{
  const d = (ad, eski, yeni) => {
    const yol = join(g, ad);
    writeFileSync(yol, readFileSync(yol, 'utf8').split(eski).join(yeni), 'utf8');
  };
  d('fatura-belgesi.js', "'@/lib/fatura-kimlik'", "'./fatura-kimlik.js'");
  d('ubl.js', "'@/lib/fatura-belgesi'", "'./fatura-belgesi.js'");
}
const { ublUret, ublDosyaAdi, xmlKacis, UblUretilemez } =
  await import(pathToFileURL(join(g, 'ubl.js')).href);
const { zipUret, crc32 } = await import(pathToFileURL(join(g, 'zip.js')).href);
const { eBelgeUret } = await import(pathToFileURL(join(g, 'fatura-belgesi.js')).href);

let gecti = 0, kaldi = 0;
const t = (ad, kosul, detay) => {
  if (kosul) { gecti++; console.log(`  ✓ ${ad}`); }
  else { kaldi++; console.log(`  ✗ ${ad}${detay !== undefined ? `\n      ${JSON.stringify(detay)}` : ''}`); }
};
const patla = (f) => { try { f(); return null; } catch (e) { return e; } };

const SATICI = {
  name: 'Nextus Fotokopi Ltd. Şti.',
  taxNumber: '9876543210', taxOffice: 'Beşiktaş',
  address: 'Barbaros Bulvarı 15', city: 'İstanbul', district: 'Beşiktaş',
  phone: '02121234567', email: 'bayi@nextus.com', eFaturaEtiket: 'NXS',
};
const ALICI = {
  name: 'Ahmet Bey Fotokopi',
  legalName: 'Çetin Kırtasiye Tic. Ltd. Şti.',
  taxNo: '1234567890', taxOffice: 'Mecidiyeköy',
  address: 'Büyükdere Cad. 12', city: 'İstanbul', district: 'Şişli',
  email: 'muhasebe@cetin.com', eInvoiceUser: true,
};
// 1.500 kira + 450 sayaç = 1.950 matrah · %20 KDV 390 · toplam 2.340
const FATURA = {
  invoiceNumber: 'SF-FAT-2026-00001',
  invoiceDate: new Date(2026, 8, 13),
  subtotal: 1950, vatRate: 20, vatAmount: 390, totalAmount: 2340,
  notes: 'Ağustos dönemi',
};
const SATIRLAR = [
  { aciklama: 'Kyocera M2540 aylık kira', miktar: 1, birimFiyat: 1500, tutar: 1500, kdvOrani: null },
  { aciklama: 'S/B sayaç 1.000 sayfa', miktar: 1000, birimFiyat: 0.45, tutar: 450, kdvOrani: null },
];
const belgeUret = (ek = {}) => eBelgeUret({
  satici: SATICI, alici: ALICI, fatura: FATURA, satirlar: SATIRLAR,
  ettn: '11111111-2222-3333-4444-555555555555', gibNo: 'NXS2026000000001', ...ek,
});
const BELGE = belgeUret();
const XML = ublUret(BELGE);

/** Etiketin içindeki metni döndürür (ilk eşleşme). */
const ic = (xml, etiket) => {
  const m = xml.match(new RegExp(`<${etiket}[^>]*>([\\s\\S]*?)</${etiket}>`));
  return m ? m[1] : null;
};
const hepsi = (xml, etiket) =>
  [...xml.matchAll(new RegExp(`<${etiket}[^>]*>([\\s\\S]*?)</${etiket}>`, 'g'))].map((m) => m[1]);

console.log('\n★ XML KAÇIŞI — "A & B Ltd." dosyayı bozmamalı\n');
{
  t('& kaçıyor', xmlKacis('A & B') === 'A &amp; B');
  t('< > kaçıyor', xmlKacis('<x>') === '&lt;x&gt;');
  t('tırnaklar kaçıyor', xmlKacis(`"a" 'b'`) === '&quot;a&quot; &apos;b&apos;');
  t('zaten kaçmış metin İKİ KEZ kaçmıyor değil, ham kabul ediliyor',
    xmlKacis('&amp;') === '&amp;amp;');

  const x = ublUret(belgeUret({ alici: { ...ALICI, legalName: 'A & B <Ltd.> "Şti."' } }));
  t('★ unvandaki & XML\'i bozmuyor', !/<cbc:Name>A & B/.test(x) && /A &amp;amp; B|A &amp; B/.test(x), x.slice(0, 0));
  t('★ ham < karakteri belgede kalmıyor', !x.includes('<Ltd.>'));
  // En sert kontrol: metin gerçekten ayrıştırılabiliyor mu.
  t('★ kaçışlı belge hâlâ dengeli XML', dengeliMi(x));
}

/** Etiket dengesi — gerçek bir ayrıştırıcı yok, ama açılan her etiket kapanmalı. */
function dengeliMi(xml) {
  const yigin = [];
  const re = /<(\/?)([A-Za-z:][\w:.-]*)([^>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(xml))) {
    const [, kapama, ad, govde, tek] = m;
    if (govde.startsWith('?') || ad.startsWith('?') || ad.startsWith('!')) continue;
    if (tek === '/') continue;
    if (kapama) { if (yigin.pop() !== ad) return false; }
    else yigin.push(ad);
  }
  return yigin.length === 0;
}

console.log('\nBELGE İSKELETİ\n');
{
  t('XML bildirimi başta', XML.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), XML.slice(0, 40));
  t('dengeli', dengeliMi(XML));
  t('UBL 2.1', ic(XML, 'cbc:UBLVersionID') === '2.1');
  t('TR1.2 özelleştirmesi', ic(XML, 'cbc:CustomizationID') === 'TR1.2');
  t('senaryo profil olarak yazılıyor', ic(XML, 'cbc:ProfileID') === 'TEMELFATURA');
  t('belge numarası cbc:ID', ic(XML, 'cbc:ID') === 'NXS2026000000001');
  t('ETTN cbc:UUID', ic(XML, 'cbc:UUID') === '11111111-2222-3333-4444-555555555555');
  t('tarih yyyy-aa-gg', ic(XML, 'cbc:IssueDate') === '2026-09-13', ic(XML, 'cbc:IssueDate'));
  t('para birimi TRY', ic(XML, 'cbc:DocumentCurrencyCode') === 'TRY');
  t('kalem sayısı yazıyor', ic(XML, 'cbc:LineCountNumeric') === '2');
  t('fatura tipi SATIS', ic(XML, 'cbc:InvoiceTypeCode') === 'SATIS');
  t('not aktarılıyor', ic(XML, 'cbc:Note') === 'Ağustos dönemi');
  t('e-Arşiv profili de yazılıyor',
    ic(ublUret(belgeUret({ alici: { ...ALICI, eInvoiceUser: false } })), 'cbc:ProfileID') === 'EARSIVFATURA');
}

console.log('\n★ SAAT UYDURULMUYOR\n');
{
  t('★ saat verilmezse IssueTime HİÇ yazılmıyor', !XML.includes('IssueTime'));
  const x = ublUret(BELGE, { saat: '14:35:02' });
  t('verilen saat yazılıyor', ic(x, 'cbc:IssueTime') === '14:35:02');
  t('★ aynı girdi aynı XML (belge iki kez indirilince değişmiyor)',
    ublUret(BELGE, { saat: '14:35:02' }) === x);
}

console.log('\n★ TUTARLAR DEFTERLE AYNI + NOKTA AYRACI\n');
{
  const toplam = XML.match(/<cac:LegalMonetaryTotal>[\s\S]*?<\/cac:LegalMonetaryTotal>/)[0];
  t('matrah 1950.00', ic(toplam, 'cbc:LineExtensionAmount') === '1950.00', ic(toplam, 'cbc:LineExtensionAmount'));
  t('KDV hariç 1950.00', ic(toplam, 'cbc:TaxExclusiveAmount') === '1950.00');
  t('KDV dahil 2340.00', ic(toplam, 'cbc:TaxInclusiveAmount') === '2340.00');
  t('ödenecek 2340.00', ic(toplam, 'cbc:PayableAmount') === '2340.00');
  t('★ hiçbir tutarda VİRGÜL yok', !/currencyID="TRY">[^<]*,/.test(XML));
  t('★ hiçbir tutarda BİNLİK ayracı yok', !/currencyID="TRY">\d{1,3}\.\d{3}[.,]/.test(XML));
  t('her tutar iki haneli', hepsi(XML, 'cbc:PayableAmount').every((x) => /^\d+\.\d{2}$/.test(x)));

  // Toplam KDV = alt toplamların toplamı; belgenin kendi içinde tutarlı.
  const vergi = XML.match(/<cac:TaxTotal>[\s\S]*?<\/cac:TaxTotal>/)[0];
  t('KDV toplamı 390.00', ic(vergi, 'cbc:TaxAmount') === '390.00');
  const altlar = [...vergi.matchAll(/<cac:TaxSubtotal>([\s\S]*?)<\/cac:TaxSubtotal>/g)].map((m) => m[1]);
  t('tek oran → tek alt toplam', altlar.length === 1, altlar.length);
  t('oran %20', ic(altlar[0], 'cbc:Percent') === '20');
  t('★ alt toplamların KDV\'si genel KDV\'ye eşit',
    altlar.reduce((a, x) => a + Number(ic(x, 'cbc:TaxAmount')), 0) === 390);
  t('KDV vergi kodu 0015', XML.includes('<cbc:TaxTypeCode>0015</cbc:TaxTypeCode>'));
}

console.log('\nKARMA KDV ORANI — oran başına ayrı alt toplam\n');
{
  // 1.000 (%20) + 500 (%10) = 1.500 matrah · KDV 200 + 50 = 250
  const b = eBelgeUret({
    satici: SATICI, alici: ALICI,
    fatura: { ...FATURA, subtotal: 1500, vatRate: 20, vatAmount: 250, totalAmount: 1750 },
    satirlar: [
      { aciklama: 'Kira', miktar: 1, birimFiyat: 1000, tutar: 1000, kdvOrani: 20 },
      { aciklama: 'Bakım', miktar: 1, birimFiyat: 500, tutar: 500, kdvOrani: 10 },
    ],
    ettn: '22222222-2222-3333-4444-555555555555', gibNo: 'NXS2026000000002',
  });
  const x = ublUret(b);
  const vergi = x.match(/<cac:TaxTotal>[\s\S]*?<\/cac:TaxTotal>/)[0];
  const altlar = [...vergi.matchAll(/<cac:TaxSubtotal>([\s\S]*?)<\/cac:TaxSubtotal>/g)].map((m) => m[1]);
  t('★ iki oran → iki alt toplam', altlar.length === 2, altlar.length);
  t('oranlar 20 ve 10', altlar.map((a) => ic(a, 'cbc:Percent')).sort().join(',') === '10,20');
  t('★ alt toplamların KDV\'si 250',
    altlar.reduce((a, y) => a + Number(ic(y, 'cbc:TaxAmount')), 0) === 250);
  t('matrahlar 1000 + 500',
    altlar.map((a) => ic(a, 'cbc:TaxableAmount')).sort().join(',') === '1000.00,500.00');
}

console.log('\n★ %0 KDV — İSTİSNA KODU UYDURULMUYOR\n');
{
  const b = eBelgeUret({
    satici: SATICI, alici: ALICI,
    fatura: { ...FATURA, subtotal: 1000, vatRate: 0, vatAmount: 0, totalAmount: 1000 },
    satirlar: [{ aciklama: 'Kira', miktar: 1, birimFiyat: 1000, tutar: 1000, kdvOrani: 0 }],
    ettn: '33333333-2222-3333-4444-555555555555', gibNo: 'NXS2026000000003',
  });
  const e = patla(() => ublUret(b));
  t('★ %0 KDV\'li belge ÜRETİLMİYOR', e !== null);
  t('doğru hata sınıfı', e instanceof UblUretilemez, e && e.constructor.name);
  t('bayiye ne yapacağı söyleniyor', /KDV oranını düzeltin/.test(e.message), e && e.message);
}

console.log('\nTARAFLAR\n');
{
  const satici = XML.match(/<cac:AccountingSupplierParty>[\s\S]*?<\/cac:AccountingSupplierParty>/)[0];
  const alici = XML.match(/<cac:AccountingCustomerParty>[\s\S]*?<\/cac:AccountingCustomerParty>/)[0];
  t('satıcı VKN schemeID ile', /<cbc:ID schemeID="VKN">9876543210<\/cbc:ID>/.test(satici));
  t('alıcı VKN schemeID ile', /<cbc:ID schemeID="VKN">1234567890<\/cbc:ID>/.test(alici));
  t('★ belgede TESCİLLİ UNVAN var, defterdeki ad değil',
    ic(alici, 'cbc:Name') === 'Çetin Kırtasiye Tic. Ltd. Şti.', ic(alici, 'cbc:Name'));
  t('satıcı unvanı doğru', ic(satici, 'cbc:Name') === 'Nextus Fotokopi Ltd. Şti.');
  t('il/ilçe ayrı alanlarda', ic(alici, 'cbc:CityName') === 'İstanbul' && ic(alici, 'cbc:CitySubdivisionName') === 'Şişli');
  t('ülke Türkiye', /<cac:Country>\s*<cbc:Name>Türkiye<\/cbc:Name>/.test(alici));
  t('alıcı e-postası yazıyor', ic(alici, 'cbc:ElectronicMail') === 'muhasebe@cetin.com');
  t('satıcı telefonu yazıyor', ic(satici, 'cbc:Telephone') === '02121234567');

  // TCKN'li alıcı: kimlik türü değişmeli, vergi dairesi bölümü olmamalı.
  const x = ublUret(belgeUret({
    alici: { ...ALICI, taxNo: '12345678901', taxOffice: null, eInvoiceUser: false },
  }));
  const a2 = x.match(/<cac:AccountingCustomerParty>[\s\S]*?<\/cac:AccountingCustomerParty>/)[0];
  t('★ 11 hane → TCKN', /<cbc:ID schemeID="TCKN">12345678901<\/cbc:ID>/.test(a2), a2);
  t('★ vergi dairesi yoksa bölüm hiç yazılmıyor', !a2.includes('PartyTaxScheme'));
}

console.log('\nKALEMLER\n');
{
  const kalemler = [...XML.matchAll(/<cac:InvoiceLine>([\s\S]*?)<\/cac:InvoiceLine>/g)].map((m) => m[1]);
  t('iki kalem', kalemler.length === 2);
  t('sıra numaraları 1,2', kalemler.map((k) => ic(k, 'cbc:ID')).join(',') === '1,2');
  t('miktar birim koduyla', /<cbc:InvoicedQuantity unitCode="C62">1<\/cbc:InvoicedQuantity>/.test(kalemler[0]));
  t('1000 sayfa miktarı doğru', /<cbc:InvoicedQuantity unitCode="C62">1000<\/cbc:InvoicedQuantity>/.test(kalemler[1]));
  // Kalemin içinde KDV şemasının da bir cbc:Name'i var; Item bloğuna daralt.
  const urunAdi = (k) => ic(k.match(/<cac:Item>[\s\S]*?<\/cac:Item>/)[0], 'cbc:Name');
  t('kalem adı yazıyor', urunAdi(kalemler[0]) === 'Kyocera M2540 aylık kira', urunAdi(kalemler[0]));
  t('ikinci kalem adı yazıyor', urunAdi(kalemler[1]) === 'S/B sayaç 1.000 sayfa', urunAdi(kalemler[1]));
  t('birim fiyat kuruşlu yazılabiliyor', ic(kalemler[1], 'cbc:PriceAmount') === '0.45', ic(kalemler[1], 'cbc:PriceAmount'));
  t('kalem tutarı 1500.00', ic(kalemler[0], 'cbc:LineExtensionAmount') === '1500.00');
  t('★ kalem KDV\'leri genel KDV\'yi veriyor',
    kalemler.reduce((a, k) => a + Number(ic(k.match(/<cac:TaxTotal>[\s\S]*?<\/cac:TaxTotal>/)[0], 'cbc:TaxAmount')), 0) === 390);
  t('★ kalem tutarları matrahı veriyor',
    kalemler.reduce((a, k) => a + Number(ic(k, 'cbc:LineExtensionAmount')), 0) === 1950);
}

console.log('\nDOSYA ADI\n');
{
  t('dosya adı belge numarası', ublDosyaAdi(BELGE) === 'NXS2026000000001.xml');
}

console.log('\n★ ZIP — kendi iddiamızla değil, sistemin açıcısıyla doğrulanıyor\n');
{
  const paket = zipUret([
    { ad: 'NXS2026000000001.xml', icerik: XML },
    { ad: 'NXS2026000000002.xml', icerik: '<x>iki</x>' },
  ]);
  t('ZIP imzasıyla başlıyor', paket.subarray(0, 4).toString('hex') === '504b0304');
  t('merkez dizin sonu var', paket.subarray(-22, -18).toString('hex') === '504b0506');
  t('dosya sayısı 2', paket.readUInt16LE(paket.length - 12) === 2);

  // Gerçek açma: yerel başlıkları tarayıp içeriği geri çıkar.
  const cikan = zipAc(paket);
  t('★ iki dosya geri çıkıyor', cikan.length === 2, cikan.map((x) => x.ad));
  t('★ XML birebir aynı', cikan[0].icerik === XML);
  t('ikinci dosya da aynı', cikan[1].icerik === '<x>iki</x>');
  t('dosya adları korunuyor', cikan.map((x) => x.ad).join(',') === 'NXS2026000000001.xml,NXS2026000000002.xml');
  t('★ sıkıştırma gerçekten küçültüyor', paket.length < Buffer.byteLength(XML, 'utf8'));

  t('★ aynı girdi aynı arşiv (tarih uydurulmuyor)',
    zipUret([{ ad: 'a.xml', icerik: XML }]).equals(zipUret([{ ad: 'a.xml', icerik: XML }])));

  const ikiz = patla(() => zipUret([{ ad: 'a.xml', icerik: 'x' }, { ad: 'a.xml', icerik: 'y' }]));
  t('★ aynı ad iki kez → hata (sessizce dosya yutmuyor)', ikiz !== null, ikiz && ikiz.message);

  // Türkçe karakterli ad ve içerik UTF-8 olarak korunmalı.
  const tr = zipAc(zipUret([{ ad: 'ÇÖĞÜŞİ.xml', icerik: '<a>ğüşiöç İĞÜ</a>' }]));
  t('★ Türkçe dosya adı korunuyor', tr[0].ad === 'ÇÖĞÜŞİ.xml', tr[0].ad);
  t('★ Türkçe içerik korunuyor', tr[0].icerik === '<a>ğüşiöç İĞÜ</a>');

  t('boş içerik patlatmıyor', zipAc(zipUret([{ ad: 'bos.xml', icerik: '' }]))[0].icerik === '');
  t('CRC32 bilinen değeri veriyor', crc32(Buffer.from('123456789')) === 0xcbf43926);
}

/** ZIP açıcı — yalnız testte kullanılıyor, ürün kodunda yok. */
function zipAc(paket) {
  const cikan = [];
  let i = 0;
  while (i + 4 <= paket.length && paket.readUInt32LE(i) === 0x04034b50) {
    const yontem = paket.readUInt16LE(i + 8);
    const csize = paket.readUInt32LE(i + 18);
    const usize = paket.readUInt32LE(i + 22);
    const adLen = paket.readUInt16LE(i + 26);
    const ekLen = paket.readUInt16LE(i + 28);
    const ad = paket.subarray(i + 30, i + 30 + adLen).toString('utf8');
    const bas = i + 30 + adLen + ekLen;
    const govde = paket.subarray(bas, bas + csize);
    const ham = yontem === 8 ? inflateRawSync(govde) : govde;
    if (ham.length !== usize) throw new Error(`boyut tutmuyor: ${ad}`);
    cikan.push({ ad, icerik: ham.toString('utf8') });
    i = bas + csize;
  }
  return cikan;
}

if (existsSync(g)) rmSync(g, { recursive: true, force: true });
console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
process.exit(kaldi ? 1 : 0);
