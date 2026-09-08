/**
 * SAYAÇ ANOMALİSİ — "bu artış bu makineye ait olamaz"
 *
 * ── NEDEN VAR ────────────────────────────────────────────────────────────
 * Sayaç artık cihazın kendi e-postasından İNSANSIZ geliyor. Bu kanalın gücü
 * de zaafı da aynı: kimse bakmadan faturaya dönüşüyor. Yanlış bir sayı
 * girerse zinciri şöyle yürür:
 *   okunan değer → delta → aşım hesabı → dönem faturası → müşteriye gider.
 * Aradaki hiçbir adımda insan yok. Müşteri faturayı görünce anlar ve o an
 * tartışılan şey rakam değil GÜVENdir; bayi genelde tüm dönemi siler.
 *
 * ── ESKİ KORUMA NEDEN YETMİYOR ───────────────────────────────────────────
 * Tek satırlık sabit eşik vardı: delta > 200.000 ise uyar. İki yönde de kör:
 *   • Ayda 3.000 sayfa basan avukatlık bürosunun makinesi 150.000'e fırlarsa
 *     — 50 katı — eşiğin ALTINDA kaldığı için hiç uyarmıyor.
 *   • Gerçekten ayda 250.000 basan matbaa makinesi HER AY uyarı üretiyor;
 *     bayi iki ay sonra uyarılara bakmayı bırakıyor.
 * Doğru ölçüt makinenin KENDİ geçmişi: "normal"i her makine kendi tanımlar.
 *
 * ── EŞİK NEDEN BU KADAR DAR ──────────────────────────────────────────────
 * Yanlış alarmın bedeli burada daha ağır: bayi faturayı geciktirir, müşteriyi
 * boşuna arar, sonra da uyarıya bakmaz. O yüzden üç koşul BİRLİKTE aranıyor:
 * yeterli geçmiş + kendi hızının katı + mutlak taban. Biri tutmuyorsa
 * okuma NORMAL sayılır. Şüphe faturayı DURDURMAZ, yalnız bayiye gösterir —
 * karar bayinindir, sistem sessizce para tutmaz.
 *
 * Saf fonksiyon: veritabanı yok, testte gerçek veri olmadan sürülebilir.
 */

export interface AnomaliOkumasi {
  readingDate: Date | string;
  counterBlack: number;
  counterColor: number;
}

export type AnomaliDurumu =
  | 'NORMAL'
  | 'SUPHELI_KAT'      // kendi hızının çok üstünde
  | 'SUPHELI_MUTLAK';  // geçmişi olmasa bile inanılmaz büyük

export interface AnomaliSonucu {
  supheli: boolean;
  durum: AnomaliDurumu;
  /** Bu okumada eklenen toplam sayfa (siyah + renkli). */
  sayfa: number;
  /** Okumanın kapsadığı gün (önceki okumadan bu yana). */
  gun: number;
  /** Bu makinenin AYNI sürede basması beklenen sayfa (yoksa null). */
  beklenen: number | null;
  /** Bu okumanın günlük hızı (sayfa/gün). */
  gunlukHiz: number;
  /** Cihazın geçmişteki normal günlük hızı — kıyas tabanı (yoksa null). */
  normalHiz: number | null;
  /** Kaç katı — normalHiz yoksa null. */
  kat: number | null;
  /** Bayiye gösterilecek tek cümle. */
  aciklama: string;
}

/**
 * Geçmişi olmayan cihazda tek okumada bu kadar sayfa şüphelidir.
 * Geçmişi OLAN cihazda tek başına yetmez — bkz. TAVAN_ICIN_ASGARI_KAT.
 */
export const MUTLAK_TAVAN = 200000;
/**
 * Cihazın kanıtlanmış bir normali varsa mutlak tavan tek başına konuşamaz.
 * Gerçekten ayda 250.000 sayfa basan matbaa makinesi HER AY tavanı aşar;
 * onu her ay işaretlemek bayiyi uyarılara bakmaz hâle getirir ve asıl
 * hatalı okuma o körlükte faturaya girer. Bu yüzden geçmiş varken tavan
 * ancak okuma kendi normalinin bu katını da aşıyorsa devreye girer.
 */
export const TAVAN_ICIN_ASGARI_KAT = 2;
/** Kendi normal hızının bu katını aşarsa şüpheli. */
export const KAT_ESIGI = 5;
/**
 * Mutlak taban: bunun altındaki artışlar kat ne olursa olsun şüphe sayılmaz.
 * Ayda 40 sayfa basan makine 300 sayfaya çıkınca 7 kat olur ama ortada
 * para yoktur; bayiyi böyle bir şey için aratmak uyarıyı öldürür.
 */
export const TABAN_SAYFA = 5000;
/** Kıyas için gereken en az geçmiş okuma sayısı (aralık = okuma-1). */
export const ASGARI_GECMIS = 3;

const gunFarki = (a: Date | string, b: Date | string) =>
  (new Date(b).getTime() - new Date(a).getTime()) / 86400000;

const sayfaOf = (o: AnomaliOkumasi) => (o.counterBlack || 0) + (o.counterColor || 0);

const ortanca = (dizi: number[]): number => {
  if (dizi.length === 0) return 0;
  const s = [...dizi].sort((a, b) => a - b);
  const o = Math.floor(s.length / 2);
  return s.length % 2 ? s[o] : (s[o - 1] + s[o]) / 2;
};

