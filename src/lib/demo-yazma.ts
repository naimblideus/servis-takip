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
 * Fiş açmak, sayaç girmek, cihaz eklemek AÇIK: demonun amacı bunları
 * denemek. Toplu fatura, tarama onayı ve toner sevki ise vitrini tükettiği
 * için kapalı (DEMO_VITRIN). Bu dosya middleware'de (Edge) çalışır; veritabanına
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
  // Yalnız dışarıya toplu gönderim. Gelen kutusu (/api/whatsapp/inbox) açık:
  // fotoğraftan sayaç işlemek demonun vitrini, dışarıya mesaj atmıyor.
  '/api/whatsapp/bulk',
  '/api/customers/portal-toplu',
  // Bayi Pazarı ortak: ziyaretçinin açtığı ilan/fotoğraf, ilan gizleme (PATCH
  // ile DELETE kuralını aşıyordu), pazar adı ve mesajlar herkese görünürdü.
  '/api/market/listings',
  '/api/market/profile',
  '/api/market/messages',
  '/api/market/threads',
  // Firma geneli ayarın başka kapısı: hedef marj.
  '/api/sozlesmeler/karlilik',
  '/api/invoices/e-belge',
  '/api/abonelik',
  // "Bizden aldı" işareti: demoda bir ziyaretçi basınca kaçan toner listesi herkese boşalırdı.
  '/api/kacan-toner',
  // "Aradım" işareti: bir ziyaretçi basınca "Aranması gerekenler" herkese boşalırdı.
  // Müşterinin anket cevabı (/api/public/anket) ve "Memnuniyet sor" açık.
  '/api/memnuniyet',
];
// Toplu zam / toplu ayar (/api/devices/bulk-*) burada YOK: önizlemeleri
// (dryRun) yazmıyor, demoda da görülsün; "Uygula" uçların içinde kapalı.
// Tarayıcı anahtarı (POST /api/sayac/tarayici/ayar) da YOK: ucun kendi demo
// cevabı ziyaretçiyi ücretsiz taramaya yönlendiriyor. Aynı yolun PATCH'i
// (otomatik kaydet / otomatik fiş = firma ayarı) aşağıda kapalı.

/**
 * VİTRİN — demonun gösterdiği değeri TÜKETEN tekil işler (yalnız POST, tam yol).
 * Biri "Bu Dönemi Faturala"ya basınca Kaçan Gelir herkes için ₺0'a iniyor,
 * taramayı onaylayınca "tek tıkla ekle" kayboluyor, toner gönderince "toner
 * bitiyor" listesi boşalıyordu — 03:30'daki tazelemeye kadar. Ekranlar demoda
 * bu düğmelerde ne olacağını söylüyor (sözlük demoOnizleme); burası arka kapı.
 * Önek değil tam yol: /api/invoices/<id>/... tahsilatları açık kalsın.
 */
const DEMO_VITRIN = [
  /^\/api\/invoices$/,
  /^\/api\/sayac\/tarayici\/(?!ayar$)[^/]+(\/cihaz)?$/,
  /^\/api\/toner-sevk$/,
  // Yedek bırakmak, iade, kayıp ve sayım müşteride duran toner vitrinini herkes için değiştirir.
  /^\/api\/emanet$/,
];

/** Giriş/çıkış ve dil seçimi demoda da çalışmalı. */
const HER_ZAMAN_ACIK = ['/api/auth/', '/api/locale'];

export function demoYazmaYasak(yontem: string, yol: string): boolean {
  const y = yontem.toUpperCase();
  if (y === 'GET' || y === 'HEAD' || y === 'OPTIONS') return false;
  if (!yol.startsWith('/api/')) return false;
  if (HER_ZAMAN_ACIK.some((o) => yol.startsWith(o))) return false;
  if (y === 'DELETE') return true;
  if (y === 'POST' && DEMO_VITRIN.some((r) => r.test(yol))) return true;
  if (y === 'PATCH' && yol === '/api/sayac/tarayici/ayar') return true;
  return YAZMA_KAPALI_ONEKLER.some((o) => yol === o || yol.startsWith(o));
}

/** Yanıt metni; ekranlar `error` alanını olduğu gibi gösteriyor. */
export const DEMO_YAZMA_MESAJI = {
  tr: 'Bu işlem demoda kapalı: demoyu aynı anda birçok kişi kullanıyor. Kendi ücretsiz deneme hesabınızda açık — nextusservis.com/kayit',
  en: 'This action is turned off in the demo because many people use it at the same time. It works in your own free trial account — nextusservis.com/kayit',
} as const;
