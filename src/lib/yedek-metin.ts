/**
 * YEDEK DOĞRULAMA CÜMLELERİ — tek yerde.
 *
 * Doğrulayıcı (backup-restore.ts) sunucuda çalışır ve eskiden Türkçe cümle
 * üretiyordu; süper admin ekranı onu olduğu gibi basıyordu. Artık KOD dönüyor,
 * cümle burada okuyanın dilinde kuruluyor.
 *
 * Tablo adları (readings, financialTransactions) ÇEVRİLMEZ: yedek dosyasının
 * içindeki gerçek anahtarlardır, dosyayı açıp bakan kişi onları arar.
 *
 * Bu dosya SAFtır: React yok, Prisma yok.
 */
import { doldur, type Sozluk } from './i18n/sozluk';

/** Doğrulamanın bulgusu — hata ya da uyarı; ikisi de aynı biçimde kurulur. */
export type YedekBulgu =
  | { kod: 'DOSYA_OKUNAMADI' }
  | { kod: 'FORMAT_YANLIS'; format: string }
  | { kod: 'SURUM_DESTEKSIZ'; surum: string }
  | { kod: 'BOLUM_YOK'; tablo: string }
  | { kod: 'LISTE_DEGIL'; tablo: string }
  | { kod: 'FOTOGRAFSIZ' }
  | { kod: 'SIFRESIZ'; n: number };

export function yedekBulgusu(sz: Sozluk, b: YedekBulgu): string {
  const m = sz.superAdmin.geriYukle.bulgu;
  switch (b.kod) {
    case 'DOSYA_OKUNAMADI': return m.dosyaOkunamadi;
    case 'FORMAT_YANLIS': return doldur(m.formatYanlis, { format: b.format });
    case 'SURUM_DESTEKSIZ': return doldur(m.surumDesteksiz, { surum: b.surum });
    case 'BOLUM_YOK': return doldur(m.bolumYok, { tablo: b.tablo });
    case 'LISTE_DEGIL': return doldur(m.listeDegil, { tablo: b.tablo });
    case 'FOTOGRAFSIZ': return m.fotografsiz;
    case 'SIFRESIZ': return doldur(m.sifresiz, { n: b.n });
  }
}

/** Geri yükleme ucunun reddettiği durumlar. */
export type GeriYuklemeHatasi =
  | 'GECERSIZ_ISTEK'
  | 'BAYI_SECILMEDI'
  | 'BAYI_YOK'
  | 'UYGULAMA_HATASI';

export function geriYuklemeHatasi(sz: Sozluk, kod: GeriYuklemeHatasi, ayrinti?: string): string {
  const m = sz.superAdmin.geriYukle.hata;
  if (kod === 'UYGULAMA_HATASI') return doldur(m.uygulamaHatasi, { hata: ayrinti ?? '?' });
  return m[kod === 'GECERSIZ_ISTEK' ? 'gecersizIstek' : kod === 'BAYI_SECILMEDI' ? 'bayiSecilmedi' : 'bayiYok'];
}
