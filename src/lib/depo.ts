/**
 * ÇOK DEPO VE TEKNİSYEN ARACI — saf kurallar (veritabanı yok).
 *
 * ── MODEL ────────────────────────────────────────────────────────────────
 * Part.stockQty firmanın TOPLAM stoğudur ve öyle kalır: satış, mağaza, toner
 * sevki, değerleme, asgari stok uyarısı bugünkü gibi doğru çalışır. Araçlar
 * ve ek depolar ayrı tabloda (DepoStok). Ana depo SATIR DEĞİLDİR:
 *
 *     ana depo = toplam − (araçlardaki + ek depolardaki)
 *
 * Böylece mevcut stok taşınmadan, tek satır veri göçü yazmadan çok depoya
 * geçiliyor ve "toplam ile depoların toplamı tutmuyor" diye bir hata türü
 * hiç oluşamıyor.
 *
 * ── SERVİS FİŞİ ──────────────────────────────────────────────────────────
 * Teknisyen fişe parça eklediğinde parça önce O TEKNİSYENİN ARACINDAN
 * düşer (fişin atandığı teknisyen; yoksa ekleyen kişi). Araçta yeterince
 * yoksa ana depodan. Teknisyene "nereden aldın" diye sorulmaz: sahada
 * araçtaki parçayı takmış olması en olası durum, sayım gerisini yakalar.
 */

export type DepoTuru = 'ARAC' | 'DEPO';
export const ANA = 'ana' as const;
export type DepoAnahtari = typeof ANA | string;

/** Ana depodaki adet. Eksi çıkarsa (toplam elle düşürülmüşse) 0 + uyarı. */
export function anaDepoAdedi(toplam: number, digerleri: number): { adet: number; eksik: number } {
  const fark = (toplam || 0) - (digerleri || 0);
  return fark >= 0 ? { adet: fark, eksik: 0 } : { adet: 0, eksik: -fark };
}

export type DepoHatasi =
  | 'DEPO_AD_GECERSIZ' | 'DEPO_TUR_GECERSIZ' | 'DEPO_TEKNISYEN_GEREKLI'
  | 'DEPO_AKTARIM_GECERSIZ' | 'DEPO_AYNI' | 'DEPO_YETERSIZ' | 'DEPO_YOK' | 'DEPO_PARCA_YOK';

export const DEPO_HATA_DURUMU: Record<DepoHatasi, number> = {
  DEPO_AD_GECERSIZ: 400,
  DEPO_TUR_GECERSIZ: 400,
  DEPO_TEKNISYEN_GEREKLI: 400,
  DEPO_AKTARIM_GECERSIZ: 400,
  DEPO_AYNI: 400,
  DEPO_YETERSIZ: 409,
  DEPO_YOK: 404,
  DEPO_PARCA_YOK: 404,
};

/** Yeni depo / araç isteği. */
export function depoGirdisi(x: unknown): { ad: string; tur: DepoTuru; kullaniciId: string | null } | DepoHatasi {
  const o = (x ?? {}) as Record<string, unknown>;
  const ad = typeof o.ad === 'string' ? o.ad.trim().replace(/\s+/g, ' ') : '';
  if (ad.length < 2 || ad.length > 60 || ad.toLocaleLowerCase('tr-TR') === 'ana depo') return 'DEPO_AD_GECERSIZ';
  if (o.tur !== 'ARAC' && o.tur !== 'DEPO') return 'DEPO_TUR_GECERSIZ';
  const kullaniciId = typeof o.kullaniciId === 'string' && o.kullaniciId ? o.kullaniciId : null;
  if (o.tur === 'ARAC' && !kullaniciId) return 'DEPO_TEKNISYEN_GEREKLI';
  return { ad, tur: o.tur, kullaniciId: o.tur === 'ARAC' ? kullaniciId : null };
}

/** Aktarım isteği: kaynak ve hedef 'ana' ya da depo kimliği. */
export function aktarimGirdisi(x: unknown): { kaynak: DepoAnahtari; hedef: DepoAnahtari; partId: string; adet: number } | DepoHatasi {
  const o = (x ?? {}) as Record<string, unknown>;
  const kaynak = typeof o.kaynak === 'string' && o.kaynak ? o.kaynak : '';
  const hedef = typeof o.hedef === 'string' && o.hedef ? o.hedef : '';
  const partId = typeof o.partId === 'string' && o.partId.length <= 64 ? o.partId : '';
  const adet = Number(o.adet);
  if (!kaynak || !hedef || !partId || kaynak.length > 64 || hedef.length > 64) return 'DEPO_AKTARIM_GECERSIZ';
  if (!Number.isInteger(adet) || adet < 1 || adet > 100_000) return 'DEPO_AKTARIM_GECERSIZ';
  if (kaynak === hedef) return 'DEPO_AYNI';
  return { kaynak, hedef, partId, adet };
}

/**
 * Teknisyen bu aktarımı yapabilir mi: yalnız KENDİ aracına giren ya da
 * aracından çıkan aktarım. Depolar arası taşıma yönetici işi.
 */
export function teknisyenAktarabilir(kaynak: DepoAnahtari, hedef: DepoAnahtari, kendiAraci: string | null): boolean {
  if (!kendiAraci) return false;
  return kaynak === kendiAraci || hedef === kendiAraci;
}

/** Fişte parça hangi depodan düşer: araçta yetiyorsa araç, yoksa ana depo. */
export function fisKaynagi(aracdaki: number | null | undefined, istenen: number): 'ARAC' | 'ANA' {
  return aracdaki !== null && aracdaki !== undefined && aracdaki >= istenen ? 'ARAC' : 'ANA';
}
