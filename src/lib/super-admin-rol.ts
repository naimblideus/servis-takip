/**
 * SÜPER ADMİN ROLÜ — saf (veritabanı yok). Middleware'de (Edge) çalışır.
 *
 * SAHIP: her şey. EKIP (kurulum ve başarı ekibi): yalnız Kurulum ve Başarı,
 * Sorunlar ve kendi hesabı. DISTRIBUTOR (ör. Pantum Türkiye): yalnız
 * distribütör paneli ve kendi hesabı; veride yalnız KENDİ markası.
 * Fatura, paket, platform ayarı, gizli anahtarlar, bayi verisinin geri kalanı
 * sahip dışında KAPALI.
 *
 * Kural "izin listesi": sayılmayan her yol kapalıdır. Yeni bir süper admin
 * ekranı eklendiğinde ekip ya da distribütör onu kendiliğinden GÖRMEZ — açmak
 * için buraya bilerek yazmak gerekir.
 *
 * Eski oturum jetonlarında rol yok: SAHIP sayılır (rol eklenmeden önce yalnız
 * sahip hesabı vardı).
 */
export type SaRol = 'SAHIP' | 'EKIP' | 'DISTRIBUTOR';

export function saRol(x: unknown): SaRol {
  return x === 'EKIP' ? 'EKIP' : x === 'DISTRIBUTOR' ? 'DISTRIBUTOR' : 'SAHIP';
}

/** Ekibin açabildiği sayfalar ve uçlar. */
export const EKIP_SAYFALARI: readonly string[] = ['/super-admin/kurulum', '/super-admin/sorunlar', '/super-admin/hesabim'];
export const EKIP_UCLARI: readonly string[] = ['/api/super-admin/kurulum', '/api/super-admin/sorunlar', '/api/super-admin/hesabim', '/api/super-admin/2fa'];

/** Distribütörün açabildiği sayfalar ve uçlar. */
export const DISTRIBUTOR_SAYFALARI: readonly string[] = ['/super-admin/distributor', '/super-admin/hesabim'];
export const DISTRIBUTOR_UCLARI: readonly string[] = ['/api/super-admin/distributor', '/api/super-admin/hesabim', '/api/super-admin/2fa'];

/** Girişte gidilen sayfa. */
export const EKIP_ANA_SAYFA = '/super-admin/kurulum';
export const DISTRIBUTOR_ANA_SAYFA = '/super-admin/distributor';
export function anaSayfa(rol: SaRol): string {
  return rol === 'EKIP' ? EKIP_ANA_SAYFA : rol === 'DISTRIBUTOR' ? DISTRIBUTOR_ANA_SAYFA : '/super-admin/dashboard';
}

const altinda = (yol: string, kok: string) => yol === kok || yol.startsWith(kok + '/');

export function ekipErisebilir(yol: string): boolean {
  return [...EKIP_SAYFALARI, ...EKIP_UCLARI].some((k) => altinda(yol, k));
}

export function distributorErisebilir(yol: string): boolean {
  return [...DISTRIBUTOR_SAYFALARI, ...DISTRIBUTOR_UCLARI].some((k) => altinda(yol, k));
}

/** Bu rol bu yolu açabilir mi. Giriş sayfası herkese açık. */
export function rolErisebilir(rol: SaRol, yol: string): boolean {
  if (rol === 'SAHIP') return true;
  if (altinda(yol, '/super-admin/login') || altinda(yol, '/api/super-admin/login')) return true;
  return rol === 'EKIP' ? ekipErisebilir(yol) : distributorErisebilir(yol);
}
