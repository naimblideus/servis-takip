/**
 * CİHAZDAN OTOMATİK SAYAÇ — CİHAZ BAŞINA DURUM.
 *
 * ── NİYE VAR ─────────────────────────────────────────────────────────────
 * Sayaç e-postası kanalı çalışıyor: tek raporda yüzlerce cihaz saniyeler
 * içinde işleniyor. Ama ölçtüğümüzde 872 cihazlı bayide otomatik gönderen
 * cihaz sayısı SIFIRDI ve bunu kimse göremiyordu — çünkü "hangi cihaz
 * otomatik gönderiyor" sorusunun cevabı hiçbir yerde yoktu.
 *
 * Asıl tehlike kurulmamış cihaz değil, DURMUŞ cihazdır:
 *   - Kurulmamış cihaz bilinen bir eksiktir; sayaç turunda elle okunur.
 *   - Gönderirken duran cihaz GÖRÜNMEZ. Bayi son bilinen sayaçtan faturaya
 *     devam eder, aradaki sayfalar hiç faturalanmaz. Sessiz ve sürekli
 *     para kaybı; genelde aylar sonra müşteri "bu makine çok çalıştı"
 *     dediğinde fark edilir.
 *
 * ── NİYE ELLE İŞARET YOK ─────────────────────────────────────────────────
 * "Bu cihaz kurulu" diye bir kutu koymak kolay olurdu. Ama o kutu, cihaz
 * fabrika ayarlarına döndüğü ya da IT adresi sildiği an YALAN söylemeye
 * başlar ve kimse fark etmez. Durum burada tamamen OKUMA GEÇMİŞİNDEN
 * türetiliyor: cihaz gerçekten gönderdiyse otomatiktir, göndermiyorsa
 * değildir. Türetilen durum yalan söyleyemez.
 */

export type OtomatikDurum = 'OTOMATIK' | 'DURDU' | 'KURULMADI';

/** Okuma kaynağı: cihazın kendi e-postası. readings.ts ile aynı değer. */
export const KAYNAK_CIHAZ = 'CIHAZ_EPOSTA';

/**
 * Cihazlar sayaç raporunu genelde AYDA BİR gönderir (kurulum yönergesi de
 * "gönderim gününü ayın 1'i yapın" diyor). Bir aylık gönderim bir hafta
 * gecikebilir; 45 gün, gecikme ile gerçekten durmayı ayıran ilk gün.
 */
export const VARSAYILAN_ARALIK_GUN = 30;
export const VARSAYILAN_SESSIZLIK_GUN = 45;

/**
 * Cihazın kendi ölçülen aralığı varsa o kullanılır: haftalık gönderen bir
 * cihaz için 45 gün beklemek, altı hafta boyunca arızayı gizlemek demektir.
 * Eşik = ölçülen aralığın 2 katı, ama en az 14 gün (tek bir gecikmiş rapor
 * yüzünden alarm çalmasın) ve en fazla 45 gün.
 */
export const EN_AZ_ESIK_GUN = 14;

const GUN = 86_400_000;

function tarih(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

/** Gün farkı — saat farkları yüzünden eksi çıkmasın diye tabanlanır. */
export function gunFarki(once: Date | string, sonra: Date | string): number {
  return Math.max(0, Math.floor((tarih(sonra).getTime() - tarih(once).getTime()) / GUN));
}

/** Ortanca: tek bir gecikmiş rapor ortalamayı bozar, ortanca bozmaz. */
export function ortanca(sayilar: number[]): number | null {
  const s = sayilar.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!s.length) return null;
  const o = Math.floor(s.length / 2);
  return s.length % 2 ? s[o] : (s[o - 1] + s[o]) / 2;
}

/**
 * Cihazın otomatik gönderim aralığı — gün. En az iki gönderim gerekir;
 * tek gönderimden aralık ÇIKARILMAZ (uydurmak olurdu), null döner.
 */
export function araligiOlc(tarihler: (Date | string)[]): number | null {
  const s = tarihler.map(tarih).sort((a, b) => a.getTime() - b.getTime());
  if (s.length < 2) return null;
  const araliklar: number[] = [];
  for (let i = 1; i < s.length; i++) araliklar.push(gunFarki(s[i - 1], s[i]));
  const o = ortanca(araliklar.filter((n) => n > 0));
  return o === null ? null : Math.round(o);
}

/** Bu cihaz kaç gün sessiz kalırsa "durdu" sayılır. */
export function sessizlikEsigi(araGun: number | null): number {
  if (araGun === null) return VARSAYILAN_SESSIZLIK_GUN;
  return Math.min(VARSAYILAN_SESSIZLIK_GUN, Math.max(EN_AZ_ESIK_GUN, araGun * 2));
}

