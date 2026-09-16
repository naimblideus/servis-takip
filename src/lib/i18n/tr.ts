/**
 * SÖZLÜK — TÜRKÇE (KAYNAK).
 *
 * ── TEK KAYNAK ────────────────────────────────────────────────────────────
 * Türkçe sözlük ANAHTARLARIN kaynağı: `Sozluk` tipi buradan türüyor ve
 * İngilizce sözlük bu tipe uymak ZORUNDA. Bir anahtar burada eklenip orada
 * unutulursa derleme durur — yarım çeviri sessizce yayına giremez. Bu,
 * "çevirdim sandım, üç ekran Türkçe kalmış" hatasının tek kesin önleyicisi.
 *
 * ── ANAHTAR ADLARI TÜRKÇE ─────────────────────────────────────────────────
 * Depodaki her tanımlayıcı gibi. İngilizce anahtar + Türkçe değer karışımı
 * okurken iki dil arasında zıplatıyor.
 *
 * ── MENÜ ANAHTARLARI = href ───────────────────────────────────────────────
 * Menü etiketleri yol adıyla anahtarlanıyor ('/tickets' → 'Servis Fişleri').
 * Ayrı bir kimlik uydurmak, aynı sayfanın iki yerde iki adla anılmasına yol
 * açardı; href zaten benzersiz ve zaten var.
 */
