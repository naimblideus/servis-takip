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
  };
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
