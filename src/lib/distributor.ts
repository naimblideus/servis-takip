/**
 * DİSTRİBÜTÖR PANELİ — saf kurallar (veritabanı yok).
 *
 * Distribütör (ör. Pantum Türkiye) yalnız KENDİ markasının toplu verisini
 * görür. Buradaki kurallar pazarlık konusu değildir; testi
 * scripts/test-distributor.mjs kilitler:
 *
 *  · k-ANONİMLİK: bir sayı ancak en az K_ANONIM farklı bayiden besleniyorsa
 *    gösterilir. Altında sayı yerine "yeterli veri yok" yazılır — 0 DEĞİL:
 *    0 yazmak "hiç yok" demektir ve yanlıştır.
 *  · FARK SALDIRISI: adıyla görünmeye izin veren bayilerin cihaz sayısı
 *    yazılırsa "toplam − adlı bayiler = adsız bayiler" çıkar. Adsız kalan
 *    bayi 1 ya da 2 taneyse onun sayısı açığa çıkar. O durumda adlı
 *    bayilerin cihaz sayısı yazılmaz (farkGuvenli).
 *  · MARKA OTURUMDAN: distribütörün istekte yolladığı marka YOK SAYILIR
 *    (markaSec). Sahip markayı seçebilir; ekip hiç açamaz.
 *  · Marka eşleşmesi depodaki normalleştirmeyle (device-brands): ters
 *    kaydedilmiş marka/model düzelir, Türkçe İ ve büyük/küçük harf eşleşir.
 */
import { brandKey, displayBrand, normalizeBrandModel, detectBrandInText } from '@/lib/device-brands';
import { katla } from '@/lib/tr-katla';

/** En az kaç farklı bayi (reliability MIN_TENANTS_FOR_OEM ile aynı). */
export const K_ANONIM = 3;
/** Sahip markayı seçmezse açılan marka. */
export const VARSAYILAN_MARKA = 'Pantum';
/** Tahmin ufku (gün) — parca-omru UFUK_GUN ile aynı. */
export const TALEP_GUN = 30;
/** Aylık sayfa için sayaç penceresi (gün) — kurulum SAYAC_PENCERESI_GUN ile aynı. */
export const SAYFA_PENCERESI_GUN = 35;
/** Toner hızı penceresi (gün) — toner-veri ile aynı (son 120 günün okumaları). */
export const TONER_HIZ_GUN = 120;
/** Cihazdan okunan toner yüzdesi bu kadar eskiyse kullanılmaz (toner-veri OLCUM_GECERLI_MS). */
export const OLCUM_GECERLI_GUN = 7;
/** Toner payı penceresi (gün). */
export const PAY_PENCERESI_GUN = 365;

export const BASLIK_EN_UZUN = 80;
export const METIN_EN_UZUN = 600;
export const BAGLANTI_EN_UZUN = 500;
/** Bayi panelinde aynı anda en çok kaç duyuru. */
export const GOSTERILEN_DUYURU = 3;

/** "yeterli veri yok" = null. Sayı varsa sayı. */
export type Sayi = number | null;

/** k-anonimlik: en az K_ANONIM bayi yoksa null. */
export function kAnonim<T>(bayiSayisi: number, deger: T): T | null {
  return bayiSayisi >= K_ANONIM ? deger : null;
}

/**
 * Adlı bayilerin sayısı yazılırsa adsız kalanların toplamı farkla çıkar.
 * Adsız kalan hiç yoksa ya da en az K_ANONIM ise güvenli.
 */
export function farkGuvenli(toplamBayi: number, adliBayi: number): boolean {
  const adsiz = toplamBayi - adliBayi;
  return adsiz === 0 || adsiz >= K_ANONIM;
}

// ── MARKA ────────────────────────────────────────────────────────────────

/** Karşılaştırma anahtarı: bilinen markada kanonik, bilinmeyende Türkçe-güvenli katlama. */
export function markaAnahtari(x: unknown): string {
  const s = String(x ?? '').trim();
  return brandKey(s) ?? katla(s).replace(/[^a-z0-9]/g, '');
}

/** Ekranda ve kayıtta kullanılan yazım ("pantum" → "Pantum"). */
export function markaYazimi(x: unknown): string {
  return displayBrand(String(x ?? '').trim());
}

/** Cihazın markası (ters kaydedilmiş marka/model düzeltilerek) bu marka mı? */
export function markaEslesir(brand: unknown, model: unknown, hedef: string): boolean {
  const h = markaAnahtari(hedef);
  if (!h) return false;
  return markaAnahtari(normalizeBrandModel(brand, model).brand) === h;
}

/**
 * Parça bu markanın orijinali mi? Kartın üretici markası; boşsa parça
 * adında geçen bilinen marka (device-brands detectBrandInText — kullanıcının
 * kendi yazdığı ad, uydurma yok). İkisi de yoksa orijinal SAYILMAZ.
 */
