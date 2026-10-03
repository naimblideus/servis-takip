/**
 * TONER KARNESİ — ölçülen verim ne söylüyor?
 *
 * ── EKRAN NEDEN DEĞİŞTİ ──────────────────────────────────────────────────
 * "Toner Verimi" ekranı bir VERİ GİRİŞ formuydu: modelin kutusunda yazan
 * sayfa sayısını yaz, sistem tahmin üretsin. Ölçüm motoru geldikten sonra o
 * iş bitti — sistem verimi sahadan kendi öğreniyor ve demo bayide 41 cihazın
 * 41'inde verim biliniyor, eksik sıfır. Geriye boş bir form kaldı.
 *
 * Asıl değerli soru "verim gir" değil: ÖLÇTÜĞÜMÜZ VERİM BANA NE SÖYLÜYOR.
 * İki şey söylüyor ve ikisi de doğrudan para:
 *
 *   1. SAYFA BAŞI TONER MALİYETİ. Kartuş fiyatı ÷ gerçek verim. Sözleşme
 *      fiyatı bunun üstüne kurulur; yanlış bilinirse bayi zarar eden bir
 *      sözleşmeyi kârlı sanır.
 *
 *   2. KUTUNUN YALANI. Kutuda "6.000 sayfa" yazar, sizin müşterinizin
 *      kullanımında 4.200 çıkar. Aradaki %30, sayfa maliyetinin %43
 *      yüksek olması demektir — ve bu fark hiçbir yerde görünmez, çünkü
 *      kimse ikisini yan yana koymaz.
 *
 * ── ÖLÇÜLMEMİŞE HÜKÜM VERİLMİYOR ─────────────────────────────────────────
 * Gözlem yoksa sapma da maliyet de null döner. Tek gözlemden "bu model kötü"
 * demek, bir kartuşun tek seferlik davranışını modelin karakteri sanmaktır.
 */

/** Sapma hesabı için en az kaç ölçüm gerekli. */
export const EN_AZ_GOZLEM_KARNE = 2;

export type KarneUyari = 'GOZLEM_AZ' | 'KUTU_DEGERI_YOK' | 'FIYAT_YOK';

/**
 * Ölçülen verim, kutuda yazana göre yüzde kaç sapıyor?
 * Eksi = kutudan AZ basıyor (maliyet yükseliyor). Artı = fazla basıyor.
 */
export function sapmaYuzde(kutu: number | null | undefined, olculen: number | null | undefined): number | null {
  if (!kutu || !olculen || kutu <= 0 || olculen <= 0) return null;
  return Math.round(((olculen - kutu) / kutu) * 1000) / 10;
}

/**
 * Sapmanın MALİYETE etkisi. Verim %30 düşerse maliyet %30 artmaz — %43 artar,
 * çünkü maliyet verimle TERS orantılı. Bu fark küçük görünür ama sözleşme
 * fiyatı buradan çıktığı için bileşik olarak büyür.
 */
export function maliyetEtkisiYuzde(kutu: number | null | undefined, olculen: number | null | undefined): number | null {
  if (!kutu || !olculen || kutu <= 0 || olculen <= 0) return null;
  return Math.round((kutu / olculen - 1) * 1000) / 10;
}

/** Sayfa başı maliyet: kartuş fiyatı ÷ verim. Biri yoksa hüküm yok. */
export function sayfaBasiMaliyet(fiyat: number | null | undefined, verim: number | null | undefined): number | null {
  if (!fiyat || !verim || fiyat <= 0 || verim <= 0) return null;
  return Math.round((fiyat / verim) * 10000) / 10000;
}

export interface KarneGirdi {
  anahtar: string;
  marka: string;
  model: string;
  cihaz: number;
  /** Elle girilen (kutu) değerler. */
  kutuSb: number | null;
  kutuRenkli: number | null;
  /** Sahada ölçülen değerler. */
  olculenSb: number | null;
  olculenRenkli: number | null;
  gozlemSb: number;
  gozlemRenkli: number;
  /** Ölçülmüş sayfa maliyeti (TL/sayfa) — teklif motorundan. */
  maliyetSb: number | null;
  maliyetRenkli: number | null;
}

/**
 * Özetin YAPISAL hâli. Cümlenin kendisi (`ozet`) Türkçe kuruluyor; ekran
 * kullanıcının dilinde yazabilsin diye hüküm ayrıca kod olarak dönüyor.
 * Metin üretmek sunucunun işi değil — sunucu neyi ölçtüğünü söylüyor.
 */
export type KarneOzetTuru = 'OLCUM_YOK' | 'DUZ' | 'KUTUDAN_AZ' | 'KUTUDAN_FAZLA' | 'UYUMLU';

