/**
 * SÜPER ADMİN ROLÜ — saf (veritabanı yok). Middleware'de (Edge) çalışır.
 *
 * SAHIP: her şey. EKIP (kurulum ve başarı ekibi): yalnız Kurulum ve Başarı,
 * Sorunlar ve kendi hesabı. Fatura, paket, platform ayarı, gizli anahtarlar,
 * bayi verisinin geri kalanı ekipte KAPALI.
 *
 * Kural "izin listesi": EKIP için sayılmayan her yol kapalıdır. Yeni bir süper
 * admin ekranı eklendiğinde ekip onu kendiliğinden GÖRMEZ — açmak için buraya
 * bilerek yazmak gerekir.
 *
 * Eski oturum jetonlarında rol yok: SAHIP sayılır (rol eklenmeden önce yalnız
 * sahip hesabı vardı).
 */
export type SaRol = 'SAHIP' | 'EKIP';

export function saRol(x: unknown): SaRol {
  return x === 'EKIP' ? 'EKIP' : 'SAHIP';
}

/** Ekibin açabildiği sayfalar. */
export const EKIP_SAYFALARI: readonly string[] = ['/super-admin/kurulum', '/super-admin/sorunlar', '/super-admin/hesabim'];

/** Ekibin çağırabildiği uçlar (giriş/çıkış middleware'de zaten serbest). */
export const EKIP_UCLARI: readonly string[] = ['/api/super-admin/kurulum', '/api/super-admin/sorunlar', '/api/super-admin/hesabim', '/api/super-admin/2fa'];

/** Ekip girişte buraya gelir. */
export const EKIP_ANA_SAYFA = '/super-admin/kurulum';

const altinda = (yol: string, kok: string) => yol === kok || yol.startsWith(kok + '/');

export function ekipErisebilir(yol: string): boolean {
  return [...EKIP_SAYFALARI, ...EKIP_UCLARI].some((k) => altinda(yol, k));
}

/** Bu rol bu yolu açabilir mi. Giriş sayfası herkese açık. */
export function rolErisebilir(rol: SaRol, yol: string): boolean {
  if (rol === 'SAHIP') return true;
  if (altinda(yol, '/super-admin/login') || altinda(yol, '/api/super-admin/login')) return true;
  return ekipErisebilir(yol);
}
