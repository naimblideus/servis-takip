/**
 * FİLO OPTİMİZASYONU — SAF HESAP.
 *
 * ── NEDEN ────────────────────────────────────────────────────────────────
 * Kârlılık ekranı "bu cihaz bana ne kazandırıyor", yenileme ekranı "bu
 * cihaz eskidi mi" sorusunu cevaplıyor. Cevabı olmayan üçüncü soru şuydu:
 * DOĞRU MAKİNE DOĞRU YERDE Mİ.
 *
 * Bu sorunun iki sahibi var ve ikisi de aynı listeye bakar:
 *   · BAYİ — boşta duran makine, sözleşme yenilenmesinde ilk iptal edilen
 *     kalemdir. Müşteri bunu bayiden önce fark ederse konuşma "iptal"
 *     diye başlar; bayi önce fark ederse "şunu küçültelim" diye başlar.
 *   · MÜŞTERİ — her ay ödediği aşım bedelinin nereden geldiği.
 *
 * ── PARAYI YALNIZ GERÇEKTEN FATURALANAN YERDE SÖYLÜYORUZ ─────────────────
 * Kullanılmayan DAHİL sayfa "boşa giden para" diye YAZILMAZ. Kira makinenin
 * kendisinin de bedelidir; dahil paketin kullanılmayan kısmını paraya
 * çevirmek, uydurulmuş bir dağıtım olurdu. O yüzden az kullanımda SAYFA
 * söylenir, tutar söylenmez.
 *
 * AŞIM başkadır: aşan sayfa gerçekten faturalanır. Orada tutar söylenir —
 * ve yalnız birim fiyat biliniyorsa.
 *
 * ── HÜKÜM VERMEDİĞİMİZ YERLER ────────────────────────────────────────────
 *  · Okuması olmayan cihaz "hiç basmıyor" SAYILMAZ. İkisini karıştırmak,
 *    sayacı okunmayan makineyi "boşta" diye müşterinin önüne koymaktır.
 *  · Satılmış (kiralık olmayan) cihazın kira hikâyesi yoktur; kapsam dışı.
 *  · Dahil paketi tanımlanmamış cihazda "az kullanım" ölçülemez: sayfa
 *    başı sözleşmede kullanılmayan paket diye bir şey yoktur.
 *  · Cihazın üretici baskı kapasitesi (duty cycle) sistemde YOK ve
 *    uydurulmuyor; "aşırı kullanım" hükmü sözleşmedeki DAHİL pakete göre
 *    verilir, hayalî bir kapasiteye göre değil.
 */

/** Aylık bu sayfanın altı "fiilen basmıyor" sayılır. */
export const HIC_BASMIYOR_SAYFA = 50;
/** Dahil paketin bu oranın altında kullanılması "az kullanım"dır. */
export const AZ_KULLANIM_ORANI = 0.5;
/** Renkli payı bu oranın altındaysa renkli makine gereksiz olabilir. */
export const RENKLI_ESIK = 0.02;

export type FiloDurum = 'HIC_BASMIYOR' | 'AZ_KULLANIM' | 'ASIM' | 'DENGELI' | 'BILINMIYOR';
export type FiloSebep = 'KIRALIK_DEGIL' | 'OKUMA_YOK' | 'DAHIL_SAYFA_YOK' | 'KIRA_YOK';

export interface FiloGirdi {
  kiralik: boolean;
  /** Aylık kira. 0 ise boşta durma hükmü verilmez — bedeli yok. */
  aylikKira: number;
  /** Kiraya dahil aylık sayfa. 0 = paket tanımsız (sayfa başı sözleşme). */
  dahilSiyah: number;
  dahilRenkli: number;
  /** Penceredeki AYLIK ORTALAMA sayfa. null = dönemde hiç okuma yok. */
  aylikSiyah: number | null;
  aylikRenkli: number | null;
  /** Cihaz renkli basabiliyor mu (kümülatif renkli sayacı > 0). */
  renkliCihaz: boolean;
  /** Aşım birim fiyatları; bilinmiyorsa null — tutar üretilmez. */
  asimFiyatSiyah: number | null;
  asimFiyatRenkli: number | null;
}

export interface FiloSonuc {
  durum: FiloDurum;
  sebep: FiloSebep | null;
  /** Kullanılan / dahil (toplam sayfa üzerinden). Paket yoksa null. */
  kullanimOrani: number | null;
  /** Dahil olup kullanılmayan aylık sayfa. Paraya ÇEVRİLMEZ. */
  kullanilmayanSayfa: number | null;
  /** Aylık aşan sayfa (paket varsa). */
  asimSiyah: number;
  asimRenkli: number;
  /** Aylık aşım bedeli — yalnız birim fiyat biliniyorsa. */
  asimTutar: number | null;
  /** Renkli makine ama renkli neredeyse hiç basılmıyor. */
  renkliGereksiz: boolean;
}

const BOS: FiloSonuc = {
  durum: 'BILINMIYOR', sebep: null,
  kullanimOrani: null, kullanilmayanSayfa: null,
  asimSiyah: 0, asimRenkli: 0, asimTutar: null, renkliGereksiz: false,
};