export interface KarneOzet {
  tur: KarneOzetTuru;
  /** Sahada ölçülen verim (sayfa). OLCUM_YOK dışında dolu. */
  verim: number | null;
  /** Kutudan sapmanın büyüklüğü, yüzde. Yalnız AZ/FAZLA'da dolu. */
  sapma: number | null;
}

export interface KarneSatiri extends KarneGirdi {
  /** Ölçülen verim kutudan yüzde kaç sapıyor (S/B). */
  sapmaSb: number | null;
  sapmaRenkli: number | null;
  /** Sapmanın sayfa maliyetine etkisi (S/B). */
  maliyetEtkisiSb: number | null;
  maliyetEtkisiRenkli: number | null;
  /** Bu modelde herhangi bir ölçüm var mı. */
  olculdu: boolean;
  uyarilar: KarneUyari[];
  /** Tek cümlelik hüküm — ekranda bunu okuyup geçebilsin. */
  ozet: string;
  /** Aynı hükmün dil bağımsız hâli. */
  ozetKod: KarneOzet;
}

export const UYARI_METNI: Record<KarneUyari, string> = {
  GOZLEM_AZ: 'Ölçüm sayısı az — sonuç tek bir kartuşun davranışı olabilir.',
  KUTU_DEGERI_YOK: 'Kutu değeri girilmemiş; gerçek verimle karşılaştırılamıyor.',
  FIYAT_YOK: 'Kartuşun alış fiyatı yok — sayfa maliyeti hesaplanamıyor.',
};

export function karneSatiri(g: KarneGirdi): KarneSatiri {
  const sapmaSb = sapmaYuzde(g.kutuSb, g.olculenSb);
  const sapmaRenkli = sapmaYuzde(g.kutuRenkli, g.olculenRenkli);
  const olculdu = Boolean(g.olculenSb || g.olculenRenkli);

  const uyarilar: KarneUyari[] = [];
  const gozlem = (g.gozlemSb || 0) + (g.gozlemRenkli || 0);
  if (olculdu && gozlem > 0 && gozlem < EN_AZ_GOZLEM_KARNE) uyarilar.push('GOZLEM_AZ');
  if (olculdu && !g.kutuSb && !g.kutuRenkli) uyarilar.push('KUTU_DEGERI_YOK');
  if (olculdu && g.maliyetSb === null && g.maliyetRenkli === null) uyarilar.push('FIYAT_YOK');

  return {
    ...g,
    sapmaSb,
    sapmaRenkli,
    maliyetEtkisiSb: maliyetEtkisiYuzde(g.kutuSb, g.olculenSb),
    maliyetEtkisiRenkli: maliyetEtkisiYuzde(g.kutuRenkli, g.olculenRenkli),
    olculdu,
    uyarilar,
    ozet: ozetCumlesi(g, sapmaSb ?? sapmaRenkli, olculdu),
    ozetKod: ozetKodu(g, sapmaSb ?? sapmaRenkli, olculdu),
  };
}

function ozetKodu(g: KarneGirdi, sapma: number | null, olculdu: boolean): KarneOzet {
  if (!olculdu) return { tur: 'OLCUM_YOK', verim: null, sapma: null };
  const verim = g.olculenSb ?? g.olculenRenkli!;
  if (sapma === null) return { tur: 'DUZ', verim, sapma: null };
  if (sapma <= -10) return { tur: 'KUTUDAN_AZ', verim, sapma: Math.abs(sapma) };
  if (sapma >= 10) return { tur: 'KUTUDAN_FAZLA', verim, sapma };
  return { tur: 'UYUMLU', verim, sapma: null };
}

function ozetCumlesi(g: KarneGirdi, sapma: number | null, olculdu: boolean): string {
  if (!olculdu) return 'Henüz ölçüm yok — bu modelde toner değişimi kaydedildikçe verim kendiliğinden öğrenilir.';
  const verim = g.olculenSb ?? g.olculenRenkli!;
  const bas = `Sahada ölçülen verim ${verim.toLocaleString('tr-TR')} sayfa`;
  if (sapma === null) return `${bas}.`;
  if (sapma <= -10) return `${bas} — kutuda yazandan %${Math.abs(sapma).toFixed(0)} AZ.`;
  if (sapma >= 10) return `${bas} — kutuda yazandan %${sapma.toFixed(0)} fazla.`;
  return `${bas} — kutuda yazanla uyumlu.`;
}

/**
 * Sıralama ETKİYE göre: çok cihazlı model önce gelir. Bayi listeyi yukarıdan
 * okur ve nerede durursa dursun en çok makineyi kapsamış olur. Alfabetik
 * sıralama, 25 cihazlı modeli 1 cihazlının altına düşürebilirdi.
 */
export function karneSirasi(a: KarneSatiri, b: KarneSatiri): number {
  if (a.olculdu !== b.olculdu) return a.olculdu ? -1 : 1;
  if (b.cihaz !== a.cihaz) return b.cihaz - a.cihaz;
  return a.anahtar.localeCompare(b.anahtar, 'tr');
}

