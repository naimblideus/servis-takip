/**
 * SAYAÇ KANALI SAĞLIĞI — "köprü durdu mu?"
 *
 * ── NEDEN VAR ────────────────────────────────────────────────────────────
 * Cihaz cihaz "sayacı gelmiyor" uyarısı var. Ama o uyarı YANLIŞ SEBEBİ
 * gösterebiliyor: kanalın kendisi durduysa (Gmail köprüsü çalışmıyor, kota
 * doldu, yetki düştü, e-posta kuralı değişti) bütün cihazların sayacı
 * kesilir. Bayi ekranda 40 ayrı "cihaz" sorunu görür, 40 müşteriyi boşuna
 * arar; oysa tek bir sorun vardır ve müşteride değil bizdedir.
 *
 * Kanal durduğunda geçen her hafta faturalanamayan bir aydır. Sessizce
 * ilerler: hiçbir hata mesajı gelmez, çünkü GELMEYEN bir şeyin hatası olmaz.
 *
 * ── EŞİK NEDEN BAYİNİN KENDİ RİTMİNDEN ÇIKIYOR ───────────────────────────
 * Sabit bir gün sayısı iki yönde de yanlış olurdu. 400 cihazlı bir bayide
 * e-posta neredeyse her gün gelir; 3 cihazlı bayide ayda bir gelir. Sabit
 * 10 gün, birincide geç kalır, ikincisinde her ay yanlış alarm verir.
 * Ölçüt bayinin KENDİ tipik aralığı: kanal kendi ritminin çok dışına
 * çıktıysa durmuştur.
 *
 * Saf fonksiyon: veritabanı yok, testte gerçek veri olmadan sürülebilir.
 */

export type KanalDurumu =
  | 'KURULMAMIS'      // hiç e-posta gelmemiş — kanal kurulmamış, uyarı verilmez
  | 'YETERSIZ_VERI'   // yeni kurulmuş, ritim henüz bilinmiyor
  | 'CALISIYOR'
  | 'DURDU';

export interface KanalSonucu {
  durum: KanalDurumu;
  /** Son e-postadan bu yana geçen gün (hiç yoksa null). */
  gecenGun: number | null;
  /** Bayinin tipik e-posta aralığı — gün (bilinmiyorsa null). */
  tipikGun: number | null;
  /** Değerlendirmeye giren e-posta sayısı. */
  ornek: number;
  /** Bayiye gösterilecek tek cümle. */
  aciklama: string;
}

/** Kendi ritmi bilinse bile bundan önce alarm verilmez — dalgalanma payı. */
export const ASGARI_SESSIZLIK_GUN = 10;
/** Kendi tipik aralığının bu katını aşarsa kanal durmuş sayılır. */
export const KAT_ESIGI = 3;
/** Ritmi ölçmek için gereken en az e-posta sayısı (aralık = e-posta − 1). */
export const ASGARI_ORNEK = 4;

const ortanca = (dizi: number[]): number => {
  if (dizi.length === 0) return 0;
  const s = [...dizi].sort((a, b) => a - b);
  const o = Math.floor(s.length / 2);
  return s.length % 2 ? s[o] : (s[o - 1] + s[o]) / 2;
};

/**
 * Sayaç e-postası kanalının ayakta olup olmadığını söyler.
 *
 * @param tarihler Gelen sayaç e-postalarının tarihleri (sıra önemsiz).
 *                 Yalnız GELDİ bilgisi kullanılır; işlendi/hata ayrımı burada
 *                 anlamsızdır — hata verse de kanal ÇALIŞIYOR demektir.
 * @param simdi    Referans an (testte sabitlemek için).
 */
export function kanalDurumu(tarihler: (Date | string)[], simdi: Date = new Date()): KanalSonucu {
  const bos: KanalSonucu = {
    durum: 'KURULMAMIS', gecenGun: null, tipikGun: null, ornek: 0,
    aciklama: 'Cihazdan sayaç e-postası hiç gelmemiş — kanal henüz kurulmamış.',
  };
  if (!Array.isArray(tarihler) || tarihler.length === 0) return bos;

  const ms = tarihler
    .map((t) => new Date(t).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (ms.length === 0) return bos;

  const gecenGun = Math.max(0, Math.round((simdi.getTime() - ms[ms.length - 1]) / 86400000));

  // Ritim bilinmiyorsa karar verilmez. Yeni kurulmuş bir kanalı "durdu" diye
  // işaretlemek, bayinin ilk günündeki en kötü karşılama olurdu.
  if (ms.length < ASGARI_ORNEK) {
    return {
      durum: 'YETERSIZ_VERI', gecenGun, tipikGun: null, ornek: ms.length,
      aciklama: `Kanal yeni — ritim için en az ${ASGARI_ORNEK} rapor gerekiyor (şu an ${ms.length}).`,
    };
  }

  const araliklar: number[] = [];
  for (let i = 1; i < ms.length; i++) {
    const g = (ms[i] - ms[i - 1]) / 86400000;
    if (g > 0) araliklar.push(g);       // aynı anda gelen çoklu rapor ritmi bozmasın
  }
  if (araliklar.length === 0) {
    return {
      durum: 'YETERSIZ_VERI', gecenGun, tipikGun: null, ornek: ms.length,
      aciklama: 'Bütün raporlar aynı anda gelmiş — ritim henüz ölçülemiyor.',
    };
  }

  const tipik = ortanca(araliklar);
  const esik = Math.max(ASGARI_SESSIZLIK_GUN, tipik * KAT_ESIGI);

  if (gecenGun > esik) {
    return {
      durum: 'DURDU', gecenGun, tipikGun: Math.round(tipik * 10) / 10, ornek: ms.length,
      aciklama: `${gecenGun} gündür hiçbir cihazdan sayaç e-postası gelmedi (normalde ${Math.max(1, Math.round(tipik))} günde bir gelirdi). Köprü durmuş olabilir — tek tek cihazları değil, önce kanalı kontrol edin.`,
    };
  }

  return {
    durum: 'CALISIYOR', gecenGun, tipikGun: Math.round(tipik * 10) / 10, ornek: ms.length,
    aciklama: `Kanal çalışıyor — son rapor ${gecenGun} gün önce geldi.`,
  };
}

/** Bayiye uyarı gösterilecek mi? Yalnız DURDU gösterilir. */
export function kanalUyarisi(s: KanalSonucu): boolean {
  return s.durum === 'DURDU';
}
