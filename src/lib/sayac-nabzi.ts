/**
 * SAYAÇ NABZI — SAF HESAP.
 *
 * ── NEDEN ────────────────────────────────────────────────────────────────
 * Nöbetçide zaten bir sayaç e-postası kontrolü var ama iki yerde kaba:
 *   · PLATFORM GENELİNE bakıyor. Bir bayinin cihazları tamamen susarken
 *     ötekiler göndermeye devam ederse hiç ses çıkmıyor.
 *   · Eşiği sabit 14 gün. Saatte bir gönderen filo için 14 gün yüzlerce
 *     kayıp rapor demek; ayda bir gönderen filo için ise 14 gün gayet normal.
 *     Aynı sayı iki durumda da yanlış.
 *
 * Bu modül BAYİ BAZINDA ve BAYİNİN KENDİ RİTMİNE göre bakar.
 *
 * ── RİTİM UYDURULMAZ, ÖLÇÜLÜR ────────────────────────────────────────────
 * Beklenen aralık, o bayinin geçmiş e-postaları arasındaki ORTANCA aralıktır.
 * Ortalama değil: tek bir uzun tatil bütün eşiği kaydırırdı.
 *
 * {EN_AZ_OKUMA} e-postadan az veri varsa ritim ÖLÇÜLEMEZ ve hüküm verilmez.
 * "Az veriden eşik uydurup alarm çalmak", alarmın tamamen görmezden
 * gelinmesiyle biter.
 *
 * ── EŞİK: BİR TUR KAÇIRMA + YARIM TUR PAY ────────────────────────────────
 * Alarm eşiği beklenen aralığın {RITIM_KATI} katıdır. Üç kat değil: ayda bir
 * gönderen filoda üç kat, üç fatura dönemi demek olurdu. Bir buçuk tur,
 * "bir tur kaçtı ve ikincisi de gecikti" noktasıdır ve fatura kesilmeden
 * önce haber vermeye yeter.
 *
 * Altına {TABAN_SESSIZLIK_SAAT} saatlik taban konuldu: saatte bir gönderen
 * filoda birkaç saatlik kesinti alarm değildir. Hafta sonu ve kısa kesintiler
 * bu tabanın altında kalır.
 *
 * ── KÖPRÜ MÜ, BAYİ Mİ ────────────────────────────────────────────────────
 * Ayrım önemlidir çünkü gidilecek yer değişir: bayinin cihaz ayarı mı bozuldu,
 * yoksa e-postayı sisteme taşıyan köprü mü öldü.
 *
 * Ritmi olan HER bayi aynı anda sessizse arıza tek tek bayilerde değil ortak
 * yoldadır. Ama bu hüküm en az İKİ ritimli bayi varken verilir: tek bayide
 * "köprü öldü" ile "o bayinin cihazları sustu" birbirinden ayrılamaz ve
 * ayrılamayan şey iddia edilmez.
 */

/** Ritim ölçmek için gereken en az e-posta sayısı. */
export const EN_AZ_OKUMA = 3;
/** Bu sürenin altında asla alarm verilmez (saat). */
export const TABAN_SESSIZLIK_SAAT = 72;
/** Beklenen aralığın kaç katı sessizlik alarm sayılır. */
export const RITIM_KATI = 1.5;

export type NabizDurumu = 'AKIYOR' | 'SESSIZ' | 'RITIM_YOK';

export interface BayiNabzi {
  bayiId: string;
  bayiAd: string;
  /** E-posta kaynaklı okumaların sisteme düştüğü anlar. Sıra önemsiz. */
  damgalar: Date[];
}

export interface NabizSonucu {
  bayiId: string;
  bayiAd: string;
  durum: NabizDurumu;
  /** Ardışık e-postalar arasındaki ORTANCA aralık (saat). Ritim yoksa null. */
  beklenenAralikSaat: number | null;
  /** Son e-postadan bu yana geçen saat. Hiç e-posta yoksa null. */
  sessizlikSaat: number | null;
  /** Alarm eşiği (saat). Ritim yoksa null — eşik de uydurulmaz. */
  esikSaat: number | null;
}

const SAAT_MS = 3_600_000;

/** Ortanca. Ortalama değil: tek bir uzun boşluk eşiği kaydırmasın. */
function ortanca(sayilar: number[]): number | null {
  const s = sayilar.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!s.length) return null;
  const orta = Math.floor(s.length / 2);
  return s.length % 2 ? s[orta] : Math.round((s[orta - 1] + s[orta]) / 2);
}

