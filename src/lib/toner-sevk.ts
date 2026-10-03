/**
 * TONER SEVKİ — saf kurallar (veritabanı yok).
 *
 * Toneri bitmek üzere olan cihaza bayi tek onayla toner gönderir: stok
 * düşer, cihaz "yolda" olur. Tarayıcı ya da fiş toner değişimini görünce
 * sevk "takıldı" olur ve gönderilen toner o değişime yazılır. Toner ürünü
 * karnesi (hangi toner gerçekte kaç sayfa basıyor) en çok bu bağdan beslenir:
 * müşteri toneri kendisi takınca fiş açılmıyor, hangi tonerin takıldığı
 * başka hiçbir yerden öğrenilemiyor.
 */
import { TONER_KRITIK } from '@/lib/sayac-tarama';

export type Kanal = 'BLACK' | 'COLOR';

/** Tükenmesine bu kadar gün kalan cihaz ihtiyaç listesine girer (Sarf'taki "yakında" ile aynı). */
export const SEVK_GUN = 14;

export type IhtiyacSebebi = 'OLCUM' | 'TAHMIN';

/**
 * Bu kanal için toner gerekiyor mu? Cihazın kendi ölçtüğü yüzde kritikse
 * (OLCUM) ya da sayaç hızına göre bitmesine az gün kaldıysa (TAHMIN).
 * Kurulum bekleyen (değişim referansı olmayan) kanalda karar verilmez.
 */
export function ihtiyacSebebi(f: {
  remainingPct: number | null; daysLeft: number | null; olculdu?: boolean; needsSetup?: boolean;
} | null | undefined): IhtiyacSebebi | null {
  if (!f || f.needsSetup) return null;
  if (f.olculdu && f.remainingPct !== null && f.remainingPct <= TONER_KRITIK) return 'OLCUM';
  if (f.daysLeft !== null && f.daysLeft <= SEVK_GUN) return 'TAHMIN';
  return null;
}

export type OneriKaynagi = 'SON_TAKILAN' | 'FIS' | 'MODEL';

/**
 * Önerilen toner: bu cihaza geçen sefer takılan → bu cihazın fişinde
 * kullanılan → aynı modelde en sık takılan. Hiçbiri yoksa öneri YOK —
 * bayi seçer; uyduğunu bilmediğimiz bir tonerin gönderilmesini önermeyiz.
 */
export function onerilenParca(g: {
  sonTakilan: string | null; sonFis: string | null; modelEnSik: string | null;
}): { partId: string; kaynak: OneriKaynagi } | null {
  if (g.sonTakilan) return { partId: g.sonTakilan, kaynak: 'SON_TAKILAN' };
  if (g.sonFis) return { partId: g.sonFis, kaynak: 'FIS' };
  if (g.modelEnSik) return { partId: g.modelEnSik, kaynak: 'MODEL' };
  return null;
}

/** En sık geçen değer (eşitlikte en son görülen kazanır: liste eskiden yeniye). */
export function enSik(degerler: readonly string[]): string | null {
  const say = new Map<string, number>();
  let en: string | null = null, enN = 0;
  for (const d of degerler) {
    const n = (say.get(d) ?? 0) + 1;
    say.set(d, n);
    if (n >= enN) { en = d; enN = n; }
  }
  return en;
}

/**
 * Cihazlardan doğan toner talebi, parça başına adet. Yolda olan (zaten
 * gönderilmiş) ve tonerini bilmediğimiz ihtiyaç sayılmaz.
 */
export function cihazTalebi(ihtiyaclar: readonly { partId: string | null; yolda: boolean }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of ihtiyaclar) {
    if (i.yolda || !i.partId) continue;
    m.set(i.partId, (m.get(i.partId) ?? 0) + 1);
  }
  return m;
}

/** Sevk isteğini doğrular; hatalıysa kod döner. */
export type SevkHatasi = 'CIHAZ_YOK' | 'KANAL_GECERSIZ' | 'ADET_GECERSIZ' | 'PARCA_YOK' | 'STOK_YETERSIZ' | 'ZATEN_YOLDA';

export function sevkIstegiAyikla(x: unknown): { deviceId: string; channel: Kanal; partId: string | null; adet: number } | SevkHatasi {
  const o = (x ?? {}) as Record<string, unknown>;
  if (typeof o.deviceId !== 'string' || !o.deviceId || o.deviceId.length > 64) return 'CIHAZ_YOK';
  if (o.channel !== 'BLACK' && o.channel !== 'COLOR') return 'KANAL_GECERSIZ';
  const adet = o.adet === undefined ? 1 : Number(o.adet);
  if (!Number.isInteger(adet) || adet < 1 || adet > 20) return 'ADET_GECERSIZ';
  const partId = o.partId === null || o.partId === undefined || o.partId === '' ? null
    : typeof o.partId === 'string' && o.partId.length <= 64 ? o.partId : undefined;
  if (partId === undefined) return 'PARCA_YOK';
  return { deviceId: o.deviceId, channel: o.channel, partId, adet };
}
