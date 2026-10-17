/**
 * SAHADA GEÇEN SÜRE — "Vardım" / "Çıktım" (SAF KARAR).
 *
 * ── NİYE VAR ─────────────────────────────────────────────────────────────
 * Büyük müşteri "teknisyeniniz bir saatte gelip on dakikada gitti" der ya da
 * "dört saat bekledik". Fişin durum değişikliği bunu söylemez: ofis fişi
 * "serviste"ye sabah alır, teknisyen öğlen kapıdan girer. Teknisyen kapıya
 * varınca "Vardım", çıkınca "Çıktım" der; aradaki süre sahada geçen süredir.
 *
 * ── KONUM YOK ────────────────────────────────────────────────────────────
 * Yalnız saat yazılır. Konum izlemek teknisyeni gözetlemektir; bayinin
 * ihtiyacı "ne zaman vardı, ne kadar kaldı", "nerede dolaştı" değil.
 *
 * ── TEKRAR BASMAK ZARARSIZ ───────────────────────────────────────────────
 * Sahadaki telefon yavaş, eldivenli parmak iki kez basar. İkinci "Vardım"
 * ilk varış saatini EZMEZ (AYNI döner); "Çıktım" da öyle. Yanlış basılan
 * son adımı yalnız yönetici geri alır.
 *
 * Bu dosya SAFtır: Prisma yok. Veritabanına yazan saha-suresi-veri.ts,
 * aynı kararı `where` şartıyla yarışa karşı da kilitler.
 */

export const SAHA_ISLEMLERI = ['vardim', 'ciktim', 'geriAl', 'ustlen'] as const;
export type SahaIslemi = (typeof SAHA_ISLEMLERI)[number];

export function sahaIslemiMi(x: unknown): x is SahaIslemi {
  return typeof x === 'string' && (SAHA_ISLEMLERI as readonly string[]).includes(x);
}

export interface SahaFisi {
  status: string;
  varisAt: Date | null;
  ayrilisAt: Date | null;
  assignedUserId: string | null;
}

export interface SahaKisisi {
  id: string;
  role: string;
}

export type SahaHataKodu =
  | 'SAHA_YETKI_YOK'
  | 'SAHA_ONCE_VARDIM'
  | 'SAHA_FIS_KAPALI'
  | 'SAHA_ZATEN_ATANMIS'
  | 'BU_ISLEM_ICIN_YONETICI_YETKISI'
  | 'GECERSIZ_ISLEM';

export type SahaKarari =
  /** Yazılacak alanlar + yazımın şartı (yarışta ikinci istek boşa düşsün). */
  | { tur: 'YAZ'; alanlar: { varisAt?: Date | null; ayrilisAt?: Date | null; assignedUserId?: string }; serviseAl: boolean }
  /** Zaten öyle: hiçbir şey yazılmaz, hata da yok. */
  | { tur: 'AYNI' }
  | { tur: 'HATA'; kod: SahaHataKodu; durum: number };

const yoneticiMi = (rol: string) => rol === 'ADMIN' || rol === 'SUPER_ADMIN';

/** Bu kişi bu fişte Vardım/Çıktım diyebilir mi: atanan teknisyen ya da yönetici. */
export function sahaYetkisi(fis: Pick<SahaFisi, 'assignedUserId'>, kisi: SahaKisisi): boolean {
  if (yoneticiMi(kisi.role)) return true;
  return kisi.role === 'TECHNICIAN' && fis.assignedUserId === kisi.id;
}

/**
 * Bir basışın kararı.
 *
 *  · vardim  — varış yoksa şimdi yazılır; fiş "Yeni" ise "Serviste"ye geçer
 *              (aşama geçmişi düşer). Teslim/iptal edilmiş fişte varış yazılmaz:
 *              unutulmuş "Vardım"ı sonradan basmak SAHTE bir saat üretir.
 *  · ciktim  — önce varış olmalı. Teslimden sonra da basılabilir (sıra çoğu
 *              zaman: vardım → onar → teslim et → çıktım).
 *  · geriAl  — yalnız yönetici; SON adımı siler (önce çıkış, yoksa varış).
 *              Fişin durumuna dokunmaz: aşama geçmişi silinmez, düzeltilir.
 *  · ustlen  — atanmamış işi teknisyen (ya da yönetici) tek dokunuşla kendine
 *              alır. Başkasınınsa almaz: "üstlen" bir devralma düğmesi değil;
 *              işi başkasından almak yöneticinin kararı (fiş düzenleme).
 */