/**
 * Bir bayinin sayaç hattı.
 *
 * Bütün hesap TAM SAAT üzerinden yürür: ekranda yazan sayı ile hükmü veren
 * sayı aynı olsun, sınırda "72 yazıyor ama alarm yok" tuhaflığı çıkmasın.
 */
export function nabizDurumu(b: BayiNabzi, simdi: Date): NabizSonucu {
  const temel = { bayiId: b.bayiId, bayiAd: b.bayiAd };
  const sirali = [...b.damgalar]
    .filter((d) => d instanceof Date && Number.isFinite(d.getTime()))
    .sort((x, y) => x.getTime() - y.getTime());

  if (!sirali.length) {
    return { ...temel, durum: 'RITIM_YOK', beklenenAralikSaat: null, sessizlikSaat: null, esikSaat: null };
  }

  const son = sirali[sirali.length - 1];
  const sessizlik = Math.max(0, Math.round((simdi.getTime() - son.getTime()) / SAAT_MS));

  // Ritim yoksa sessizlik yine de söylenir — bilgi vardır, HÜKÜM yoktur.
  if (sirali.length < EN_AZ_OKUMA) {
    return { ...temel, durum: 'RITIM_YOK', beklenenAralikSaat: null, sessizlikSaat: sessizlik, esikSaat: null };
  }

  const araliklar: number[] = [];
  for (let i = 1; i < sirali.length; i++) {
    araliklar.push(Math.round((sirali[i].getTime() - sirali[i - 1].getTime()) / SAAT_MS));
  }
  const beklenen = ortanca(araliklar) ?? 0;

  // ORTANCA ARALIK SIFIRSA RİTİM YOKTUR.
  // Damgaların hepsi tek seferde düşmüşse (toplu içe aktarma, geri doldurma,
  // demo tohumu) ölçülen bir tempo yoktur — sıfır bir tempo değil, temponun
  // hiç gözlenmemiş olmasıdır. Gerçek veride yakalandı: bütün bayilerde
  // aralık 0 çıkıyor ve kod yine de "akıyor/sessiz" diye hüküm veriyordu.
  if (beklenen <= 0) {
    return { ...temel, durum: 'RITIM_YOK', beklenenAralikSaat: null, sessizlikSaat: sessizlik, esikSaat: null };
  }

  const esik = Math.max(TABAN_SESSIZLIK_SAAT, Math.round(beklenen * RITIM_KATI));

  return {
    ...temel,
    durum: sessizlik > esik ? 'SESSIZ' : 'AKIYOR',
    beklenenAralikSaat: beklenen,
    sessizlikSaat: sessizlik,
    esikSaat: esik,
  };
}

export interface NabizOzeti {
  /** E-posta kaynaklı okuması olan bayi sayısı. */
  toplam: number;
  /** Ritmi ölçülebilen bayi sayısı — hüküm verilen küme budur. */
  ritimli: number;
  akiyor: number;
  sessiz: number;
  ritimsiz: number;
  /** En uzun sessizlik (saat), yalnız sessiz bayiler arasında. */
  enUzunSessizlikSaat: number | null;
  /**
   * Ritmi olan HER bayi aynı anda sessiz mi — yani arıza ortak yolda mı.
   * En az iki ritimli bayi yoksa bu hüküm VERİLMEZ: tek bayide köprü arızası
   * ile o bayinin cihazlarının susması ayırt edilemez.
   */
  kopruOlu: boolean;
}

export function nabizOzeti(sonuclar: NabizSonucu[]): NabizOzeti {
  const sessizler = sonuclar.filter((s) => s.durum === 'SESSIZ');
  const ritimli = sonuclar.filter((s) => s.durum !== 'RITIM_YOK').length;
  return {
    toplam: sonuclar.length,
    ritimli,
    akiyor: sonuclar.filter((s) => s.durum === 'AKIYOR').length,
    sessiz: sessizler.length,
    ritimsiz: sonuclar.filter((s) => s.durum === 'RITIM_YOK').length,
    enUzunSessizlikSaat: sessizler.length
      ? Math.max(...sessizler.map((s) => s.sessizlikSaat ?? 0))
      : null,
    kopruOlu: ritimli >= 2 && sessizler.length === ritimli,
  };
}
