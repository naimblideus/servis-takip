/**
 * e-FATURA EKSİKLERİ — cümleler tek yerde.
 *
 * `fatura-kimlik.ts` ve `fatura-belgesi.ts` artık Türkçe cümle değil KOD
 * döndürüyor. Cümleyi burası kuruyor, okuyanın dilinde. Ekran (istemci) ve
 * CSV dışa aktarımı (sunucu) aynı fonksiyonu çağırıyor: eksik listesi
 * ekranda başka, dosyada başka yazamaz.
 *
 * Bu dosya SAFtır: React yok, Prisma yok.
 */
import type { Sozluk } from './i18n/sozluk';
import type { AliciEksigi } from './fatura-kimlik';
import type { SaticiEksigi, BelgeEksigi } from './fatura-belgesi';

export function aliciEksikMetni(sz: Sozluk, kod: AliciEksigi): string {
  return (sz.eFaturaEksik as Record<string, string>)[kod] ?? kod;
}

export function saticiEksikMetni(sz: Sozluk, kod: SaticiEksigi): string {
  return (sz.eFaturaEksik as Record<string, string>)[kod] ?? kod;
}

/** "Alıcı: Vergi dairesi yok" — tarafıyla birlikte tek satır. */
export function belgeEksikMetni(sz: Sozluk, e: BelgeEksigi): string {
  const metin = (sz.eFaturaEksik as Record<string, string>)[e.kod] ?? e.kod;
  if (e.taraf === 'FATURA') return metin;
  const taraf = e.taraf === 'SATICI' ? sz.eFaturaEksik.tarafSatici : sz.eFaturaEksik.tarafAlici;
  return `${taraf} ${metin}`;
}

/** Sayım anahtarı — "en çok tekrar eden eksik" listesi bunu kullanıyor. */
export function belgeEksikAnahtari(e: BelgeEksigi): string {
  return `${e.taraf}/${e.kod}`;
}

/** Anahtarı geri çözer (sunucudan gelen sayım listesi için). */
export function anahtardanEksik(anahtar: string): BelgeEksigi | null {
  const [taraf, kod] = anahtar.split('/');
  if (taraf !== 'SATICI' && taraf !== 'ALICI' && taraf !== 'FATURA') return null;
  return { taraf, kod } as BelgeEksigi;
}