export interface KarneOzeti {
  model: number;
  olculenModel: number;
  cihaz: number;
  /** Ölçümü olan modellerdeki cihaz sayısı. */
  kapsananCihaz: number;
  /** Kutudan belirgin AZ basan model sayısı (≤ %-10). */
  kutudanAz: number;
  /** En pahalı sayfa maliyeti olan ölçülmüş model. */
  enPahali: { marka: string; model: string; maliyet: number } | null;
}

export function karneOzeti(satirlar: KarneSatiri[]): KarneOzeti {
  const olculenler = satirlar.filter((s) => s.olculdu);
  let enPahali: KarneOzeti['enPahali'] = null;
  for (const s of olculenler) {
    const m = s.maliyetSb ?? s.maliyetRenkli;
    if (m === null || m === undefined) continue;
    if (!enPahali || m > enPahali.maliyet) enPahali = { marka: s.marka, model: s.model, maliyet: m };
  }
  return {
    model: satirlar.length,
    olculenModel: olculenler.length,
    cihaz: satirlar.reduce((a, s) => a + s.cihaz, 0),
    kapsananCihaz: olculenler.reduce((a, s) => a + s.cihaz, 0),
    kutudanAz: satirlar.filter((s) => (s.sapmaSb ?? 101) <= -10 || (s.sapmaRenkli ?? 101) <= -10).length,
    enPahali,
  };
}

// ── TONER ÜRÜNÜ: AYNI MAKİNEDE HANGİ TONER DAHA UCUZA GELİYOR ────────────
//
// Model karnesi bir modele takılan BÜTÜN tonerleri tek ortalamada
// birleştiriyor. Oysa bayinin asıl sorusu "bu makineye hangi toneri
// takayım": ucuz muadil 2.900 sayfa, pahalı olan 4.200 sayfa basıyorsa ucuz
// olan pahalıya gelir. Bu bölüm her modeli takılan toner ürününe göre ayırır.
//
// ⚠ ÖLÇÜLEN VERİMİN SAHİBİ: değişim kaydının `observedYield`'i, BİR ÖNCEKİ
// değişimden bu yana basılan sayfadır — yani bir önceki değişimde TAKILAN
// kartuşun verimi. Kaydın kendi `partId`'si ise YENİ takılanı söyler. Verim
// kaydın kendi parçasına yazılsaydı her tonere bir öncekinin verimi yazılır
// ve karşılaştırma tam ters sonuç verirdi.

export interface DegisimKaydi {
  deviceId: string;
  channel: string;
  changedAt: Date | string;
  partId: string | null;
  observedYield: number | null;
  /** Cihazın model anahtarı (toner-verimi modelAnahtari). */
  model: string;
}

const zaman = (d: Date | string) => new Date(d).getTime();

/** Gözlemler: `model|kanal|partId` → o tonerin ölçülen verimleri. */
export function urunGozlemleri(kayitlar: readonly DegisimKaydi[]): Map<string, number[]> {
  const cihazKanal = new Map<string, DegisimKaydi[]>();
  for (const k of kayitlar) {
    const a = `${k.deviceId}|${k.channel}`;
    (cihazKanal.get(a) ?? cihazKanal.set(a, []).get(a)!).push(k);
  }
  const sonuc = new Map<string, number[]>();
  for (const dizi of cihazKanal.values()) {
    dizi.sort((x, y) => zaman(x.changedAt) - zaman(y.changedAt));
    for (let i = 1; i < dizi.length; i++) {
      const verim = dizi[i].observedYield;
      const takilan = dizi[i - 1].partId;
      if (!verim || verim <= 0 || !takilan) continue;
      const a = `${dizi[i - 1].model}|${dizi[i - 1].channel}|${takilan}`;
      (sonuc.get(a) ?? sonuc.set(a, []).get(a)!).push(verim);
    }
  }
  return sonuc;
}

function ortanca(d: readonly number[]): number | null {
  if (!d.length) return null;
  const s = [...d].sort((a, b) => a - b);
  const o = Math.floor(s.length / 2);
  return s.length % 2 ? s[o] : Math.round((s[o - 1] + s[o]) / 2);
}

export interface UrunParcasi { ad: string; kod: string | null; fiyat: number | null }

/** `model|kanal|partId` anahtarını çözer. Model anahtarı "MARKA|MODEL" — ayraç içerir, SAĞDAN çözülür. */
export function urunAnahtari(anahtar: string): { model: string; kanal: string; partId: string } {
  const i2 = anahtar.lastIndexOf('|');
  const i1 = anahtar.lastIndexOf('|', i2 - 1);
  return { model: anahtar.slice(0, i1), kanal: anahtar.slice(i1 + 1, i2), partId: anahtar.slice(i2 + 1) };
}