export function sahaKarari(fis: SahaFisi, islem: string, kisi: SahaKisisi, simdi: Date): SahaKarari {
  if (!sahaIslemiMi(islem)) return { tur: 'HATA', kod: 'GECERSIZ_ISLEM', durum: 400 };

  if (islem === 'geriAl') {
    if (!yoneticiMi(kisi.role)) return { tur: 'HATA', kod: 'BU_ISLEM_ICIN_YONETICI_YETKISI', durum: 403 };
    if (fis.ayrilisAt) return { tur: 'YAZ', alanlar: { ayrilisAt: null }, serviseAl: false };
    if (fis.varisAt) return { tur: 'YAZ', alanlar: { varisAt: null }, serviseAl: false };
    return { tur: 'AYNI' };
  }

  if (islem === 'ustlen') {
    if (kisi.role !== 'TECHNICIAN' && !yoneticiMi(kisi.role)) return { tur: 'HATA', kod: 'SAHA_YETKI_YOK', durum: 403 };
    if (fis.status === 'DELIVERED' || fis.status === 'CANCELLED') return { tur: 'HATA', kod: 'SAHA_FIS_KAPALI', durum: 409 };
    if (fis.assignedUserId === kisi.id) return { tur: 'AYNI' };
    if (fis.assignedUserId) return { tur: 'HATA', kod: 'SAHA_ZATEN_ATANMIS', durum: 409 };
    return { tur: 'YAZ', alanlar: { assignedUserId: kisi.id }, serviseAl: false };
  }

  if (!sahaYetkisi(fis, kisi)) return { tur: 'HATA', kod: 'SAHA_YETKI_YOK', durum: 403 };
  if (fis.status === 'CANCELLED') return { tur: 'HATA', kod: 'SAHA_FIS_KAPALI', durum: 409 };

  if (islem === 'vardim') {
    if (fis.varisAt) return { tur: 'AYNI' };
    if (fis.status === 'DELIVERED') return { tur: 'HATA', kod: 'SAHA_FIS_KAPALI', durum: 409 };
    return { tur: 'YAZ', alanlar: { varisAt: simdi }, serviseAl: fis.status === 'NEW' };
  }

  // ciktim
  if (!fis.varisAt) return { tur: 'HATA', kod: 'SAHA_ONCE_VARDIM', durum: 409 };
  if (fis.ayrilisAt) return { tur: 'AYNI' };
  // Saat geriye gidemez: çıkış varıştan önce yazılmaz.
  const an = simdi.getTime() < fis.varisAt.getTime() ? fis.varisAt : simdi;
  return { tur: 'YAZ', alanlar: { ayrilisAt: an }, serviseAl: false };
}

/**
 * Sahada geçen dakika. Çıkış yoksa `simdi` verilirse "şu ana kadar" (canlı
 * sayaç); verilmezse null. Varış yoksa ya da süre eksiyse null — bozuk
 * kayıttan süre üretilmez.
 */
export function sahaDakikasi(varisAt: Date | string | null | undefined, ayrilisAt: Date | string | null | undefined, simdi?: Date): number | null {
  if (!varisAt) return null;
  const v = new Date(varisAt).getTime();
  const s = ayrilisAt ? new Date(ayrilisAt).getTime() : simdi ? simdi.getTime() : NaN;
  if (!Number.isFinite(v) || !Number.isFinite(s) || s < v) return null;
  return Math.floor((s - v) / 60_000);
}

/** 72 → { saat: 1, dakika: 12 }. Gösterim dili sözlükte. */
export function sureParcala(dk: number): { saat: number; dakika: number } {
  const d = Math.max(0, Math.floor(dk));
  return { saat: Math.floor(d / 60), dakika: d % 60 };
}
