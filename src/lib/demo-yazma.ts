/**
 * DEMODA YAZMA KURALI — herkese açık demoyu kalabalığa karşı korur.
 *
 * ── SORUN ────────────────────────────────────────────────────────────────
 * Herkese açık demoya (/demo) herkes AYNI hesapla giriyor. Bir etkinlikte
 * yüz kişi aynı anda deneyince biri müşterileri siler, firma adını değiştirir
 * ya da 5.000 satırlık bir Excel içe aktarırsa ötekiler gece tazelemesine
 * (03:30) kadar bozuk demo görür. demo-koruma.ts yalnız hesabı kilitleyen
 * işleri (şifre, e-posta, 2FA) ve dışarıya mesajı kapatıyordu.
 *
 * ── KURAL ────────────────────────────────────────────────────────────────
 * Demo oturumunda (oturum jetonunda `demo`) şunlar kapalı:
 *   · Her SİLME isteği.
 *   · Aşağıdaki öneklerde her yazma: ayarlar, kullanıcılar, içe/dışa
 *     aktarım ve yedek, muhasebe tohumu/Logo, toplu işlemler, SMS/WhatsApp,
 *     abonelik, e-belge.
 * Fiş açmak, sayaç girmek, fatura kesmek, cihaz eklemek AÇIK: demonun amacı
 * bunları denemek. Bu dosya middleware'de (Edge) çalışır; veritabanına
 * dokunmaz, yalnız yöntem + yol bakar.
 */

const YAZMA_KAPALI_ONEKLER = [
  '/api/settings',
  '/api/users',
  '/api/import',
  '/api/backup',
  '/api/setup',
  '/api/accounting/seed',
  '/api/accounting/logo-import',
  '/api/logo',
  '/api/bizimhesap',
  '/api/fix-',
  '/api/sms',
  '/api/whatsapp',
  '/api/devices/bulk-',
  '/api/customers/portal-toplu',
  '/api/invoices/e-belge',
  '/api/abonelik',
  // "Bizden aldı" işareti: demoda bir ziyaretçi basınca kaçan toner listesi herkese boşalırdı.
  '/api/kacan-toner',
];
// Tarayıcı anahtarı (/api/sayac/tarayici/ayar) burada YOK: ucun kendi demo
// cevabı ziyaretçiyi ücretsiz taramaya yönlendiriyor, o daha iyi bir cevap.

/** Giriş/çıkış ve dil seçimi demoda da çalışmalı. */
const HER_ZAMAN_ACIK = ['/api/auth/', '/api/locale'];

export function demoYazmaYasak(yontem: string, yol: string): boolean {
  const y = yontem.toUpperCase();
  if (y === 'GET' || y === 'HEAD' || y === 'OPTIONS') return false;
  if (!yol.startsWith('/api/')) return false;
  if (HER_ZAMAN_ACIK.some((o) => yol.startsWith(o))) return false;
  if (y === 'DELETE') return true;
  return YAZMA_KAPALI_ONEKLER.some((o) => yol === o || yol.startsWith(o));
}

/** Yanıt metni; ekranlar `error` alanını olduğu gibi gösteriyor. */
export const DEMO_YAZMA_MESAJI = {
  tr: 'Bu işlem demoda kapalı: demoyu aynı anda birçok kişi kullanıyor. Kendi 14 günlük hesabınızda açık — nextusservis.com/kayit',
  en: 'This action is turned off in the demo because many people use it at the same time. It works in your own 14-day account — nextusservis.com/kayit',
} as const;
