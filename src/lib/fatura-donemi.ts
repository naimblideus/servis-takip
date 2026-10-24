/**
 * FATURA DÖNEMİ — TEK KURAL (saf; veritabanına dokunmaz).
 *
 * ── NEDEN AYRI DOSYA ─────────────────────────────────────────────────────
 * Ay sınırı dört ayrı yerde (`invoicing`, `period-charges`, `invoice-appendix`,
 * `readings`) kendi kopyasıyla hesaplanıyordu ve hepsi SUNUCUNUN saat
 * dilimini kullanıyordu. Canlı konteyner UTC'de: İstanbul'da 1 Kasım 00:30'da
 * okunan sayaç UTC'de hâlâ 31 Ekim 21:30'dur — Ekim'e yazılıyordu. Kural
 * artık tek yerde ve İstanbul saatinde (UTC+3, 2016'dan beri yaz saati yok).
 *
 * ── OKUMANIN FATURA DÖNEMİ ───────────────────────────────────────────────
 * Bir sayaç okuması hangi ayın faturasına girer?
 *  · Kesim günü 1 (varsayılan, bugünkü davranış): okumanın kendi ayı.
 *  · Kesim günü N > 1: ayın N'inden önceki okumalar GEÇEN ayın kapanış
 *    okumasıdır. Cihazlar sayaç raporunu ayın 1'inde gönderiyor; kesim
 *    günü 3 olan bayide o rapor geçen ayın faturasına girer, bir ay geç
 *    değil. (Eskiden 1'inde 06:00'da kesilen faturaya yetişmiyordu.)
 *
 * ── GEÇ OKUMA KAYBOLMAZ ──────────────────────────────────────────────────
 * Okumanın gerçek saati artık saklanıyor (portal talebi, WhatsApp mesajı,
 * cihaz raporu). Gerçek saat geçmişte kalmış bir aya düşebilir. O ayın
 * fatura koşusu BİTTİYSE okuma oraya yazılırsa bir daha hiçbir koşu ona
 * bakmaz — sessiz kayıp. `okumaDonemiAta` böyle bir okumayı ilk açık
 * döneme taşır. "Koşu bitti mi" bilgisi veritabanında (FaturaTuru); bu
 * dosya yalnız kuralı taşır, kapalılık sorusunu çağırana bırakır.
 */

/** İstanbul'un UTC'ye göre farkı (milisaniye). */
export const IST_OFSET_MS = 3 * 3_600_000;

const iki = (n: number) => String(n).padStart(2, '0');

/** Bir anın İstanbul takvimindeki yıl/ay/gün'ü. */
export function istanbulTakvim(an: Date): { yil: number; ay: number; gun: number } {
  const d = new Date(an.getTime() + IST_OFSET_MS);
  return { yil: d.getUTCFullYear(), ay: d.getUTCMonth() + 1, gun: d.getUTCDate() };
}

/** 'YYYY-MM' biçiminde mi? (ay 01–12) */
export function gecerliDonem(p: unknown): p is string {
  return typeof p === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(p);
}

/** Bir anın İstanbul'daki takvim ayı: 'YYYY-MM'. */
export function donemOf(an: Date = new Date()): string {
  const t = istanbulTakvim(an);
  return `${t.yil}-${iki(t.ay)}`;
}

/**
 * 'YYYY-MM' dönemini [start, end) aralığına çevirir — sınırlar İstanbul
 * gece yarısı, UTC an olarak (veritabanındaki tarihlerle doğrudan karşılaştırılır).
 */
export function donemAraligi(period: string): { start: Date; end: Date } {
  const [y, m] = period.split('-').map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1) - IST_OFSET_MS),
    end: new Date(Date.UTC(y, m, 1) - IST_OFSET_MS),
  };
}

export function sonrakiDonem(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${iki(m + 1)}`;
}

export function oncekiDonem(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${iki(m - 1)}`;
}