export function filoDurumu(g: FiloGirdi): FiloSonuc {
  if (!g.kiralik) return { ...BOS, sebep: 'KIRALIK_DEGIL' };
  if (g.aylikSiyah === null && g.aylikRenkli === null) return { ...BOS, sebep: 'OKUMA_YOK' };

  const siyah = g.aylikSiyah ?? 0;
  const renkli = g.aylikRenkli ?? 0;
  const toplam = siyah + renkli;

  // Renkli basabilen makinede renkli neredeyse hiç kullanılmıyorsa
  // siyah-beyaz bir makine işi görür: hem kirası hem servisi ucuzdur.
  const renkliGereksiz = g.renkliCihaz && toplam > 0 && renkli / toplam < RENKLI_ESIK;

  // BOŞTA DURAN MAKİNE: paket olsun olmasın geçerli, ama kirası varsa
  // anlamlı — bedeli olmayan makinenin boşta durması kimseye bir şey
  // kaybettirmiyor.
  if (toplam < HIC_BASMIYOR_SAYFA) {
    if (!(g.aylikKira > 0)) return { ...BOS, sebep: 'KIRA_YOK', renkliGereksiz };
    return {
      ...BOS, durum: 'HIC_BASMIYOR', renkliGereksiz,
      kullanilmayanSayfa: g.dahilSiyah + g.dahilRenkli > 0 ? (g.dahilSiyah + g.dahilRenkli) - toplam : null,
      kullanimOrani: g.dahilSiyah + g.dahilRenkli > 0 ? toplam / (g.dahilSiyah + g.dahilRenkli) : null,
    };
  }

  const dahil = g.dahilSiyah + g.dahilRenkli;
  // Paket tanımsızsa "kullanılmayan paket" diye bir şey yok: sayfa başı
  // sözleşmede müşteri yalnız bastığını öder.
  if (dahil <= 0) return { ...BOS, sebep: 'DAHIL_SAYFA_YOK', renkliGereksiz };

  const oran = toplam / dahil;

  // AŞIM: siyah ve renkli AYRI hesaplanır — paketler ayrıdır ve birinin
  // artanı diğerinin aşımını kapatmaz (fatura da böyle keser).
  const asimSiyah = Math.max(0, siyah - g.dahilSiyah);
  const asimRenkli = Math.max(0, renkli - g.dahilRenkli);
  const fiyatVar =
    (asimSiyah === 0 || g.asimFiyatSiyah !== null) &&
    (asimRenkli === 0 || g.asimFiyatRenkli !== null);
  const asimTutar = fiyatVar
    ? Math.round((asimSiyah * (g.asimFiyatSiyah ?? 0) + asimRenkli * (g.asimFiyatRenkli ?? 0)) * 100) / 100
    : null;

  if (asimSiyah > 0 || asimRenkli > 0) {
    return {
      durum: 'ASIM', sebep: null,
      kullanimOrani: oran,
      kullanilmayanSayfa: null,
      asimSiyah, asimRenkli, asimTutar, renkliGereksiz,
    };
  }

  if (oran < AZ_KULLANIM_ORANI) {
    return {
      durum: 'AZ_KULLANIM', sebep: null,
      kullanimOrani: oran,
      kullanilmayanSayfa: Math.max(0, dahil - toplam),
      asimSiyah: 0, asimRenkli: 0, asimTutar: null, renkliGereksiz,
    };
  }

  return {
    durum: 'DENGELI', sebep: null,
    kullanimOrani: oran,
    kullanilmayanSayfa: Math.max(0, dahil - toplam),
    asimSiyah: 0, asimRenkli: 0, asimTutar: null, renkliGereksiz,
  };
}

/**
 * Sıralama: en pahalı yanlış üstte.
 *
 * Boşta duran makine ilk sırada — sözleşme yenilemesinde ilk iptal edilen
 * kalem odur ve müşteri onu bayiden önce fark ederse konuşma "iptal" diye
 * başlar. Sonra aşım (her ay gerçekten faturalanan para), sonra az
 * kullanım. Hükümsüzler en altta ama listeden DÜŞMEZ.
 */
export function filoSira(s: FiloSonuc): number {
  switch (s.durum) {
    case 'HIC_BASMIYOR': return 0;
    case 'ASIM': return 1;
    case 'AZ_KULLANIM': return 2;
    case 'DENGELI': return 3;
    default: return 4;
  }
}

export interface FiloOzeti {
  toplam: number;
  bostaDuran: number;
  asimli: number;
  azKullanim: number;
  dengeli: number;
  bilinmeyen: number;
  /** Okuması olmadığı için hüküm verilemeyen cihaz. */
  okumasiz: number;
  /** Aylık toplam aşım bedeli — yalnız fiyatı bilinen cihazlardan. */
  aylikAsimTutari: number;
  /** Tutarı hesaplanamayan aşımlı cihaz sayısı — ekran bunu yazar. */
  fiyatsizAsim: number;
  /** Renkli makinede renkli kullanılmayan cihaz sayısı. */
  renkliGereksiz: number;
}

export function filoOzeti(liste: FiloSonuc[]): FiloOzeti {
  const say = (d: FiloDurum) => liste.filter((s) => s.durum === d).length;
  return {
    toplam: liste.length,
    bostaDuran: say('HIC_BASMIYOR'),
    asimli: say('ASIM'),
    azKullanim: say('AZ_KULLANIM'),
    dengeli: say('DENGELI'),
    bilinmeyen: say('BILINMIYOR'),
    okumasiz: liste.filter((s) => s.sebep === 'OKUMA_YOK').length,
    aylikAsimTutari: Math.round(liste.reduce((a, s) => a + (s.asimTutar ?? 0), 0) * 100) / 100,
    fiyatsizAsim: liste.filter((s) => s.durum === 'ASIM' && s.asimTutar === null).length,
    renkliGereksiz: liste.filter((s) => s.renkliGereksiz).length,
  };
}