export const tr = {
  dil: {
    sec: 'Dil',
    tr: 'Türkçe',
    en: 'English',
  },

  genel: {
    kaydet: 'Kaydet',
    kaydediliyor: 'Kaydediliyor…',
    iptal: 'Vazgeç',
    sil: 'Sil',
    duzenle: 'Düzenle',
    ekle: 'Ekle',
    yeni: 'Yeni',
    ara: 'Ara…',
    yukleniyor: 'Yükleniyor…',
    geri: 'Geri',
    ileri: 'İleri',
    kapat: 'Kapat',
    evet: 'Evet',
    hayir: 'Hayır',
    tumu: 'Tümü',
    hepsi: 'Hepsi',
    kayitYok: 'Kayıt yok',
    hata: 'Bir hata oluştu',
    baglantiHatasi: 'Bağlantı hatası',
    secin: 'Seçin…',
    zorunlu: 'Zorunlu',
    gun: 'gün',
    ay: 'ay',
    yil: 'yıl',
    adet: 'adet',
    toplam: 'Toplam',
    tarih: 'Tarih',
    musteri: 'Müşteri',
    cihaz: 'Cihaz',
    fis: 'Fiş',
    tutar: 'Tutar',
    durum: 'Durum',
    islem: 'İşlem',
    detay: 'Detay',
    yazdir: 'Yazdır',
    indir: 'İndir',
    gonder: 'Gönder',
    onayla: 'Onayla',
    dahaFazla: 'daha göster',
    bugun: 'Bugün',
    dun: 'Dün',
    gunOnce: 'gün önce',
  },

  menu: {
    '/dashboard': 'Dashboard',
    '/yardim': 'Nasıl Kullanılır?',
    '/market': 'Bayi Pazarı',
    '/magaza': 'Nextus Mağaza',
    '/tickets': 'Servis Fişleri',
    '/rota': 'Rota',
    '/customers': 'Müşteriler',
    '/devices': 'Cihazlar',
    '/toplu-zam': 'Toplu Zam',
    '/cihaz-karlilik': 'Cihaz Kârlılığı',
    '/sayac-turu': 'Sayaç Turu',
    '/sayac-eposta': 'Cihazdan Sayaç',
    '/whatsapp': 'WhatsApp',
    '/musteri-portali': 'Müşteri Paneli',
    '/musteri-bildirimleri': 'Müşteri Bildirimleri',
    '/takip': 'Takip',
    '/inventory': 'Stok',
    '/toner-verimi': 'Toner Verimi',
    '/kdv': 'KDV Özeti',
    '/sozlesmeler': 'Sözleşmeler',
    '/teklifler': 'Teklifler',
    '/e-fatura': 'e-Fatura Hazırlığı',
    '/sarf': 'Sarf Takibi',
    '/satis': 'Barkodla Satış',
    '/etiket': 'Zebra Etiket',
    '/reports': 'Raporlar',
    '/users': 'Kullanıcılar',
    '/settings': 'Ayarlar',
    '/import': 'Veri Aktarma',
    '/accounting': 'Muhasebe',
    '/invoices': 'Faturalar',
    '/collections': 'Tahsilat',
    '/kacan-gelir': 'Kaçan Gelir',
    '/admin': 'Süper Admin',
    gelismis: 'Gelişmiş',
    cikis: 'Çıkış Yap',
    menuAc: 'Menü',
  },

  giris: {
    baslik: 'Tekrar hoş geldiniz',
    alt: 'Servis ve sayaç panelinize erişmek için giriş yapın.',
    demoBaslik: 'Demo hesabı hazır',
    demoAlt: 'Bilgiler dolduruldu — Giriş Yap’a basmanız yeterli.',
    demoUyariOn: 'Bu hesaptaki tüm firma isimleri ve rakamlar',
    demoUyariVurgu: 'örnektir',
    demoUyariSon: '. Dilediğiniz gibi gezebilir, kayıt ekleyip silebilirsiniz.',
    eposta: 'E-posta adresi',
    epostaYer: 'ad@firma.com',
    sifre: 'Şifre',
    sifreGoster: 'Şifreyi göster',
    sifreGizle: 'Şifreyi gizle',
    gir: 'Giriş yap',
    giriliyor: 'Giriş yapılıyor…',
    dogrulaVeGir: 'Doğrula ve gir',
    dogrulamaKodu: 'Doğrulama kodu',
    dogrulamaAciklamaOn: 'Telefonunuzdaki doğrulama uygulamasındaki 6 haneli kod. Telefonunuz yanınızda değilse',
    dogrulamaAciklamaVurgu: 'kurtarma kodlarından',
    dogrulamaAciklamaSon: 'birini yazabilirsiniz.',
    hataSifre: 'E-posta veya şifre hatalı!',
    hataKod: 'Doğrulama kodu hatalı veya süresi geçti. Uygulamadaki güncel kodu girin.',
    hataSso: 'Kurumsal giriş tamamlanamadı.',
    veyaKurum: 'veya kurum hesabınızla',
    microsoft: 'Microsoft ile giriş',
    google: 'Google ile giriş',
    kurumNot: 'Kurumsal giriş yeni hesap açmaz — sistemde tanımlı kullanıcılar içindir.',
    anaSayfa: '← Ana sayfaya dön',
    fiyatlar: 'Fiyatlar',
    panelBaslik1: 'Kiralık cihaz servisini',
    panelBaslik2: 'tek yerden yönetin',
    panelAlt: 'Sayaç okumadan faturaya, servis fişinden tahsilata kadar tüm akış burada. Okunmayan sayaç, kesilmeyen fatura kalmaz.',
    ozellikler: [
      { ust: '3 kanal', alt: 'Sayaç: cihaz e-postası, WhatsApp fotoğrafı, saha turu' },
      { ust: 'Otomatik', alt: 'Sayaçtan faturaya, faturadan cariye' },
      { ust: 'Tek tuş', alt: 'Verinizi istediğiniz an dışa aktarın' },
      { ust: 'Kurulum', alt: 'Excel aktarımı ve eğitim bizden' },
    ],
    ssoHata: {
      'oturum-bayat': 'Oturumunuz artık geçerli değil (hesabınız güncellenmiş olabilir). Lütfen tekrar giriş yapın.',
      'sso-tanimsiz': 'Bu e-posta sistemde tanımlı değil ya da hesabınız kapatılmış. Kurumsal giriş yeni hesap açmaz; yöneticinizin sizi eklemesi gerekir.',
      'sso-coklu': 'Bu e-posta birden fazla firmada tanımlı. Kurumsal giriş kullanılamıyor — lütfen e-posta ve şifrenizle girin.',
      'sso-eposta-yok': 'Kurumsal hesabınız e-posta adresi paylaşmadı. E-posta ve şifrenizle girebilirsiniz.',
    },
  },

  durum: {
    fis: {
      NEW: 'Yeni',
      IN_SERVICE: 'Serviste',
      WAITING_FOR_PART: 'Parça Bekliyor',
      READY: 'Teslime Hazır',
      DELIVERED: 'Teslim Edildi',
      CANCELLED: 'İptal',
    },
    odeme: {
      PAID: 'Ödendi',
      UNPAID: 'Ödenmedi',
      PARTIAL: 'Kısmi',
    },
  },
};

export type Sozluk = typeof tr;