/** Bayinin kesim günü: 1–28 (29–31 her ayda yok). Geçersizse 1. */
export function kesimGunu(x: unknown): number {
  const n = Math.trunc(Number(x));
  return Number.isFinite(n) && n >= 1 && n <= 28 ? n : 1;
}

/**
 * Bu anda alınan bir okumanın TAKVİME göre fatura dönemi (kapalılığa bakmadan).
 * Kesim gününden önceki günler geçen aya aittir.
 */
export function okumaDonemi(an: Date, kesim: number = 1): string {
  const t = istanbulTakvim(an);
  const ay = `${t.yil}-${iki(t.ay)}`;
  return t.gun < kesimGunu(kesim) ? oncekiDonem(ay) : ay;
}

/** Bu an itibarıyla açık (henüz kesilmemiş) dönem. */
export function acikDonem(an: Date = new Date(), kesim: number = 1): string {
  return okumaDonemi(an, kesim);
}

/** Kesim anı geçmiş en son dönem — gece işinin faturaladığı dönem. */
export function kapananDonem(an: Date = new Date(), kesim: number = 1): string {
  return oncekiDonem(okumaDonemi(an, kesim));
}

/**
 * Dönemin kesim anı: bir sonraki ayın kesim günü, İstanbul 00:00.
 * Kesim günü 1'de bu, dönemin bittiği an (bugünkü davranış).
 */
export function kesimAni(period: string, kesim: number = 1): Date {
  const { end } = donemAraligi(period);
  return new Date(end.getTime() + (kesimGunu(kesim) - 1) * 86_400_000);
}

/**
 * Elle "Faturala" düğmesinin varsayılan dönemi. Düğme ayın başında basılınca
 * kapanan ayı kesmek ister (eskiden yeni ayı keserdi: ayın 2'sinde basan bayi
 * neredeyse boş bir fatura görürdü); ayın ikinci yarısında bu ayı.
 * Ekran ikisini de gösterir ve bayi seçebilir — bu yalnız ön seçim.
 */
export function varsayilanElleDonem(an: Date = new Date(), kesim: number = 1): string {
  return istanbulTakvim(an).gun <= 15 ? kapananDonem(an, kesim) : acikDonem(an, kesim);
}

/**
 * Okumanın saklanan dönemini belirler. `kapaliMi(p)` → o dönemin fatura
 * koşusu bitti mi (FaturaTuru TAMAM). Bitmişse okuma bir sonraki döneme
 * kayar; en fazla 6 adım (gelecekteki bir döneme asla kaymaz: açık dönemin
 * koşusu bitmiş olamaz, yalnız kapanmış dönemler TAMAM işaretlenir).
 */
export async function okumaDonemiAta(
  okumaAni: Date,
  kesim: number,
  kapaliMi: (period: string) => Promise<boolean>,
): Promise<string> {
  let p = okumaDonemi(okumaAni, kesim);
  for (let i = 0; i < 6 && (await kapaliMi(p)); i++) p = sonrakiDonem(p);
  return p;
}

/**
 * Bir dönemin okumalarını seçen Prisma koşulu. Dönem damgası olan okuma
 * damgasıyla, damgasız (eski / başka yoldan yazılmış) okuma tarihiyle
 * seçilir — iki kural aynı sonucu verir, kesim günü 1 olan bayide birebir.
 * Sorguya yayılarak kullanılır: `where: { ..., ...donemOkumaKosulu(p) }`
 * (koşulda başka bir OR yoksa; varsa AND içine konur).
 */
export function donemOkumaKosulu(period: string) {
  const { start, end } = donemAraligi(period);
  return {
    OR: [
      { faturaDonemi: period },
      { faturaDonemi: null, readingDate: { gte: start, lt: end } },
    ],
  };
}

/** Okumanın hangi döneme ait olduğu (damga yoksa tarihinin İstanbul ayı). */
export function okumaninDonemi(r: { faturaDonemi?: string | null; readingDate: Date }): string {
  return r.faturaDonemi ?? donemOf(r.readingDate);
}
