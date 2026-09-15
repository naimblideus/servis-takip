/**
 * HANGİ VERİTABANINA BAĞLIYIZ?
 *
 * "Veritabanı var ama bağlı değil" şüphesinin tek kesin cevabı DATABASE_URL'in
 * HEDEFİDİR. Panelde göstermek için o adresi okumak gerekiyor; ama aynı metin
 * nöbetçi alarmıyla ALARM_WEBHOOK_URL üzerinden DIŞARI da çıkıyor.
 *
 * Bu yüzden burada parola alanına HİÇ DOKUNULMUYOR. Okumayan kod sızdıramaz;
 * "yazarken dikkat ederim" bir güvenlik önlemi değildir.
 */

export interface Hedef {
  /** host:port — parola yok. */
  sunucu: string;
  veritabani: string;
  kullanici: string;
  /**
   * Adres konteynerin kendi içini gösteriyor. Üretimde veritabanı ayrı bir
   * kaynaksa bu YANLIŞTIR: orada kaynağın servis adı yazmalıdır.
   */
  yerel: boolean;
}

const YEREL = ['localhost', '127.0.0.1', '::1'];

/** Bozuk girdide patlamak yerine metni olduğu gibi bırakır. */
function coz(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Bağlantı dizesinden gösterilebilir özet. Çözülemezse null —
 * "bilinmiyor" demek, uydurmaktan iyidir.
 */
export function hedefOzeti(url: string | undefined | null): Hedef | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  // IPv6 adresleri köşeli parantezle gelir: [::1] → ::1
  const host = u.hostname.replace(/^\[/, '').replace(/\]$/, '');
  if (!host) return null;
  return {
    sunucu: `${host}:${u.port || '5432'}`,
    veritabani: coz(u.pathname.replace(/^\//, '')) || '?',
    kullanici: coz(u.username) || '?',
    yerel: YEREL.includes(host),
  };
}

/**
 * Hata metinlerinde bağlantı dizesi geçebiliyor. Bu metinler panele ve
 * alarm webhook'una gidiyor — parola varsa maskele.
 */
export function parolayiGizle(metin: string): string {
  return metin.replace(/(:\/\/[^:@\s/]+):[^@\s/]*@/g, '$1:***@');
}