export function parcaOrijinalMi(p: { oemBrand?: string | null; name?: string | null }, hedef: string): boolean {
  const m = (p.oemBrand && p.oemBrand.trim()) || detectBrandInText(p.name);
  return !!m && markaAnahtari(m) === markaAnahtari(hedef);
}

export type MarkaSecimi =
  | { ok: true; marka: string }
  | { ok: false; durum: 401 | 403; hata: 'OTURUM_YOK' | 'YETKI_YOK' | 'MARKA_YOK' };

/**
 * Hangi markanın verisi açılacak.
 *  · DISTRIBUTOR: OTURUMDAKİ marka. İstekteki marka YOK SAYILIR — adres
 *    çubuğuna ?marka=Canon yazmak başka markayı açmaz.
 *  · SAHIP: istediği marka (boşsa Pantum).
 *  · EKIP ve tanınmayan rol: kapalı.
 */
export function markaSec(
  oturum: { rol?: string | null; marka?: string | null } | null | undefined,
  istenen: string | null | undefined,
): MarkaSecimi {
  if (!oturum) return { ok: false, durum: 401, hata: 'OTURUM_YOK' };
  if (oturum.rol === 'DISTRIBUTOR') {
    const m = String(oturum.marka ?? '').trim();
    if (!m || !markaAnahtari(m)) return { ok: false, durum: 403, hata: 'MARKA_YOK' };
    return { ok: true, marka: markaYazimi(m) };
  }
  if (oturum.rol === 'SAHIP') {
    const m = String(istenen ?? '').trim().slice(0, 40) || VARSAYILAN_MARKA;
    if (!markaAnahtari(m)) return { ok: true, marka: VARSAYILAN_MARKA };
    return { ok: true, marka: markaYazimi(m) };
  }
  return { ok: false, durum: 403, hata: 'YETKI_YOK' };
}

// ── DUYURU ───────────────────────────────────────────────────────────────

export type DuyuruHatasi =
  | 'GECERSIZ' | 'BASLIK_BOS' | 'BASLIK_UZUN' | 'METIN_BOS' | 'METIN_UZUN' | 'BAGLANTI_GECERSIZ' | 'BITIS_GECERSIZ';

/** Bağlantı yalnız https; kullanıcı adı/şifre gömülü adres kabul edilmez. */
export function baglantiGecerli(s: unknown): boolean {
  if (typeof s !== 'string') return false;
  const v = s.trim();
  if (!v || v.length > BAGLANTI_EN_UZUN || /\s/.test(v)) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** "YYYY-AA-GG" → o günün sonu (İstanbul, 23:59:59). Geçmiş tarih kabul edilmez. */
export function bitisOku(s: unknown, simdi: Date): Date | null | 'GECERSIZ' {
  if (s === undefined || s === null || s === '') return null;
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'GECERSIZ';
  const t = new Date(`${s}T23:59:59+03:00`);
  if (Number.isNaN(t.getTime())) return 'GECERSIZ';
  // Ay/gün taşmasını yakala (2026-02-31 → Mart olurdu).
  const [y, a, g] = s.split('-').map(Number);
  const yerel = new Date(t.getTime() + 3 * 3_600_000);
  if (yerel.getUTCFullYear() !== y || yerel.getUTCMonth() + 1 !== a || yerel.getUTCDate() !== g) return 'GECERSIZ';
  if (t.getTime() <= simdi.getTime()) return 'GECERSIZ';
  return t;
}

export interface DuyuruGirdisi { baslik: string; metin: string; baglanti: string | null; bitis: Date | null }

export function duyuruGirdisi(x: unknown, simdi = new Date()): DuyuruGirdisi | { hata: DuyuruHatasi } {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return { hata: 'GECERSIZ' };
  const o = x as Record<string, unknown>;
  const baslik = typeof o.baslik === 'string' ? o.baslik.trim() : '';
  const metin = typeof o.metin === 'string' ? o.metin.trim() : '';
  if (!baslik) return { hata: 'BASLIK_BOS' };
  if (baslik.length > BASLIK_EN_UZUN) return { hata: 'BASLIK_UZUN' };
  if (!metin) return { hata: 'METIN_BOS' };
  if (metin.length > METIN_EN_UZUN) return { hata: 'METIN_UZUN' };
  const bosMu = o.baglanti === undefined || o.baglanti === null || (typeof o.baglanti === 'string' && !o.baglanti.trim());
  if (!bosMu && !baglantiGecerli(o.baglanti)) return { hata: 'BAGLANTI_GECERSIZ' };
  const bitis = bitisOku(o.bitis, simdi);
  if (bitis === 'GECERSIZ') return { hata: 'BITIS_GECERSIZ' };
  return { baslik, metin, baglanti: bosMu ? null : String(o.baglanti).trim(), bitis };
}

/** Süresi dolmamış mı (bitiş yok ya da gelecekte). */
export function duyuruAktif(d: { bitis: Date | string | null }, simdi: Date): boolean {
  return d.bitis === null || new Date(d.bitis).getTime() > simdi.getTime();
}

/**
 * Bayiye gösterilecek duyurular: yalnız bayinin cihazı olan markalar,
 * süresi dolmamış, en yeni önce, en çok GOSTERILEN_DUYURU.
 * `markalar`: bayinin cihaz markalarının anahtarları (markaAnahtari).
 */
export function bayiDuyurulari<T extends { marka: string; bitis: Date | string | null; createdAt: Date | string }>(
  liste: readonly T[], markalar: ReadonlySet<string>, simdi: Date,
): T[] {
  return liste
    .filter((d) => markalar.has(markaAnahtari(d.marka)) && duyuruAktif(d, simdi))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, GOSTERILEN_DUYURU);
}

