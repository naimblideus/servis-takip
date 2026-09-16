/**
 * RAPOR CÜMLELERİ — tek yerde.
 *
 * Yenileme gerekçesi ve model güvenilirlik notu sunucuda Türkçe cümle olarak
 * kuruluyordu. Uç noktalar artık KOD dönüyor (sayılar ayrı alanda) ve cümle
 * burada, okuyanın dilinde kuruluyor.
 *
 * Aynı dosyayı hem CSV (sunucu) hem ekran (istemci) kullanıyor: gerekçe
 * kâğıtta başka, ekranda başka yazarsa bayi hangisine güveneceğini bilemez.
 *
 * Bu dosya SAFtır: React yok, Prisma yok.
 */
import { doldur, type Sozluk } from './i18n/sozluk';
import type { Bicimleyici } from './bicim';

/** Yenileme raporunun gerekçe kodları — uç noktanın döndürdüğü biçim. */
export type YenilemeSebebi =
  | { kod: 'YASLI_SIK'; yil: number; ay: number; ziyaret: number; kategorili: number; kategorisiz: number }
  | { kod: 'COK_SERVIS'; ay: number; ziyaret: number; kategorili: number; kategorisiz: number }
  | { kod: 'ZARAR'; maliyet: number; gelir: number };

/**
 * "3 servis ziyareti (2 kategorili arıza, 1 kategorisiz)" ya da "5 arıza".
 * Kategorisiz fiş varsa sayının nereden geldiği yazılıyor — rakam
 * şişirilmiyor, kaynağı söyleniyor.
 */
function ziyaretMetni(sz: Sozluk, ziyaret: number, kategorili: number, kategorisiz: number): string {
  return kategorisiz > 0
    ? doldur(sz.yenileme.ziyaretKategorili, { n: ziyaret, k: kategorili, b: kategorisiz })
    : doldur(sz.yenileme.ziyaretSade, { n: ziyaret });
}

export function yenilemeSebebi(sz: Sozluk, b: Bicimleyici, s: YenilemeSebebi): string {
  if (s.kod === 'ZARAR') {
    return doldur(sz.yenileme.sebepZarar, { m: b.para(s.maliyet), g: b.para(s.gelir) });
  }
  const ziyaret = ziyaretMetni(sz, s.ziyaret, s.kategorili, s.kategorisiz);
  if (s.kod === 'YASLI_SIK') {
    return doldur(sz.yenileme.sebepYasliSik, { yil: s.yil, ay: s.ay, ziyaret });
  }
  return doldur(sz.yenileme.sebepCokServis, { ay: s.ay, ziyaret });
}

/** Model güvenilirliğinde "neden sayı üretilmedi" notu. */
export type ModelNotu =
  | { kod: 'AZ_CIHAZ'; n: number; min: number }
  | { kod: 'KATEGORI_YOK'; yuzde: number };

export function modelNotu(sz: Sozluk, b: Bicimleyici, n: ModelNotu | null | undefined): string | null {
  if (!n) return null;
  if (n.kod === 'AZ_CIHAZ') return doldur(sz.modelGuvenilirlik.notAzCihaz, { n: n.n, min: n.min });
  return doldur(sz.modelGuvenilirlik.notKategoriYok, { y: b.yuzde(n.yuzde) });
}
