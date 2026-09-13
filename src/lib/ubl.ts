import type { EBelge } from '@/lib/fatura-belgesi';

/**
 * UBL-TR 1.2 — e-Faturanın GİB'in kabul ettiği XML biçimi.
 *
 * ── NEDEN BU DOSYA VAR ───────────────────────────────────────────────────
 * Özel entegratör sözleşmesi TİCARİ bir karar ve bayi imzalamadan sistem
 * üzerinden fatura gönderemiyor. Ama UBL dosyasının KENDİSİ entegratöre
 * bağlı değil: hepsi aynı standardı okuyor. Bayi buradan indirdiği XML'i
 * kendi entegratörünün portalına yükleyip faturayı BUGÜN kesebiliyor.
 *
 * Yani bu dosya, "entegrasyon hazır olana kadar eski programda kalmak"
 * zorunluluğunu kaldırıyor. Entegrasyon geldiğinde de aynı XML gidiyor —
 * iki ayrı doğruluk kaynağı olmuyor.
 *
 * ── NE ÜRETMİYOR ─────────────────────────────────────────────────────────
 * Mali mühür/imza YOK: imzalama entegratörün ya da GİB portalının işi,
 * özel anahtar bu sisteme hiç girmiyor. e-Arşiv'in gönderim şekli gibi
 * entegratöre özel UBLExtensions alanları da yok — onları yükleme
 * sırasında entegratör ekliyor.
 */

const NS = [
  'xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"',
  'xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"',
  'xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"',
  'xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"',
].join('\n         ');

/**
 * XML kaçışı. Müşteri unvanında "&" geçmesi sık (ör. "A & B Ltd.") ve
 * kaçırılmazsa dosya XML olmaktan çıkıyor: entegratör tüm faturayı
 * reddediyor, sebebini de bayinin anlayacağı şekilde söylemiyor.
 */
