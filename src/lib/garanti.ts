import { gunFarki } from '@/lib/sozlesme';

/**
 * GARANTİ — "bu iş garanti kapsamında mı?"
 *
 * ── NEDEN AYRI BİR DOSYA ─────────────────────────────────────────────────
 * Bu sorunun cevabı üç yerde birden lazım: fiş açılırken (ücret alınacak
 * mı), cihaz kartında (bilgi) ve "garantisi bitiyor" listesinde (satış
 * fırsatı). Üç yere üç kopya yazmak, kuralın üç farklı cevap vermesi
 * demekti.
 *
 * ── KURULUM TARİHİ GARANTİ TARİHİ DEĞİL ──────────────────────────────────
 * İkinci el makine, devir alınan park, uzatılmış garanti — üçünde de
 * kurulum ile garanti ayrışıyor. Kurulumdan +1 yıl diye TÜRETMİYORUZ:
 * tahmin edilen garanti ya müşteriye kapsamdaki işi faturalatır ya bayiye
 * kapsam dışı işi bedava yaptırır. Bilinmiyorsa "bilinmiyor" diyor.
 */

export type GarantiCihazi = {
  warrantyStart?: Date | string | null;
  warrantyEnd?: Date | string | null;
  warrantyNote?: string | null;
};

export type GarantiDurumu =
  | 'BILINMIYOR'   // tarih girilmemiş — TAHMİN EDİLMEZ
  | 'KAPSAMDA'
  | 'BITIYOR'      // kapsamda ama az kaldı
  | 'BITTI'
  | 'BASLAMADI';   // başlangıç ileri tarihli

/** "Bitiyor" eşiği: bu kadar gün kalınca uyarılıyor (satış fırsatı). */
export const BITIYOR_ESIGI = 30;

const tarih = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

export type GarantiSonucu = {
  durum: GarantiDurumu;
  kalanGun: number | null;
  bitis: Date | null;
  not: string | null;
  /** Fiş ekranında gösterilecek tek cümle. */
  mesaj: string;
};

export function garantiDurumu(
  cihaz: GarantiCihazi,
  bugun: Date = new Date(),
): GarantiSonucu {
  const bas = tarih(cihaz.warrantyStart);
  const bit = tarih(cihaz.warrantyEnd);
  const not = (cihaz.warrantyNote ?? '').trim() || null;

  // Bitiş yoksa garanti durumu BİLİNMİYOR. Başlangıç tek başına yetmez:
  // "ne zaman bittiği" bilinmeden kapsamda olup olmadığı söylenemez.
  if (!bit) {
    return {
      durum: 'BILINMIYOR', kalanGun: null, bitis: null, not,
      mesaj: 'Garanti bilgisi girilmemiş — cihaz kartından ekleyin.',
    };
  }

  if (bas && gunFarki(bugun, bas) > 0) {
    return {
      durum: 'BASLAMADI', kalanGun: null, bitis: bit, not,
      mesaj: `Garanti ${bas.toLocaleDateString('tr-TR')} tarihinde başlıyor.`,
    };
  }

  const kalanGun = gunFarki(bugun, bit);
  if (kalanGun < 0) {
    return {
      durum: 'BITTI', kalanGun, bitis: bit, not,
      mesaj: `Garanti ${bit.toLocaleDateString('tr-TR')} tarihinde bitti (${-kalanGun} gün önce) — bu iş ücretli.`,
    };
  }
  if (kalanGun <= BITIYOR_ESIGI) {
    return {
      durum: 'BITIYOR', kalanGun, bitis: bit, not,
      mesaj: `Garanti kapsamında ama ${kalanGun} gün sonra bitiyor (${bit.toLocaleDateString('tr-TR')}).`
        + (not ? ` Kapsam: ${not}` : ''),
    };
  }
  return {
    durum: 'KAPSAMDA', kalanGun, bitis: bit, not,
    mesaj: `Garanti kapsamında — ${bit.toLocaleDateString('tr-TR')} tarihine kadar (${kalanGun} gün).`
      + (not ? ` Kapsam: ${not}` : ''),
  };
}

/** Ücret alınmalı mı? Bilinmiyorsa KARAR VERMİYOR — bayi baksın. */
export function ucretliMi(d: GarantiDurumu): boolean | null {
  if (d === 'KAPSAMDA' || d === 'BITIYOR') return false;
  if (d === 'BITTI' || d === 'BASLAMADI') return true;
  return null;
}

// ── TEKRAR ARIZA ─────────────────────────────────────────────────────────

/** Aynı cihaz bu kadar gün içinde tekrar arızalandıysa uyarılıyor. */
export const TEKRAR_ARIZA_GUN = 30;

export type GecmisFis = {
  id: string;
  ticketNumber: string;
  issueText?: string | null;
  status: string;
  createdAt: Date | string;
  statusUpdatedAt?: Date | string | null;
};

export type TekrarArizaSonucu = {
  tekrar: boolean;
  adet: number;
  gunler: number | null;
  fisler: { id: string; ticketNumber: string; arize: string; gunOnce: number }[];
  mesaj: string | null;
};

/**
 * Aynı cihazda son TEKRAR_ARIZA_GUN içinde KAPANMIŞ fiş var mı?
 *
 * ── NEDEN ÖNEMLİ ─────────────────────────────────────────────────────────
 * Aynı makine üç haftada ikinci kez arızalandıysa ilk onarım tutmamıştır.
 * Bunu bilmek iki şeyi değiştiriyor: teknisyen aynı parçayı tekrar
 * denemez, ve bayi müşteriden ikinci kez ücret istemeden önce düşünür.
 * Veri ve indeks zaten vardı; kimse bakmıyordu.
 */
export function tekrarAriza(
  gecmis: GecmisFis[],
  bugun: Date = new Date(),
  esikGun: number = TEKRAR_ARIZA_GUN,
): TekrarArizaSonucu {
  const kapali = new Set(['DELIVERED', 'READY']);
  const yakin = (gecmis ?? [])
    .filter((f) => kapali.has(f.status))
    .map((f) => {
      // Kapanış anı yoksa açılış anına düşüyoruz: eski kayıtlarda
      // statusUpdatedAt boş olabiliyor ve o fişi görmezden gelmek,
      // tekrarı kaçırmak demek.
      const t = tarih(f.statusUpdatedAt) ?? tarih(f.createdAt);
      return { f, gunOnce: t ? gunFarki(t, bugun) : null };
    })
    .filter((x): x is { f: GecmisFis; gunOnce: number } =>
      x.gunOnce !== null && x.gunOnce >= 0 && x.gunOnce <= esikGun)
    .sort((a, b) => a.gunOnce - b.gunOnce);

  if (!yakin.length) {
    return { tekrar: false, adet: 0, gunler: null, fisler: [], mesaj: null };
  }

  const enYakin = yakin[0];
  return {
    tekrar: true,
    adet: yakin.length,
    gunler: enYakin.gunOnce,
    fisler: yakin.slice(0, 5).map((x) => ({
      id: x.f.id,
      ticketNumber: x.f.ticketNumber,
      arize: (x.f.issueText ?? '').trim(),
      gunOnce: x.gunOnce,
    })),
    mesaj: yakin.length === 1
      ? `Bu cihaz ${enYakin.gunOnce} gün önce ${enYakin.f.ticketNumber} ile kapatılmıştı — ilk onarım tutmamış olabilir.`
      : `Bu cihazda son ${esikGun} günde ${yakin.length} kapanmış fiş var (en yenisi ${enYakin.gunOnce} gün önce).`,
  };
}
