/**
 * EKSTRE TARİH ARALIĞI — "her şey alta kadar" yerine dönem + devreden bakiye.
 *
 * Eski müşteride (iki yıllık servis + kira) ekran yüzlerce satırı tek seferde
 * döküyor, ekstre yazdırınca sayfalarca kâğıt çıkıyordu. Muhasebede bilinen
 * çözüm: seçilen dönemin hareketleri + dönem öncesinin TEK satırı ("devreden
 * bakiye"). Bakiye değişmez; yalnız gösterilen satır azalır.
 *
 * Saf: veritabanı yok. Ekran ve basılı ekstre aynı fonksiyonu kullanır —
 * ekranda görülen aralık ile kâğıda basılan aralık aynı olsun.
 * Günler İSTANBUL takvimiyle (gece yarısından sonraki tahsilat ertesi güne).
 */

export type AralikSecimi = 'SON3' | 'BU_YIL' | 'TUMU' | 'OZEL';
export const ARALIKLAR: AralikSecimi[] = ['SON3', 'BU_YIL', 'TUMU', 'OZEL'];
export const VARSAYILAN_ARALIK: AralikSecimi = 'SON3';

/** Bir anın İstanbul günü: 'YYYY-MM-DD'. */
export function istanbulGunu(an: Date | string): string {
  return new Date(new Date(an).getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
}

export function gunGecerli(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Seçimi gün aralığına çevirir. null = sınır yok.
 *   SON3   → iki ay önceki ayın 1'i … bugün (26 Ekim → 1 Ağustos; tam aylar okunur)
 *   BU_YIL → 1 Ocak … bugün
 *   TUMU   → sınırsız
 *   OZEL   → verilen günler (geçersizse sınırsız)
 */
export function aralikCoz(secim: AralikSecimi, an: Date = new Date(), bas?: string | null, bit?: string | null): { bas: string | null; bit: string | null } {
  const bugun = istanbulGunu(an);
  const [y, m] = bugun.split('-').map(Number);
  if (secim === 'SON3') {
    const d = new Date(Date.UTC(y, m - 1 - 2, 1));
    return { bas: d.toISOString().slice(0, 10), bit: null };
  }
  if (secim === 'BU_YIL') return { bas: `${y}-01-01`, bit: null };
  if (secim === 'OZEL') {
    const b = gunGecerli(bas) ? bas : null;
    const s = gunGecerli(bit) ? bit : null;
    // Ters girilmişse yer değiştir: "boş ekstre" yerine kastedilen aralık.
    if (b && s && b > s) return { bas: s, bit: b };
    return { bas: b, bit: s };
  }
  return { bas: null, bit: null };
}

type Satir = { tip: 'BORC' | 'ODEME'; tutar: number; tarih: string };

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const etki = (s: Satir) => (s.tip === 'BORC' ? s.tutar : -s.tutar);

/**
 * Satırları aralığa böler. Dönen `satirlar` girişle aynı sırada (ekran
 * yeniden eskiye, basılı ekstre eskiden yeniye verir).
 *   devir    = başlangıçtan önceki hareketlerin bakiyesi
 *   kapanis  = devir + dönem borcu − dönem ödemesi (bitişten sonrası sayılmaz)
 */
export function ekstreKes<T extends Satir>(satirlar: T[], bas: string | null, bit: string | null) {
  let devir = 0, donemBorc = 0, donemOdeme = 0, onceki = 0;
  const icinde: T[] = [];
  for (const s of satirlar) {
    const g = istanbulGunu(s.tarih);
    if (bas && g < bas) { devir += etki(s); onceki++; continue; }
    if (bit && g > bit) continue;
    icinde.push(s);
    if (s.tip === 'BORC') donemBorc += s.tutar; else donemOdeme += s.tutar;
  }
  return {
    satirlar: icinde,
    /** Başlangıçtan önce kalan hareket sayısı (devir satırında gösterilir) */
    onceki,
    devir: r2(devir),
    donemBorc: r2(donemBorc),
    donemOdeme: r2(donemOdeme),
    kapanis: r2(devir + donemBorc - donemOdeme),
  };
}
