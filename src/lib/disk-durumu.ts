/**
 * DİSK DOLULUĞU — nöbetçinin en pahalı sessiz arızası.
 *
 * ── NİYE VAR ─────────────────────────────────────────────────────────────
 * 4 Eylül'de sunucunun diski derleme sırasında doldu (ENOSPC). Derleme öldü
 * ama yardımcı konteyner kapanmadı; Coolify "deploy hâlâ sürüyor" sayıp
 * sıradaki hiçbir şeyi başlatmadı. Sonuç: uygulama 12 GÜN boyunca eski
 * imajda dondu, o sürede yazılan hiçbir şey canlıya inmedi ve kimse fark
 * etmedi — site çalışıyordu.
 *
 * Bu, nöbetçinin tanımına birebir uyan bir arıza: hata vermiyor, sadece
 * OLMUYOR. Ama nöbetçi diske bakmıyordu.
 *
 * ── YÜZDE TEK BAŞINA YETMEZ ──────────────────────────────────────────────
 * Asıl soru "yüzde kaç dolu" değil, "bir sonraki derleme sığar mı". 500
 * GB'lık diskte %85 doluluk 75 GB boş demektir ve rahattır; 60 GB'lık diskte
 * aynı yüzde 9 GB bırakır ve bir Next.js derlemesi oraya zor sığar. Bu
 * yüzden önce BOŞ ALAN, sonra yüzde bakılıyor.
 */

/** Bir derlemenin rahatça sığması için gereken boş alan (GB). Ölçüm değil, tecrübe. */
export const DERLEME_ICIN_GB = 10;
/** Bunun altında derleme büyük ihtimalle yarıda ölür. */
export const KRITIK_GB = 4;

export const UYARI_YUZDE = 85;
export const KRITIK_YUZDE = 92;

import type { MesajKod, NedenKod } from './nobetci-metin';

export type DiskSeviye = 'iyi' | 'uyari' | 'kritik';

export interface DiskDurumu {
  toplamGB: number;
  bosGB: number;
  kullanimYuzde: number;
  seviye: DiskSeviye;
  /** Bulgu KOD olarak; cümleyi nobetci-metin.ts okuyanın dilinde kurar. */
  mesajKod: MesajKod;
  /** Ne yapılacağı — yalnız sorun varken dolu. */
  nedenKod?: NedenKod;
}

const gb = (bayt: number) => Math.round((bayt / 1_000_000_000) * 10) / 10;

/**
 * Disk durumu. Girdi BAYT cinsinden; işlev dosya sisteminden bağımsız
 * kalsın diye okuma çağıranda yapılıyor.
 */
export function diskDurumu(toplamBayt: number, bosBayt: number): DiskDurumu | null {
  if (!(toplamBayt > 0) || bosBayt < 0 || bosBayt > toplamBayt) return null;

  const toplamGB = gb(toplamBayt);
  const bosGB = gb(bosBayt);
  const kullanimYuzde = Math.round((1 - bosBayt / toplamBayt) * 100);

  if (bosGB < KRITIK_GB || kullanimYuzde >= KRITIK_YUZDE) {
    return {
      toplamGB, bosGB, kullanimYuzde, seviye: 'kritik',
      mesajKod: { kod: 'DISK_DOLU', yuzde: kullanimYuzde, bosGB },
      nedenKod: 'DISK_KRITIK',
    };
  }

  if (bosGB < DERLEME_ICIN_GB || kullanimYuzde >= UYARI_YUZDE) {
    return {
      toplamGB, bosGB, kullanimYuzde, seviye: 'uyari',
      mesajKod: { kod: 'DISK_DOLU', yuzde: kullanimYuzde, bosGB },
      nedenKod: 'DISK_UYARI',
    };
  }

  return {
    toplamGB, bosGB, kullanimYuzde, seviye: 'iyi',
    mesajKod: { kod: 'DISK_OK', yuzde: kullanimYuzde, bosGB },
  };
}