/**
 * Model+kanal başına GERÇEK sayfa maliyeti: toplam toner harcaması ÷
 * toplam basılan sayfa — yalnız hangi tonerin bastığı bilinen ve fiyatı
 * olan ölçümlerden. Eski hesap (takılan tonerlerin ORTANCA fiyatı ÷ modelin
 * karışık verimi) ucuz muadil ile uzun ömürlü orijinal karışınca maliyeti
 * ikisinden de düşük gösterebiliyordu: ölçüldü, 7,20 ve 14,67 kr'lik iki
 * tonerin modeli 5,14 kr görünüyordu. Anahtar: `model|kanal`.
 */
export function harmanMaliyet(
  gozlemler: Map<string, number[]>,
  fiyatlar: Map<string, number | null>,
): Map<string, { maliyet: number; gozlem: number }> {
  const top = new Map<string, { fiyat: number; sayfa: number; gozlem: number }>();
  for (const [anahtar, verimler] of gozlemler) {
    const { model, kanal, partId } = urunAnahtari(anahtar);
    const f = fiyatlar.get(partId);
    if (!f || f <= 0) continue;
    const a = `${model}|${kanal}`;
    const t = top.get(a) ?? { fiyat: 0, sayfa: 0, gozlem: 0 };
    for (const v of verimler) if (v > 0) { t.fiyat += f; t.sayfa += v; t.gozlem++; }
    top.set(a, t);
  }
  const sonuc = new Map<string, { maliyet: number; gozlem: number }>();
  for (const [a, t] of top) if (t.sayfa > 0) sonuc.set(a, { maliyet: t.fiyat / t.sayfa, gozlem: t.gozlem });
  return sonuc;
}

export interface UrunSatiri {
  partId: string;
  ad: string;
  kod: string | null;
  kanal: string;
  gozlem: number;
  /** Ölçülen verim (ortanca, sayfa). */
  verim: number | null;
  /** Alış fiyatı (ortalama maliyet, yoksa son alış). */
  fiyat: number | null;
  /** Sayfa başı toner maliyeti. */
  sayfaBasi: number | null;
  /** Karşılaştırılabilir ürünler içinde en ucuzu. */
  enUcuz: boolean;
  /** En ucuzsa: en çok kullanılan diğer tonere göre yüzde kaç ucuz. */
  ucuzluk: number | null;
}

/**
 * Model başına toner ürünü satırları. Karşılaştırma yalnız EN AZ iki ölçümü
 * olan ve fiyatı bilinen ürünler arasında yapılır; tek kartuşun davranışı
 * "bu toner ucuz" hükmüne yetmez.
 */
export function urunSatirlari(
  gozlemler: Map<string, number[]>,
  parcalar: Map<string, UrunParcasi>,
): Map<string, UrunSatiri[]> {
  const modeller = new Map<string, UrunSatiri[]>();
  for (const [anahtar, verimler] of gozlemler) {
    const { model, kanal, partId } = urunAnahtari(anahtar);
    const p = parcalar.get(partId);
    if (!p) continue;
    const verim = ortanca(verimler);
    const satir: UrunSatiri = {
      partId, ad: p.ad, kod: p.kod, kanal, gozlem: verimler.length, verim,
      fiyat: p.fiyat, sayfaBasi: sayfaBasiMaliyet(p.fiyat, verim), enUcuz: false, ucuzluk: null,
    };
    (modeller.get(model) ?? modeller.set(model, []).get(model)!).push(satir);
  }
  for (const satirlar of modeller.values()) {
    for (const kanal of new Set(satirlar.map((s) => s.kanal))) {
      const kiyas = satirlar.filter((s) => s.kanal === kanal && s.sayfaBasi !== null && s.gozlem >= EN_AZ_GOZLEM_KARNE);
      if (kiyas.length < 2) continue;
      const enUcuz = kiyas.reduce((a, b) => (b.sayfaBasi! < a.sayfaBasi! ? b : a));
      // Kıyas, bayinin en çok kullandığı DİĞER tonerle: "şu an taktığınızdan yüzde kaç ucuz".
      const digeri = kiyas.filter((s) => s !== enUcuz).reduce((a, b) => (b.gozlem > a.gozlem ? b : a));
      enUcuz.enUcuz = true;
      enUcuz.ucuzluk = digeri.sayfaBasi! > 0
        ? Math.round((1 - enUcuz.sayfaBasi! / digeri.sayfaBasi!) * 1000) / 10
        : null;
    }
    satirlar.sort((a, b) => (a.kanal === b.kanal ? 0 : a.kanal === 'BLACK' ? -1 : 1)
      || (a.sayfaBasi ?? Infinity) - (b.sayfaBasi ?? Infinity) || b.gozlem - a.gozlem);
  }
  return modeller;
}