export function xmlKacis(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** UBL tutarı: nokta ayraçlı, iki hane, binlik ayracı YOK. */
const tutar = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

/** Miktar dört haneye kadar; gereksiz ondalık hane yazmıyor. */
const miktar = (n: number) => String(Math.round(n * 10000) / 10000);

const P = (b: string) => (s: string) => b + s;

function tag(ad: string, deger: string | number, ozellik = ''): string {
  return `<${ad}${ozellik}>${xmlKacis(String(deger))}</${ad}>`;
}

const para = (ad: string, n: number) => `<${ad} currencyID="TRY">${tutar(n)}</${ad}>`;

/** KDV şeması — UBL-TR'de KDV'nin vergi kodu 0015. */
function vergiSemasi(girinti: string): string {
  const g = P(girinti);
  return [
    g('<cac:TaxCategory>'),
    g('  <cac:TaxScheme>'),
    g('    <cbc:Name>KDV</cbc:Name>'),
    g('    <cbc:TaxTypeCode>0015</cbc:TaxTypeCode>'),
    g('  </cac:TaxScheme>'),
    g('</cac:TaxCategory>'),
  ].join('\n');
}

type Taraf = {
  unvan: string; kimlikTuru: 'VKN' | 'TCKN'; kimlikNo: string;
  vergiDairesi: string; adres: string; il: string; ilce: string;
  telefon?: string; eposta?: string;
};

function taraf(t: Taraf, girinti: string): string {
  const g = P(girinti);
  const satir: string[] = [g('<cac:Party>')];
  satir.push(g('  <cac:PartyIdentification>'));
  satir.push(g(`    ${tag('cbc:ID', t.kimlikNo, ` schemeID="${t.kimlikTuru}"`)}`));
  satir.push(g('  </cac:PartyIdentification>'));
  satir.push(g('  <cac:PartyName>'));
  satir.push(g(`    ${tag('cbc:Name', t.unvan)}`));
  satir.push(g('  </cac:PartyName>'));
  satir.push(g('  <cac:PostalAddress>'));
  satir.push(g(`    ${tag('cbc:StreetName', t.adres)}`));
  satir.push(g(`    ${tag('cbc:CitySubdivisionName', t.ilce)}`));
  satir.push(g(`    ${tag('cbc:CityName', t.il)}`));
  satir.push(g('    <cac:Country>'));
  satir.push(g('      <cbc:Name>Türkiye</cbc:Name>'));
  satir.push(g('    </cac:Country>'));
  satir.push(g('  </cac:PostalAddress>'));
  // TCKN'li alıcının vergi dairesi olmaz; boşsa bölüm hiç yazılmıyor.
  if (t.vergiDairesi) {
    satir.push(g('  <cac:PartyTaxScheme>'));
    satir.push(g('    <cac:TaxScheme>'));
    satir.push(g(`      ${tag('cbc:Name', t.vergiDairesi)}`));
    satir.push(g('    </cac:TaxScheme>'));
    satir.push(g('  </cac:PartyTaxScheme>'));
  }
  if (t.telefon || t.eposta) {
    satir.push(g('  <cac:Contact>'));
    if (t.telefon) satir.push(g(`    ${tag('cbc:Telephone', t.telefon)}`));
    if (t.eposta) satir.push(g(`    ${tag('cbc:ElectronicMail', t.eposta)}`));
    satir.push(g('  </cac:Contact>'));
  }
  satir.push(g('</cac:Party>'));
  return satir.join('\n');
}

/**
 * %0 KDV'li kalem, istisna kodu olmadan GİB'e gönderilemez. İstisna kodunu
 * uydurmak yanlış vergi beyanı demek — bu yüzden üretmeyi reddediyoruz ve
 * sebebini bayinin düzeltebileceği şekilde söylüyoruz.
 */
export class UblUretilemez extends Error {}

export function ublUret(belge: EBelge, opts?: { saat?: string | null }): string {
  if (belge.kdvOzeti.some((k) => k.oran === 0)) {
    throw new UblUretilemez(
      'KDV oranı %0 olan kalem var. e-Belgede %0 KDV ancak bir istisna koduyla ' +
      'gönderilebilir; bu sistem istisna kodu tutmuyor. Faturanın KDV oranını düzeltin.',
    );
  }

  const s: string[] = [];
  s.push('<?xml version="1.0" encoding="UTF-8"?>');
  s.push(`<Invoice ${NS}>`);
  s.push('  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>');
  s.push('  <cbc:CustomizationID>TR1.2</cbc:CustomizationID>');
  s.push(`  ${tag('cbc:ProfileID', belge.senaryo)}`);
  s.push(`  ${tag('cbc:ID', belge.gibNo)}`);
  s.push('  <cbc:CopyIndicator>false</cbc:CopyIndicator>');
  s.push(`  ${tag('cbc:UUID', belge.ettn)}`);
  s.push(`  ${tag('cbc:IssueDate', belge.tarih)}`);
  // Saat yalnızca GERÇEKTEN biliniyorsa yazılıyor (gönderim anı). Uydurulmuş
  // bir saat, aynı belgeyi her indirişte farklı yapardı.
  if (opts?.saat) s.push(`  ${tag('cbc:IssueTime', opts.saat)}`);
  s.push(`  ${tag('cbc:InvoiceTypeCode', belge.faturaTipi)}`);
  if (belge.not) s.push(`  ${tag('cbc:Note', belge.not)}`);
  s.push('  <cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>');
  s.push(`  <cbc:LineCountNumeric>${belge.satirlar.length}</cbc:LineCountNumeric>`);

  s.push('  <cac:AccountingSupplierParty>');
  s.push(taraf({
    unvan: belge.satici.unvan, kimlikTuru: 'VKN', kimlikNo: belge.satici.vkn,
    vergiDairesi: belge.satici.vergiDairesi, adres: belge.satici.adres,
    il: belge.satici.il, ilce: belge.satici.ilce,
    telefon: belge.satici.telefon, eposta: belge.satici.eposta,
  }, '    '));
  s.push('  </cac:AccountingSupplierParty>');

  s.push('  <cac:AccountingCustomerParty>');
  s.push(taraf({
    unvan: belge.alici.unvan, kimlikTuru: belge.alici.kimlikTuru, kimlikNo: belge.alici.kimlikNo,
    vergiDairesi: belge.alici.vergiDairesi, adres: belge.alici.adres,
    il: belge.alici.il, ilce: belge.alici.ilce, eposta: belge.alici.eposta,
  }, '    '));
  s.push('  </cac:AccountingCustomerParty>');

  // ── VERGİ ── oran başına bir TaxSubtotal; toplam bunların toplamı.
  s.push('  <cac:TaxTotal>');
  s.push(`    ${para('cbc:TaxAmount', belge.toplamlar.kdv)}`);
  for (const k of belge.kdvOzeti) {
    s.push('    <cac:TaxSubtotal>');
    s.push(`      ${para('cbc:TaxableAmount', k.matrah)}`);
    s.push(`      ${para('cbc:TaxAmount', k.tutar)}`);
    s.push(`      <cbc:Percent>${k.oran}</cbc:Percent>`);
    s.push(vergiSemasi('      '));
    s.push('    </cac:TaxSubtotal>');
  }
  s.push('  </cac:TaxTotal>');

  s.push('  <cac:LegalMonetaryTotal>');
  s.push(`    ${para('cbc:LineExtensionAmount', belge.toplamlar.matrah)}`);
  s.push(`    ${para('cbc:TaxExclusiveAmount', belge.toplamlar.matrah)}`);
  s.push(`    ${para('cbc:TaxInclusiveAmount', belge.toplamlar.genelToplam)}`);
  s.push(`    ${para('cbc:AllowanceTotalAmount', 0)}`);
  s.push(`    ${para('cbc:PayableAmount', belge.toplamlar.genelToplam)}`);
  s.push('  </cac:LegalMonetaryTotal>');

  for (const r of belge.satirlar) {
    s.push('  <cac:InvoiceLine>');
    s.push(`    <cbc:ID>${r.sira}</cbc:ID>`);
    s.push(`    <cbc:InvoicedQuantity unitCode="${r.birim}">${miktar(r.miktar)}</cbc:InvoicedQuantity>`);
    s.push(`    ${para('cbc:LineExtensionAmount', r.tutar)}`);
    s.push('    <cac:TaxTotal>');
    s.push(`      ${para('cbc:TaxAmount', r.kdvTutari)}`);
    s.push('      <cac:TaxSubtotal>');
    s.push(`        ${para('cbc:TaxableAmount', r.tutar)}`);
    s.push(`        ${para('cbc:TaxAmount', r.kdvTutari)}`);
    s.push(`        <cbc:Percent>${r.kdvOrani}</cbc:Percent>`);
    s.push(vergiSemasi('        '));
    s.push('      </cac:TaxSubtotal>');
    s.push('    </cac:TaxTotal>');
    s.push('    <cac:Item>');
    s.push(`      ${tag('cbc:Name', r.aciklama)}`);
    s.push('    </cac:Item>');
    s.push('    <cac:Price>');
    s.push(`      ${para('cbc:PriceAmount', r.birimFiyat)}`);
    s.push('    </cac:Price>');
    s.push('  </cac:InvoiceLine>');
  }

  s.push('</Invoice>');
  return s.join('\n');
}

/** İndirilecek dosya adı — belge numarası dosya adının kendisi. */
export function ublDosyaAdi(belge: EBelge): string {
  return `${belge.gibNo}.xml`;
}
