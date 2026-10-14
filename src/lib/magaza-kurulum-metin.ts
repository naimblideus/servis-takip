/**
 * "MAĞAZAMI KURUN" metinleri — TR/EN.
 *
 * Ana sözlükte (tr.ts/en.ts) değil, burada: bu özellik kendi başına duruyor
 * ve sözlük dosyaları aynı anda başka işlerde değişiyor. İki dil aynı
 * anahtarları taşımak ZORUNDA (`satisfies` derleme anında yakalar).
 */
const tr = {
  baslik: 'Mağazanızı biz kuralım',
  alt: 'Tek dokunuş: stoğunuzdaki ürünler, fiyatlar ve uyumluluk kayıtlarıyla mağazanız hazırlanır. Yayına almadan önce yasal bilgilerinizi (unvan, vergi no) siz girersiniz.',
  dugme: 'Mağazamı kurun',
  kuruluyor: 'Mağazanız hazırlanıyor… Stoğunuzdan katalog çıkarılıyor, bir dakika sürebilir.',
  hazir: 'Mağazanız hazır: {n} ürün stoğunuzdan geldi.',
  hazirBos: 'Mağazanız hazır. Stoğunuza ürün ve fiyat girdikten sonra panelde Ürünler → “Stoktan tazele” ile mağazaya alırsınız.',
  paneliAc: 'Mağaza panelini açın',
  hazirAlt: 'Yayına almak için panelde Ayarlar → Yasal bilgiler bölümünü doldurun. Bu bağlantı tek kullanımlıktır, 2 gün geçerlidir.',
  adresBekliyor: 'Mağazanız hazırlandı: {n} ürün stoğunuzdan geldi. Adresini 1 iş günü içinde bağlayıp panel bağlantısını WhatsApp’tan gönderiyoruz.',
  talepAlindi: 'İsteğiniz alındı. Mağazanızı 1 iş günü içinde kurup bağlantısını WhatsApp’tan gönderiyoruz.',
  yoneticiDegil: 'Mağazayı hesabın yöneticisi isteyebilir.',
  hata: 'İstek gönderilemedi. Birazdan tekrar deneyin.',
  demo: 'Demoda mağaza kurulmaz: demoyu aynı anda birçok kişi kullanıyor. Kendi ücretsiz deneme hesabınızda bu düğme mağazanızı kurar — nextusservis.com/kayit',
  adresBaglaniyor: 'Adres bağlanıyor (1 iş günü içinde)',
  adresBaglaniyorAlt: 'Mağazanız hazır ama henüz bir internet adresi yok. Adres bağlanınca panel bağlantısı WhatsApp’tan gelir.',
  panelDugme: 'Mağaza paneline girin',
  panelAlt: 'Ürün, fiyat, sipariş ve yasal bilgiler mağaza panelinde. Her basış bu cihaz için tek kullanımlık bir giriş bağlantısı üretir.',
  panelHazirlaniyor: 'Giriş bağlantısı hazırlanıyor…',
  panelHazir: 'Giriş bağlantınız hazır: tek kullanımlık, 2 gün geçerli.',
  panelTalep: 'İsteğiniz alındı. Panel bağlantısını WhatsApp’tan gönderiyoruz.',
};

const en = {
  baslik: 'Let us set up your store',
  alt: 'One tap: your store is prepared with the products, prices and compatibility records in your stock. You enter your legal details (company name, tax number) before going live.',
  dugme: 'Set up my store',
  kuruluyor: 'Preparing your store… Building the catalog from your stock, this can take a minute.',
  hazir: 'Your store is ready: {n} products came from your stock.',
  hazirBos: 'Your store is ready. After you add products and prices to your stock, bring them in from the panel with Ürünler → “Stoktan tazele” (refresh from stock).',
  paneliAc: 'Open the store panel',
  hazirAlt: 'To go live, fill in Settings → Legal details in the panel. This link works once and is valid for 2 days.',
  adresBekliyor: 'Your store is prepared: {n} products came from your stock. We will connect its address within 1 business day and send the panel link on WhatsApp.',
  talepAlindi: 'Request received. We will set up your store within 1 business day and send the link on WhatsApp.',
  yoneticiDegil: 'Only the account administrator can request the store.',
  hata: 'The request could not be sent. Please try again shortly.',
  demo: 'No store is set up from the demo because many people use it at the same time. In your own free trial account this button sets up your store — nextusservis.com/kayit',
  adresBaglaniyor: 'Address being connected (within 1 business day)',
  adresBaglaniyorAlt: 'Your store is ready but has no web address yet. Once connected, the panel link arrives on WhatsApp.',
  panelDugme: 'Go to the store panel',
  panelAlt: 'Products, prices, orders and legal details live in the store panel. Each tap creates a one-time sign-in link for this device.',
  panelHazirlaniyor: 'Preparing the sign-in link…',
  panelHazir: 'Your sign-in link is ready: works once, valid for 2 days.',
  panelTalep: 'Request received. We will send the panel link on WhatsApp.',
} satisfies Record<keyof typeof tr, string>;

export type MagazaKurulumMetni = typeof tr;
export function magazaKurulumMetni(dil: string | null | undefined): MagazaKurulumMetni {
  return dil === 'en' ? en : tr;
}
