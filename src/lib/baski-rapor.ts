// BASKI RAPORU VE GÜN SONU — saf (veritabanı yok). Testte doğrudan derlenir.
//
// Rapor tek soruya cevap verir: sipariş sayfası işe yarıyor mu? Pilotun
// ölçüsü "online gelen iş oranı"; yanında ciro, hazırlama süresi ve en çok
// satan. Gün sonu: kasadaki nakit sayılır, sistemdekiyle farkı yazılır.
import { KANALLAR, type Kanal } from './baski-is';

export interface RaporIsi {
  kanal: string;
  durum: string;
  toplam: number;
  odenen: number;
  createdAt: Date | string;
  /** İşin (son) hazır olduğu an; hazır olmadıysa null. */
  hazirAt: Date | string | null;
  kalemler: readonly { urunAd: string; tutar: number }[];
}

export interface RaporOzeti {
  isSayisi: number;
  ciro: number;
  /** Tahsil edilmemiş tutar (iptal hariç). */
  acik: number;
  /** % (0–100), tam sayı. İş yoksa 0. */
  onlineOrani: number;
  kanallar: { kanal: Kanal; adet: number; ciro: number }[];
  /** Açılıştan hazıra ortalama süre (dakika); hazır olan iş yoksa null. */
  hazirlamaDk: number | null;
  enCokSatan: { ad: string; adet: number; ciro: number }[];
  iptal: number;
}

/** İptal edilen iş ciroya ve orana girmez; ayrı sayılır. */
export function raporOzeti(isler: readonly RaporIsi[]): RaporOzeti {
  const gecerli = isler.filter((i) => i.durum !== 'IPTAL');
  const kanallar = KANALLAR.map((kanal) => {
    const l = gecerli.filter((i) => i.kanal === kanal);
    return { kanal, adet: l.length, ciro: l.reduce((s, i) => s + i.toplam, 0) };
  }).filter((k) => k.adet > 0).sort((a, b) => b.adet - a.adet);
  const sureler = gecerli.filter((i) => i.hazirAt).map((i) => (new Date(i.hazirAt!).getTime() - new Date(i.createdAt).getTime()) / 60_000).filter((d) => d >= 0);
  const urunler = new Map<string, { ad: string; adet: number; ciro: number }>();
  for (const i of gecerli) for (const k of i.kalemler) {
    const u = urunler.get(k.urunAd) ?? { ad: k.urunAd, adet: 0, ciro: 0 };
    u.adet++; u.ciro += k.tutar;
    urunler.set(k.urunAd, u);
  }
  const online = gecerli.filter((i) => i.kanal === 'ONLINE').length;
  return {
    isSayisi: gecerli.length,
    ciro: gecerli.reduce((s, i) => s + i.toplam, 0),
    acik: gecerli.reduce((s, i) => s + Math.max(0, i.toplam - i.odenen), 0),
    onlineOrani: gecerli.length ? Math.round((online / gecerli.length) * 100) : 0,
    kanallar,
    hazirlamaDk: sureler.length ? Math.round(sureler.reduce((s, d) => s + d, 0) / sureler.length) : null,
    enCokSatan: [...urunler.values()].sort((a, b) => b.ciro - a.ciro).slice(0, 5),
    iptal: isler.length - gecerli.length,
  };
}

/** 95 → "1 sa 35 dk"; 40 → "40 dk"; 1500 → "1 gün 1 sa". */
export function sureYaz(dk: number, dil: 'tr' | 'en' = 'tr'): string {
  const b = dil === 'en' ? { g: 'd', s: 'h', d: 'min' } : { g: 'gün', s: 'sa', d: 'dk' };
  const gun = Math.floor(dk / 1440), saat = Math.floor((dk % 1440) / 60), dakika = Math.round(dk % 60);
  if (gun > 0) return saat ? `${gun} ${b.g} ${saat} ${b.s}` : `${gun} ${b.g}`;
  if (saat > 0) return dakika ? `${saat} ${b.s} ${dakika} ${b.d}` : `${saat} ${b.s}`;
  return `${dakika} ${b.d}`;
}

export const RAPOR_GUNLERI: readonly number[] = [7, 30, 90];
export function raporGunu(x: unknown): number {
  const n = Number(x);
  return RAPOR_GUNLERI.includes(n) ? n : 30;
}

// ── GÜN SONU ─────────────────────────────────────────────────────────────

/** Günün ödemelerinden yol toplamları (kuruş). */
export function kasaToplamlari(odemeler: readonly { yol: string; tutar: number }[]): { nakit: number; kart: number; havale: number } {
  const t = (yol: string) => odemeler.filter((o) => o.yol === yol).reduce((s, o) => s + o.tutar, 0);
  return { nakit: t('NAKIT'), kart: t('KART'), havale: t('HAVALE') };
}

/**
 * Gün sonu sayımı geçerli mi? Sayılan nakit kuruş tam sayı, eksi olamaz.
 * Gelecek gün kapatılmaz. Fark = sayılan − sistemdeki (eksi: kasa açık).
 */
export function kapanisGecerli(g: { gun: unknown; sayilan: unknown }, bugun: string, nakit: number): { ok: true; gun: string; sayilan: number; fark: number } | { ok: false; kod: 'GUN_GECERSIZ' | 'TUTAR_GECERSIZ' } {
  const gun = String(g.gun ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(gun) || gun > bugun) return { ok: false, kod: 'GUN_GECERSIZ' };
  // Boş gövde (null) sıfır sayılmasın: "kasa boş" ile "tutar gönderilmedi" ayrı şeyler.
  const sayilan = typeof g.sayilan === 'number' ? g.sayilan : typeof g.sayilan === 'string' && g.sayilan.trim() ? Number(g.sayilan) : NaN;
  if (!Number.isInteger(sayilan) || sayilan < 0 || sayilan > 100_000_000_00) return { ok: false, kod: 'TUTAR_GECERSIZ' };
  return { ok: true, gun, sayilan, fark: sayilan - nakit };
}
