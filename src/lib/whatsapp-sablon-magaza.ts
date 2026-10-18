/**
 * NEXTUS MAĞAZA ŞABLONLARI — mağazanın tek platform numarasından gönderdiği
 * mesajların Meta'ya onaya giden metni TEK YERDE.
 *
 * ── NEDEN ŞABLON ─────────────────────────────────────────────────────────
 * Mağaza bildirimleri eskiden serbest metin gidiyordu (/api/shop/bildirim →
 * sendText). Serbest metin yalnız alıcı son 24 saatte bu numaraya yazdıysa
 * iletilir; ne bayi ne mağaza müşterisi platform numarasıyla yazışmıyor. Meta
 * gönderimi önce kabul edip sonra düşürüyordu (#131047): kayıtta "gönderildi",
 * telefonda hiçbir şey. İşletmenin başlattığı mesaj ancak onaylı şablonla gider.
 *
 * ── KİM KULLANIR ─────────────────────────────────────────────────────────
 * Mağaza (nextus-magaza src/lib/wa-sablon.ts) şablonun ADINI ve değişkenlerini
 * sırayla gönderir; uç (api/shop/bildirim) yalnız bu listedeki adları kabul
 * eder ve değişken sayısını burada yazan metinden sayar. Mağaza testi bu
 * dosyayı doğrudan okuyup değişken sayılarını kendi listesiyle karşılaştırır.
 *
 * ── META KURALLARI ───────────────────────────────────────────────────────
 * Değişkenler sırayla ({{1}}, {{2}}…), metin değişkenle başlamaz/bitmez, aynı
 * değişken iki kez geçmez, iki değişken yan yana durmaz. Değişken DEĞERİ satır
 * sonu, sekme ya da art arda 4'ten fazla boşluk taşıyamaz (#132018) — uç
 * `degiskenTemizle` ile tek satıra indirir. Her metin "DUR" yolunu söyler:
 * istemeyen kişi şikâyet etmek yerine durdurur (şikâyet tek numaranın
 * kalitesini bütün bayiler için düşürür). Kategori UTILITY: işlem bildirimi;
 * alıcı son 24 saatte yazdıysa ücretsiz.
 */
import type { SablonTanimi } from '@/lib/whatsapp-sablon';

