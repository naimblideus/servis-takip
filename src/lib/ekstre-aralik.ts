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

/** ACIK = tarih aralığı değil: yalnız ödenmemiş kalemler (acikKalemler). */
export type AralikSecimi = 'SON3' | 'BU_YIL' | 'TUMU' | 'OZEL' | 'ACIK';
export const ARALIKLAR: AralikSecimi[] = ['SON3', 'BU_YIL', 'TUMU', 'OZEL', 'ACIK'];

/** Basılı ekstre bu kadar satırı aşınca sıkı düzene geçer (bir sayfaya ~2 katı). */
export const SIKI_BASKI_ESIGI = 30;
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

/**
 * ── YALNIZ ÖDENMEMİŞ KALEMLER ────────────────────────────────────────────
 * Tahsilata giderken müşteriye "şunları ödemediniz" listesi verilir; bütün
 * geçmiş değil. Bakiyenin iki kaynağı ayrı kapanır (lib/musteri-bakiye ile aynı):
 *   • Kira/sayaç faturası: faturanın kendi ödenen tutarı (fatura başına mahsup).
 *   • Servis kalemleri: tahsilat bir kaleme bağlı değil — en eski borçtan
 *     başlayarak düşülür (FIFO). Kalan kısmı olan kalem açık sayılır.
 * Servis tahsilatı servis borcunu aşarsa fark "fazla ödeme" satırıdır (eksi).
 * Toplam her zaman bütün ekstrenin bakiyesine eşittir.
 */
type EkstreGirdisi = Satir & { id: string; kaynak: 'SERVIS' | 'FATURA'; aciklama: string; detay?: string | null };

export type AcikKalem = {
  id: string;
  tarih: string;
  aciklama: string;
  detay?: string | null;
  tutar: number;
  odenen: number;
  kalan: number;
  /** Servis tahsilatı borcu aşınca: kalan eksi */
  fazlaOdeme?: true;
};

export function acikKalemler(satirlar: EkstreGirdisi[]): { kalemler: AcikKalem[]; toplam: number } {
  const kalemler: AcikKalem[] = [];

  // Fatura: borç satırı + aynı faturanın "-pay" tahsilat satırı.
  const odenenFatura = new Map<string, number>();
  for (const s of satirlar) if (s.kaynak === 'FATURA' && s.tip === 'ODEME') {
    const id = s.id.replace(/-pay$/, '');
    odenenFatura.set(id, (odenenFatura.get(id) ?? 0) + s.tutar);
  }
  for (const s of satirlar) if (s.kaynak === 'FATURA' && s.tip === 'BORC') {
    const odenen = r2(odenenFatura.get(s.id) ?? 0);
    const kalan = r2(s.tutar - odenen);
    if (kalan > 0.005) kalemler.push({ id: s.id, tarih: s.tarih, aciklama: s.aciklama, detay: s.detay, tutar: s.tutar, odenen, kalan });
  }

  // Servis: tahsilat havuzu en eski borçtan düşülür.
  const servis = satirlar.filter((s) => s.kaynak === 'SERVIS');
  let havuz = servis.filter((s) => s.tip === 'ODEME').reduce((a, s) => a + s.tutar, 0);
  const borclar = servis.filter((s) => s.tip === 'BORC')
    .sort((a, b) => new Date(a.tarih).getTime() - new Date(b.tarih).getTime());
  for (const s of borclar) {
    const dus = Math.min(havuz, s.tutar);
    havuz -= dus;
    const kalan = r2(s.tutar - dus);
    if (kalan > 0.005) kalemler.push({ id: s.id, tarih: s.tarih, aciklama: s.aciklama, detay: s.detay, tutar: s.tutar, odenen: r2(dus), kalan });
  }
  if (havuz > 0.005) {
    const son = servis.filter((s) => s.tip === 'ODEME').sort((a, b) => b.tarih.localeCompare(a.tarih))[0];
    kalemler.push({ id: 'fazla-odeme', tarih: son?.tarih ?? new Date().toISOString(), aciklama: '', tutar: 0, odenen: r2(havuz), kalan: -r2(havuz), fazlaOdeme: true });
  }

  kalemler.sort((a, b) => new Date(a.tarih).getTime() - new Date(b.tarih).getTime());
  return { kalemler, toplam: r2(kalemler.reduce((a, k) => a + k.kalan, 0)) };
}