/**
 * Cihazın geçmişindeki NORMAL günlük hızı çıkarır.
 *
 * Ortalama değil ORTANCA kullanılıyor: geçmişte bir tane hatalı okuma varsa
 * ortalama onunla birlikte yukarı kayar ve asıl anomaliyi normal gösterir.
 * Ortanca tek bir bozuk noktayı yutar.
 *
 * @param gecmis Cihazın ÖNCEKİ okumaları (yeni okuma hariç, sıra önemsiz).
 * @returns Günlük sayfa hızı, ya da karar için veri yoksa null.
 */
export function normalHizBul(gecmis: AnomaliOkumasi[]): number | null {
  if (!Array.isArray(gecmis) || gecmis.length < ASGARI_GECMIS) return null;

  const sirali = [...gecmis].sort(
    (a, b) => new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime(),
  );

  const hizlar: number[] = [];
  for (let i = 1; i < sirali.length; i++) {
    const gun = gunFarki(sirali[i - 1].readingDate, sirali[i].readingDate);
    if (gun < 1) continue;                                   // aynı gün iki okuma — hız anlamsız
    const fark = sayfaOf(sirali[i]) - sayfaOf(sirali[i - 1]);
    if (fark < 0) continue;                                  // sıfırlama/cihaz değişimi — kıyasa girmez
    hizlar.push(fark / gun);
  }
  if (hizlar.length < ASGARI_GECMIS - 1) return null;

  const h = ortanca(hizlar);
  return h > 0 ? h : null;
}

/**
 * Yeni bir okumanın cihazın kendi geçmişine göre inandırıcı olup olmadığını söyler.
 *
 * @param yeniSayfa  Bu okumada eklenen toplam sayfa (deltaBlack + deltaColor).
 * @param gecenGun   Önceki okumadan bu yana geçen gün (en az 1 sayılır).
 * @param gecmis     Cihazın önceki okumaları.
 */
export function anomaliDegerlendir(
  yeniSayfa: number,
  gecenGun: number,
  gecmis: AnomaliOkumasi[],
): AnomaliSonucu {
  const sayfa = Math.max(0, Math.round(yeniSayfa || 0));
  const gun = Math.max(1, gecenGun || 1);
  const gunlukHiz = sayfa / gun;
  const normalHiz = normalHizBul(gecmis);
  const kat = normalHiz && normalHiz > 0 ? gunlukHiz / normalHiz : null;

  // Beklenen = bu makinenin AYNI sürede basacağı sayfa. Kıyas cümlesi bunun
  // üzerine kuruluyor. Aylık ortalamayla anlatmak yanıltıcıydı: 1 günlük bir
  // okumayı "ayda ~5.630 sayfa basıyor, 480 katı" diye anlatınca iki sayı
  // birbirini tutmuyor ve bayi cümleye güvenmiyor. Aynı süre, tek taban.
  const beklenen = normalHiz === null ? null : Math.max(1, Math.round(normalHiz * gun));
  const gunYuvarlak = Math.round(gun);
  const temel = {
    sayfa, gun: gunYuvarlak, beklenen,
    gunlukHiz: Number(gunlukHiz.toFixed(1)),
    normalHiz: normalHiz === null ? null : Number(normalHiz.toFixed(1)),
    kat: kat === null ? null : Number(kat.toFixed(1)),
  };

  // ── ÖNCE KENDİ HIZINA GÖRE ──────────────────────────────────────────
  // Sıra önemli: cihazın kendi normali her zaman mutlak sayıdan daha iyi bir
  // ölçüttür. Tavan önce bakarsa, gerçekten çok basan makine her ay yanlış
  // alarm üretir. Üç koşul birlikte: yeterli geçmiş + kat aşımı + mutlak taban.
  if (normalHiz !== null && kat !== null && beklenen !== null && kat >= KAT_ESIGI && sayfa >= TABAN_SAYFA) {
    return {
      ...temel, supheli: true, durum: 'SUPHELI_KAT',
      aciklama: `Bu makine normalde ${gunYuvarlak} günde ~${beklenen.toLocaleString('tr-TR')} sayfa basıyor; bu okumada ${sayfa.toLocaleString('tr-TR')} sayfa geldi (${Math.round(kat)} katı). Yanlış cihazın raporu ya da hatalı okuma olabilir.`,
    };
  }

  // ── SONRA MUTLAK TAVAN ──────────────────────────────────────────────
  // Geçmişi olmayan cihazın tek koruması bu: yeni kurulan makinede ilk okuma
  // hatalıysa kıyaslanacak bir şey yoktur, sayının kendisi bağırmalıdır.
  // Geçmişi VARSA yalnızca kendi normalinin de belirgin üstündeyse konuşur.
  if (sayfa >= MUTLAK_TAVAN && (kat === null || kat >= TAVAN_ICIN_ASGARI_KAT)) {
    return {
      ...temel, supheli: true, durum: 'SUPHELI_MUTLAK',
      aciklama: `Tek okumada ${sayfa.toLocaleString('tr-TR')} sayfa eklendi — bu tek dönemde olağandışı. Sayacı ve cihazın doğru eşleştiğini kontrol edin.`,
    };
  }

  return { ...temel, supheli: false, durum: 'NORMAL', aciklama: 'Artış cihazın normal kullanımıyla uyumlu.' };
}