export const MAGAZA_SABLONLARI = {
  yeniSiparis: {
    ad: 'magaza_yeni_siparis',
    kategori: 'UTILITY',
    dil: 'tr',
    metin:
      'Yeni sipariş geldi. Mağaza: {{1}}. Sipariş no: {{2}}. Alıcı: {{3}}. Toplam: {{4}} TL. Ödeme: {{5}}. Onaylamak için mağaza panelinizi açın: {{6}} Bu bildirimi istemiyorsanız DUR yazın ya da paneldeki Ayarlar bölümünden WhatsApp numarasını silin.',
    ornek: ['Örnek Fotokopi', 'NM-2026-00042', 'Ahmet Yılmaz', '1.836,45', 'Havale/EFT', 'https://ornek-magaza.com/yonetim/siparisler#NM-2026-00042'],
  },
  siparisAlindi: {
    ad: 'magaza_siparis_alindi',
    kategori: 'UTILITY',
    dil: 'tr',
    metin:
      'Merhaba {{1}}, {{2}} mağazasına verdiğiniz siparişiniz alındı. Sipariş no: {{3}}. Toplam: {{4}} TL. Ödeme bilgisi ve sipariş durumu: {{5}} Sipariş verirken WhatsApp bildirimini seçtiğiniz için yazıyoruz; istemiyorsanız DUR yazın.',
    ornek: ['Ahmet Yılmaz', 'Örnek Fotokopi', 'NM-2026-00042', '1.836,45', 'https://ornek-magaza.com/siparis/NM-2026-00042?j=3f9a1c'],
  },
  kargoda: {
    ad: 'magaza_siparis_kargoda',
    kategori: 'UTILITY',
    dil: 'tr',
    metin:
      'Merhaba {{1}}, {{2}} mağazasından verdiğiniz {{3}} numaralı sipariş kargoya verildi. Kargo bilgisi: {{4}}. Sipariş sayfanız: {{5}} Bildirim istemiyorsanız DUR yazın.',
    ornek: ['Ahmet Yılmaz', 'Örnek Fotokopi', 'NM-2026-00042', 'Yurtiçi Kargo, takip no 123456789', 'https://ornek-magaza.com/siparis/NM-2026-00042?j=3f9a1c'],
  },
  teslimeHazir: {
    ad: 'magaza_teslime_hazir',
    kategori: 'UTILITY',
    dil: 'tr',
    metin:
      'Merhaba {{1}}, {{2}} mağazasından verdiğiniz {{3}} numaralı sipariş hazır; dükkândan teslim alabilirsiniz. Adres: {{4}}. Sipariş sayfanız: {{5}} Bildirim istemiyorsanız DUR yazın.',
    ornek: ['Ahmet Yılmaz', 'Örnek Fotokopi', 'NM-2026-00042', 'Cumhuriyet Mah. Örnek Sok. No:5, Kütahya', 'https://ornek-magaza.com/siparis/NM-2026-00042?j=3f9a1c'],
  },
  stokGeldi: {
    ad: 'magaza_stok_geldi',
    kategori: 'UTILITY',
    dil: 'tr',
    metin:
      'Merhaba, {{1}} mağazasında beklediğiniz ürün stoğa girdi: {{2}}. Ürün sayfası: {{3}} Bu mesajı "Gelince haber ver" talebiniz üzerine bir kez gönderdik.',
    ornek: ['Örnek Fotokopi', 'Pantum TL-410 Toner (TL-410)', 'https://ornek-magaza.com/urun/pantum-tl-410'],
  },
} satisfies Record<string, SablonTanimi>;

/** Şablondaki değişken sayısı (en büyük {{n}}). */
export function degiskenSayisi(metin: string): number {
  let enBuyuk = 0;
  for (const m of metin.matchAll(/\{\{(\d+)\}\}/g)) enBuyuk = Math.max(enBuyuk, Number(m[1]));
  return enBuyuk;
}

/** Ada göre mağaza şablonu; listede yoksa null (uç yalnız bunları gönderir). */
export function magazaSablonu(ad: unknown): SablonTanimi | null {
  if (typeof ad !== 'string') return null;
  return Object.values(MAGAZA_SABLONLARI).find((s) => s.ad === ad) ?? null;
}

/** Değişkenin tek başına üst sınırı (bağlantılar uzun olabiliyor). */
export const DEGISKEN_AZAMI = 400;
/** Meta: şablon gövdesi değişkenlerle birlikte en çok 1024 karakter. */
export const GOVDE_AZAMI = 1024;

/**
 * Meta'nın kabul edeceği değer: satır sonu/sekme/fazla boşluk yok, boş değil,
 * makul uzunlukta. Mağaza zaten temizleyip gönderiyor; uç yine de temizler
 * (eski ya da hatalı istemci #132018 ile bütün mesajı düşürmesin).
 */
export function degiskenTemizle(v: unknown): string {
  const s = String(v ?? '')
    .replace(/[\r\n\t\u2028\u2029\u0085]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const k = s.length > DEGISKEN_AZAMI ? `${s.slice(0, DEGISKEN_AZAMI - 1).trimEnd()}…` : s;
  return k || '-';
}

/** Değişkenleri yerine koyulmuş metin — gönderim kaydında okunur hâli durur. */
export function sablonMetni(sablon: SablonTanimi, degiskenler: string[]): string {
  return sablon.metin.replace(/\{\{(\d+)\}\}/g, (_, n) => degiskenler[Number(n) - 1] ?? '');
}