// ── HESAP ────────────────────────────────────────────────────────────────

export interface Pay { orijinal: number; uyumlu: number; bilinmeyen: number; toplam: number }

/**
 * Yüzdeler (tam sayı, toplamı 100). Yuvarlama artığı en büyük kesirli
 * paya eklenir: 33+33+33=99 yazılmasın.
 */
export function payHesapla(adet: { orijinal: number; uyumlu: number; bilinmeyen: number }): Pay | null {
  const toplam = adet.orijinal + adet.uyumlu + adet.bilinmeyen;
  if (toplam <= 0) return null;
  const anahtar = ['orijinal', 'uyumlu', 'bilinmeyen'] as const;
  const ham = anahtar.map((k) => (adet[k] / toplam) * 100);
  const taban = ham.map(Math.floor);
  let artik = 100 - taban.reduce((s, x) => s + x, 0);
  const sira = ham.map((h, i) => ({ i, kesir: h - taban[i] })).sort((a, b) => b.kesir - a.kesir);
  for (const { i } of sira) { if (artik <= 0) break; taban[i]++; artik--; }
  return { orijinal: taban[0], uyumlu: taban[1], bilinmeyen: taban[2], toplam };
}

/** Yıllık arıza oranından ortalama arızalar arası gün (MTBF). */
export function mtbfGun(arizaYil: number | null | undefined): number | null {
  return typeof arizaYil === 'number' && arizaYil > 0 ? Math.round(365 / arizaYil) : null;
}

/** Ortanca (boşta null). */
export function ortanca(sayilar: readonly number[]): number | null {
  if (!sayilar.length) return null;
  const s = [...sayilar].sort((a, b) => a - b);
  const o = Math.floor(s.length / 2);
  return s.length % 2 ? s[o] : Math.round((s[o - 1] + s[o]) / 2);
}

/**
 * Bir grup bayi/cihaz satırını k-anonim süzer: her satır en az K_ANONIM
 * farklı bayiden beslenmeli. Gizlenen satır hiç dönmez, yalnız SAYISI.
 */
export function kSuz<T extends { bayiler: ReadonlySet<string> }>(satirlar: readonly T[]): { gosterilen: T[]; gizli: number } {
  const gosterilen = satirlar.filter((s) => s.bayiler.size >= K_ANONIM);
  return { gosterilen, gizli: satirlar.length - gosterilen.length };
}

// ── BAYİ AYARI ───────────────────────────────────────────────────────────

export interface Paylasim { oemDataSharing: boolean; markaAdIzni: boolean }

/** Ayar isteği: yalnız true/false kabul edilir; ikisinden en az biri gelmeli. */
export function paylasimGirdisi(x: unknown): Partial<Paylasim> | { hata: 'GECERSIZ' } {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return { hata: 'GECERSIZ' };
  const o = x as Record<string, unknown>;
  const cikan: Partial<Paylasim> = {};
  for (const k of ['oemDataSharing', 'markaAdIzni'] as const) {
    if (o[k] === undefined) continue;
    if (typeof o[k] !== 'boolean') return { hata: 'GECERSIZ' };
    cikan[k] = o[k] as boolean;
  }
  return Object.keys(cikan).length ? cikan : { hata: 'GECERSIZ' };
}

/**
 * İstekten sonraki durum. Ad izni yalnız paylaşım açıkken anlamlı:
 * paylaşım kapanınca ad izni de kapanır, paylaşım kapalıyken ad izni açılmaz.
 */
export function paylasimSonrasi(once: Paylasim, istek: Partial<Paylasim>): Paylasim {
  const oemDataSharing = istek.oemDataSharing ?? once.oemDataSharing;
  const markaAdIzni = oemDataSharing ? (istek.markaAdIzni ?? once.markaAdIzni) : false;
  return { oemDataSharing, markaAdIzni };
}
