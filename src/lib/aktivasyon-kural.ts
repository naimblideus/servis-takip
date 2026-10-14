/**
 * AKTİVASYON KURALLARI — saf (veritabanı yok). Testi: scripts/test-aktivasyon.mjs
 * Veriyi `aktivasyon.ts` toplar; burası "hangi adımda, bugün neden aranmalı"
 * sorusunu cevaplar.
 */
export type NedenKodu =
  | 'BITIYOR_HAZIR'
  | 'BITIYOR_EKSIK'
  | 'SICAK'
  | 'GIRIS_YOK'
  | 'CIHAZ_YOK'
  | 'SAYAC_YOK'
  | 'EKIP_YOK'
  | 'SESSIZ'
  | 'YENI'
  | 'ODEDI';

const GUN = 86_400_000;

/** Kayıt notundan etkinlik adı: "Siteden … · İl · Etkinlik Adı" — il kısa, etkinlik adı uzun. */
export function etkinlikAdi(not: string | null | undefined, onek: string): string | null {
  if (!not?.startsWith(onek)) return null;
  const parca = not.split(' · ').slice(1).map((s) => s.trim());
  const e = parca.find((s) => s.length >= 20);
  return e ?? null;
}

/**
 * Hesabın adımı ve bugünkü arama sebebi — SAF (test edilebilir).
 * Sıra: deneme bitiyor > değeri gördü > takıldığı adım > yeni.
 */
export function nedenBul(
  h: {
    adim: number;
    acilis: Date;
    denemeBitis: Date | null;
    sonHareket: Date | null;
  },
  simdi: Date
): { neden: NedenKodu; oncelik: number } {
  if (h.adim >= 5) return { neden: 'ODEDI', oncelik: 90 };
  const kalan = h.denemeBitis ? Math.ceil((h.denemeBitis.getTime() - simdi.getTime()) / GUN) : null;
  if (kalan != null && kalan <= 5)
    return h.adim >= 3 ? { neden: 'BITIYOR_HAZIR', oncelik: 1 } : { neden: 'BITIYOR_EKSIK', oncelik: 2 };
  if (h.adim >= 4) return { neden: 'SICAK', oncelik: 3 };

  const yas = (simdi.getTime() - h.acilis.getTime()) / GUN;
  const sessiz = h.sonHareket ? (simdi.getTime() - h.sonHareket.getTime()) / GUN > 5 : yas > 5;
  if (sessiz && h.adim >= 1) return { neden: 'SESSIZ', oncelik: 4 };
  if (h.adim === 0) return yas < 1 ? { neden: 'YENI', oncelik: 6 } : { neden: 'GIRIS_YOK', oncelik: 4 };
  if (h.adim === 1) return { neden: 'CIHAZ_YOK', oncelik: 5 };
  if (h.adim === 2) return { neden: 'SAYAC_YOK', oncelik: 5 };
  return { neden: 'EKIP_YOK', oncelik: 5 };
}

export function adimBul(s: {
  girdi: boolean;
  cihaz: number;
  okuma: number;
  teknisyen: number;
  fis: number;
  odedi: boolean;
}): number {
  if (s.odedi) return 5;
  if (s.okuma > 0 && (s.teknisyen > 0 || s.fis > 0)) return 4;
  if (s.okuma > 0) return 3;
  if (s.cihaz > 0) return 2;
  if (s.girdi) return 1;
  return 0;
}