export interface CihazDurumu {
  durum: OtomatikDurum;
  /** Son otomatik okuma — hiç yoksa null. */
  sonGonderim: Date | null;
  /** Son gönderimin üstünden geçen gün. */
  sessizGun: number | null;
  /** Ölçülen gönderim aralığı (gün) — iki gönderimden azsa null. */
  araGun: number | null;
  /** Kaç otomatik okuma geldi. */
  gonderimSayisi: number;
  /** İnsanın okuyacağı tek cümle (Türkçe). */
  aciklama: string;
  /**
   * Aynı cümlenin dil bağımsız hâli. Cümleyi ekran kendi dilinde kuruyor;
   * `aciklama` eski çağıranlar ve testler için duruyor.
   */
  aciklamaKod:
    | { kod: 'HIC' }
    | { kod: 'DURDU_ARALIKLI'; ara: number; sessiz: number }
    | { kod: 'DURDU_TEK'; sessiz: number }
    | { kod: 'BUGUN' }
    | { kod: 'GUN_ONCE'; gun: number };
}

/**
 * Bir cihazın otomatik sayaç durumu.
 *
 * Girdi olarak SADECE otomatik okumaların tarihleri verilir (kaynak filtresi
 * çağıranda); böylece işlev veritabanından bağımsız ve test edilebilir kalır.
 */
export function cihazDurumu(
  otomatikTarihler: (Date | string)[],
  simdi: Date = new Date(),
): CihazDurumu {
  const s = otomatikTarihler.map(tarih).filter((d) => !isNaN(d.getTime())).sort((a, b) => a.getTime() - b.getTime());

  if (!s.length) {
    return {
      durum: 'KURULMADI', sonGonderim: null, sessizGun: null, araGun: null, gonderimSayisi: 0,
      aciklama: 'Bu cihaz hiç otomatik sayaç göndermedi.',
      aciklamaKod: { kod: 'HIC' },
    };
  }

  const son = s[s.length - 1];
  const sessizGun = gunFarki(son, simdi);
  const araGun = araligiOlc(s);
  const esik = sessizlikEsigi(araGun);

  if (sessizGun > esik) {
    return {
      durum: 'DURDU', sonGonderim: son, sessizGun, araGun, gonderimSayisi: s.length,
      aciklama: araGun
        ? `${araGun} günde bir gönderiyordu, ${sessizGun} gündür sessiz.`
        : `${sessizGun} gündür sessiz — bir kez gönderip kesildi.`,
      aciklamaKod: araGun
        ? { kod: 'DURDU_ARALIKLI', ara: araGun, sessiz: sessizGun }
        : { kod: 'DURDU_TEK', sessiz: sessizGun },
    };
  }

  return {
    durum: 'OTOMATIK', sonGonderim: son, sessizGun, araGun, gonderimSayisi: s.length,
    aciklama: sessizGun === 0 ? 'Bugün gönderdi.' : `${sessizGun} gün önce gönderdi.`,
    aciklamaKod: sessizGun === 0 ? { kod: 'BUGUN' } : { kod: 'GUN_ONCE', gun: sessizGun },
  };
}

export interface FiloOzeti {
  toplam: number;
  otomatik: number;
  durdu: number;
  kurulmadi: number;
  /** Otomatikleşme oranı — yüzde, 0-100. Cihaz yoksa null. */
  oran: number | null;
}

/** Bayinin tüm cihazları için tek bakışta durum. */
export function filoOzeti(durumlar: OtomatikDurum[]): FiloOzeti {
  const toplam = durumlar.length;
  const otomatik = durumlar.filter((d) => d === 'OTOMATIK').length;
  const durdu = durumlar.filter((d) => d === 'DURDU').length;
  return {
    toplam,
    otomatik,
    durdu,
    kurulmadi: durumlar.filter((d) => d === 'KURULMADI').length,
    oran: toplam ? Math.round((otomatik / toplam) * 100) : null,
  };
}

/**
 * İş sırası: önce DURDU (para kaybı sürüyor), sonra KURULMADI (kazanç
 * fırsatı), en son OTOMATIK (dokunulacak bir şey yok). Aynı gruptaysa uzun
 * süredir sessiz olan önce gelir.
 */
export function siraAnahtari(d: CihazDurumu): number {
  const grup = d.durum === 'DURDU' ? 0 : d.durum === 'KURULMADI' ? 1 : 2;
  return grup * 1_000_000 - (d.sessizGun ?? 0);
}
