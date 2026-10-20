/**
 * KURULUM VE BAŞARI metinleri — TR/EN (süper admin ekranları gömülü Türkçe
 * taşıyamaz: scripts/test-super-admin.mjs). Ana sözlükte değil, burada: bu
 * ekran kendi başına duruyor. İki dil aynı anahtarları taşımak ZORUNDA
 * (`satisfies KurulumMetni`).
 *
 * Yazım: ekip öğrencilerden oluşuyor. Jargon yok; her adım tek cümle ve
 * "bayinin hangi sayfasında yapılır" ile birlikte.
 */
import type { Adim, AdimKodu, AdimDurumu, SaglikKodu, SaglikNedeni, Renk, NotTuru } from '@/lib/kurulum';
import { doldur } from '@/lib/i18n/sozluk';

type AdimMetni = Record<AdimKodu, string>;

export interface KurulumMetni {
  baslik: string;
  alt: string;
  kurulumda: string;
  hazir: string;
  ortancaGun: string;
  ortancaYok: string;
  bugunAranacak: string;
  sekme: { bugun: string; kurulumda: string; kullanimda: string; hepsi: string };
  benim: string;
  bos: string;
  sutun: { bayi: string; kurulum: string; sirada: string; saglik: string; sorumlu: string; sonNot: string; sonrakiTemas: string };
  cihazSayisi: string;
  zorunluSayi: string;
  ayrinti: string;
  sorumluYok: string;
  notYok: string;
  tarihYok: string;
  bugun: string;
  gecti: string;
  hepsiTamam: string;
  renk: Record<Renk, string>;
  durum: Record<AdimDurumu, string>;
  ad: AdimMetni;
  /** Sıradaki adım — ekibin bayiye söyleyeceği tek cümle. */
  sirada: AdimMetni;
  /** Nasıl yapılır — ürünün neresinde. */
  nasil: AdimMetni;
  /** Kanıt: adımın durumunu gösteren sayılar. */
  kanit: AdimMetni;
  kanitUygulanmaz: string;
  sayacPay: string;
  sayacPayYok: string;
  whatsappKanit: { TAMAM: string; EKSIK: string };
  eFaturaKanit: { TAMAM: string; KISMEN: string; EKSIK: string };
  saglik: Record<SaglikKodu, string>;
  saglikDurduran: string;
  denemeBitti: string;
  saglikYesil: string;
  // Ayrıntı
  geri: string;
  iletisim: string;
  yetkili: string;
  telefon: string;
  eposta: string;
  il: string;
  acilis: string;
  hazirOldu: string;
  bilinmiyor: string;
  ara: string;
  whatsapp: string;
  whatsappYok: string;
  mesajNotu: string;
  adimlar: string;
  zorunlu: string;
  istegeBagli: string;
  nasilBaslik: string;
  sayfa: string;
  saglikBaslik: string;
  takip: string;
  sorumlu: string;
  sonrakiTemas: string;
  kaydet: string;
  kaydedildi: string;
  notlar: string;
  yeniNot: string;
  notTuru: Record<NotTuru, string>;
  notYer: string;
  notUyari: string;
  notKaydet: string;
  notlarBos: string;
  karakter: string;
  sorunlar: string;
  sorunYok: string;
  sorunlaraGit: string;
  hata: Record<string, string>;
  /** Hazır WhatsApp mesajı — sıradaki adıma göre; TAMAM = kurulum bitti. */
  mesaj: AdimMetni & { TAMAM: string };
}

const tr: KurulumMetni = {
  baslik: 'Kurulum ve Başarı',
  alt: 'Her bayinin kurulumu nerede, sıradaki iş ne, bugün kimi arayacaksınız. Liste bayinin kendi kayıtlarından dolar; elle işaretlenmez.',
  kurulumda: 'Kurulumda',
  hazir: 'Hazır',
  ortancaGun: 'ortanca {n} günde hazır',
  ortancaYok: 'hazır günü henüz bilinmiyor',
  bugunAranacak: 'Bugün aranacak',
  sekme: { bugun: 'Bugün aranacaklar', kurulumda: 'Kurulumda', kullanimda: 'Kullanımda', hepsi: 'Hepsi' },
  benim: 'Benim bayilerim',
  bos: 'Bu listede bayi yok.',
  sutun: { bayi: 'Bayi', kurulum: 'Kurulum', sirada: 'Sıradaki iş', saglik: 'Sağlık', sorumlu: 'Sorumlu', sonNot: 'Son not', sonrakiTemas: 'Sonraki temas' },
  cihazSayisi: '{n} cihaz',
  zorunluSayi: '{n}/{t}',
  ayrinti: 'Ayrıntı',
  sorumluYok: 'Sorumlu yok',
  notYok: 'Not yok',
  tarihYok: 'Tarih yok',
  bugun: 'Bugün',
  gecti: 'Geçti',
  hepsiTamam: 'Kurulum tamam: kullanımı izleyin.',
  renk: { KIRMIZI: 'Acil', SARI: 'Dikkat', YESIL: 'Yolunda' },
  durum: { TAMAM: 'Tamam', KISMEN: 'Yarım', EKSIK: 'Eksik', UYGULANMAZ: 'Gerekmez' },
  ad: {
    FIRMA: 'Firma bilgisi',
    CIHAZ: 'Cihazlar',
    FIYAT: 'Fiyatlar',
    SAYAC: 'Sayaç okuma',
    FATURA: 'İlk fatura',
    EKIP: 'Ekip',
    FIS: 'Servis fişi',
    TARAYICI: 'Ağ tarayıcı',
    ARAC: 'Teknisyen aracı',
    SOZLESME: 'Sözleşmeler',
    WHATSAPP: 'WhatsApp hatırlatma',
    EFATURA: 'e-Fatura',
    PORTAL: 'Müşteri portalı',
  },
  sirada: {
    FIRMA: 'Firma bilgilerini (vergi no, adres, telefon) birlikte doldurun.',
    CIHAZ: 'Müşteri ve cihaz listesini yükleyin (Excel olur).',
    FIYAT: 'Kiralık cihazlara kira ya da sayfa fiyatını girin.',
    SAYAC: 'Kiralık cihazların sayaçlarını okutun.',
    FATURA: 'İlk müşteri faturasını birlikte kesin.',
    EKIP: 'Teknisyeni kullanıcı olarak ekleyin.',
    FIS: 'İlk servis fişini birlikte açın.',
    TARAYICI: 'Ağ tarayıcıyı kurun; sayaçlar kendiliğinden gelsin.',
    ARAC: 'Teknisyenin aracını depo olarak tanımlayın.',
    SOZLESME: 'Kira sözleşmelerini girin; bitişi yaklaşınca uyarı gelsin.',
    WHATSAPP: 'WhatsApp hatırlatmalarını açın.',
    EFATURA: 'e-Fatura bağlantısını kurun.',
    PORTAL: 'Bir müşteriye portal açın.',
  },
  nasil: {
    FIRMA: 'Bayi panelinde Ayarlar sayfası. Vergi no ve adres faturada yazar; eksikse fatura eksik çıkar.',
    CIHAZ: 'Veri Aktar sayfasında Excel dosyasını yükleyin; tek tek eklemek için Cihazlar sayfası.',
    FIYAT: 'Cihazlar sayfasında cihazı açın, aylık kira ya da siyah sayfa fiyatını yazın. Fiyatsız cihazın faturası çıkmaz.',
    SAYAC: 'Sayaç Turu sayfasından okumaları girin; cihaz e-postası ya da ağ tarayıcı varsa okumalar kendiliğinden gelir.',
    FATURA: 'Faturalar sayfasında dönem faturasını kesin. İlk fatura, bayinin ürünle para kazandığı ilk andır.',
    EKIP: 'Kullanıcılar sayfasında Yeni kullanıcı. Teknisyen telefondan fiş açar, sayaç girer.',
    FIS: 'Servis Fişleri sayfasında Yeni fiş. Arıza kaydı fişle tutulur.',
    TARAYICI: 'Ağ Tarayıcı sayfasından programı indirip bayinin ofis bilgisayarına kurun.',
    ARAC: 'Depolar sayfasında yeni depo, türü araç, teknisyeni seçin. Araçtaki parça ayrı sayılır.',
    SOZLESME: 'Sözleşmeler sayfasında müşteri, başlangıç ve bitiş tarihi.',
    WHATSAPP: 'WhatsApp sayfasında vade ya da sayaç hatırlatmasını açın. Bayi açmadıkça müşteriye mesaj gitmez.',
    EFATURA: 'e-Fatura sayfasında sağlayıcı bilgilerini girin. Test modu gerçek belge göndermez.',
    PORTAL: 'Müşteri Portalı sayfasında müşteriyi seçip portalı açın; müşteri sayacını ve faturasını kendisi görür.',
  },
  kanit: {
    FIRMA: '{n}/3 dolu: vergi no, adres, telefon',
    CIHAZ: '{n} cihaz, {kiralik} kiralık',
    FIYAT: '{n}/{toplam} kiralıkta fiyat var',
    SAYAC: '{n}/{toplam} kiralık son 35 günde okundu',
    FATURA: '{n} müşteri faturası',
    EKIP: '{n} teknisyen ya da ön büro kullanıcısı',
    FIS: 'Son 30 günde {n} fiş',
    TARAYICI: 'Son 30 günde {n} tarama',
    ARAC: '{n} araç',
    SOZLESME: '{n} aktif sözleşme',
    WHATSAPP: '',
    EFATURA: '',
    PORTAL: '{n} müşteride portal açık',
  },
  kanitUygulanmaz: 'Bu bayi için gerekmez (kiralık yok ya da Türkiye dışı).',
  sayacPay: 'okumaların %{pay} kadarı kendiliğinden geldi',
  sayacPayYok: 'kendiliğinden gelen pay bilinmiyor (okuma yok)',
  whatsappKanit: { TAMAM: 'Hatırlatma açık ya da numara bağlı', EKSIK: 'Hatırlatmalar kapalı' },
  eFaturaKanit: { TAMAM: 'Sağlayıcı bağlı', KISMEN: 'Yalnız test modu: gerçek belge gitmiyor', EKSIK: 'Bağlı değil' },
  saglik: {
    SESSIZ: '{gun} gündür bayiden hareket yok',
    SAYAC_DUSTU: 'Bu ay kiralıkların yalnız %{yuzde} kadarı okundu ({n}/{toplam})',
    FATURA_YOK: 'Bu ay henüz fatura kesilmedi (bugün ayın {gun}. günü)',
    DENEME_BITIYOR: 'Denemenin bitmesine {n} gün var, ödeme yok',
    ACIK_SORUN: '{n} açık sorun bildirimi',
  },
  saglikDurduran: '{n} açık sorun bildirimi, {durduran} tanesi işi durduruyor',
  denemeBitti: 'Deneme bitti, ödeme yok',
  saglikYesil: 'Şu an bir sorun görünmüyor.',
  geri: 'Listeye dön',
  iletisim: 'İletişim',
  yetkili: 'Yetkili',
  telefon: 'Telefon',
  eposta: 'E-posta',
  il: 'İl',
  acilis: 'Açılış',
  hazirOldu: '{n} günde hazır oldu',
  bilinmiyor: 'Bilinmiyor',
  ara: 'Ara',
  whatsapp: 'WhatsApp mesajı',
  whatsappYok: 'Cep telefonu yok: WhatsApp açılamaz.',
  mesajNotu: 'Mesaj sıradaki adıma göre hazır gelir; göndermeden önce okuyun. Tek tek gönderilir.',
  adimlar: 'Kurulum adımları',
  zorunlu: 'Zorunlu (Hazır için)',
  istegeBagli: 'İsteğe bağlı',
  nasilBaslik: 'Nasıl',
  sayfa: 'Bayinin açacağı sayfa',
  saglikBaslik: 'Sağlık',
  takip: 'Takip',
  sorumlu: 'Sorumlu',
  sonrakiTemas: 'Sonraki temas',
  kaydet: 'Kaydet',
  kaydedildi: 'Kaydedildi.',
  notlar: 'Notlar',
  yeniNot: 'Yeni not',
  notTuru: { ARAMA: 'Arama', ZIYARET: 'Ziyaret', NOT: 'Not' },
  notYer: 'Ne konuştunuz, ne sözleştiniz?',
  notUyari: 'Şifre ya da kart bilgisi yazmayın: notları bütün ekip görür.',
  notKaydet: 'Notu kaydet',
  notlarBos: 'Henüz not yok.',
  karakter: '{n}/{t}',
  sorunlar: '{n} açık sorun bildirimi',
  sorunYok: 'Açık sorun bildirimi yok.',
  sorunlaraGit: 'Sorunlara git',
  hata: {
    NOT_TURU: 'Not türünü seçin.',
    NOT_BOS: 'Not boş olamaz.',
    NOT_UZUN: 'Not en çok 1000 karakter olabilir.',
    NOT_KART: 'Notta kart numarasına benzeyen bir sayı var; silin.',
    TAKIP_GECERSIZ: 'Sorumlu ya da tarih okunamadı.',
    BAYI_YOK: 'Bayi bulunamadı.',
    SORUMLU_YOK: 'Bu sorumlu artık yok; listeden seçin.',
    OTURUM_YOK: 'Oturum kapanmış; yeniden giriş yapın.',
    GENEL: 'Kaydedilemedi; tekrar deneyin.',
  },
  mesaj: {
    FIRMA: 'Merhaba {ad}, Nextus Servis’te faturanızda yazacak vergi no ve adres bilgisi eksik. 5 dakikada birlikte dolduralım mı?',
    CIHAZ: 'Merhaba {ad}, müşteri ve cihaz listenizi (Excel de olur) birlikte yükleyelim mi? 10 dakika sürer.',
    FIYAT: 'Merhaba {ad}, kiralık cihazlarınızın kira ya da sayfa fiyatı eksik; fiyat girilmeyince fatura çıkmıyor. Birlikte girelim mi?',
    SAYAC: 'Merhaba {ad}, kiralık cihazlarınızın sayaçlarını okutunca faturanız kendiliğinden hazırlanıyor. İlk okumayı birlikte yapalım mı?',
    FATURA: 'Merhaba {ad}, cihaz ve sayaçlarınız hazır. İlk müşteri faturanızı birlikte keselim mi?',
    EKIP: 'Merhaba {ad}, teknisyeninizi de ekleyelim; fişi ve sayacı sahadan telefonla girsin. Uygun musunuz?',
    FIS: 'Merhaba {ad}, ilk servis fişinizi birlikte açalım mı? Arızalar artık tek yerde dursun.',
    TARAYICI: 'Merhaba {ad}, ağ tarayıcıyı kurarsak sayaçlar her ay kendiliğinden gelir. 10 dakikalık kurulum için uygun bir saat var mı?',
    ARAC: 'Merhaba {ad}, teknisyen aracındaki parçaları ayrı izlemek için aracı tanımlayalım mı?',
    SOZLESME: 'Merhaba {ad}, kira sözleşmelerinizi girersek bitişi yaklaşınca size haber verir. Birlikte girelim mi?',
    WHATSAPP: 'Merhaba {ad}, müşterilerinize vade ve sayaç hatırlatması WhatsApp’tan sizin adınıza gidebilir. Açmayı konuşalım mı?',
    EFATURA: 'Merhaba {ad}, e-Fatura bağlantınızı kurarsak faturalar doğrudan gider. Sağlayıcı bilgilerinizle birlikte kuralım mı?',
    PORTAL: 'Merhaba {ad}, müşterilerinize portal açarsanız sayaç ve faturalarını kendileri görür. Bir müşteriyle deneyelim mi?',
    TAMAM: 'Merhaba {ad}, kurulumunuz tamam. Nasıl gidiyor, takıldığınız bir yer var mı?',
  },
};

const en = {
  baslik: 'Setup and Success',
  alt: 'Where each dealer is in setup, what comes next, who to call today. The list fills from the dealer’s own records; nothing is ticked by hand.',
  kurulumda: 'In setup',
  hazir: 'Ready',
  ortancaGun: 'ready in a median of {n} {n|day|days}',
  ortancaYok: 'days to ready not known yet',
  bugunAranacak: 'Call today',
  sekme: { bugun: 'Call today', kurulumda: 'In setup', kullanimda: 'In use', hepsi: 'All' },
  benim: 'My dealers',
  bos: 'No dealers in this list.',
  sutun: { bayi: 'Dealer', kurulum: 'Setup', sirada: 'Next step', saglik: 'Health', sorumlu: 'Owner', sonNot: 'Last note', sonrakiTemas: 'Next contact' },
  cihazSayisi: '{n} {n|device|devices}',
  zorunluSayi: '{n} of {t}',
  ayrinti: 'Details',
  sorumluYok: 'No owner',
  notYok: 'No notes',
  tarihYok: 'No date',
  bugun: 'Today',
  gecti: 'Overdue',
  hepsiTamam: 'Setup complete: watch how they use it.',
  renk: { KIRMIZI: 'Urgent', SARI: 'Watch', YESIL: 'On track' },
  durum: { TAMAM: 'Done', KISMEN: 'Partly', EKSIK: 'Missing', UYGULANMAZ: 'Not needed' },
  ad: {
    FIRMA: 'Company details',
    CIHAZ: 'Devices',
    FIYAT: 'Prices',
    SAYAC: 'Meter readings',
    FATURA: 'First invoice',
    EKIP: 'Team',
    FIS: 'Service ticket',
    TARAYICI: 'Network scanner',
    ARAC: 'Technician van',
    SOZLESME: 'Contracts',
    WHATSAPP: 'WhatsApp reminders',
    EFATURA: 'e-Invoice',
    PORTAL: 'Customer portal',
  },
  sirada: {
    FIRMA: 'Fill in company details (tax number, address, phone) together.',
    CIHAZ: 'Load the customer and device list (Excel works).',
    FIYAT: 'Enter rent or page price on rental devices.',
    SAYAC: 'Get the rental devices’ meters read.',
    FATURA: 'Issue the first customer invoice together.',
    EKIP: 'Add the technician as a user.',
    FIS: 'Open the first service ticket together.',
    TARAYICI: 'Install the network scanner so readings arrive by themselves.',
    ARAC: 'Set up the technician’s van as a stock location.',
    SOZLESME: 'Enter rental contracts so an alert comes before they end.',
    WHATSAPP: 'Turn on WhatsApp reminders.',
    EFATURA: 'Connect e-invoicing.',
    PORTAL: 'Open the portal for one customer.',
  },
  nasil: {
    FIRMA: 'Settings page in the dealer panel. Tax number and address print on invoices; if missing, invoices are incomplete.',
    CIHAZ: 'Upload the Excel file on the Import page; to add one by one, use the Devices page.',
    FIYAT: 'Open the device on the Devices page, enter monthly rent or black page price. A device without a price is never invoiced.',
    SAYAC: 'Enter readings on the Meter Round page; with device e-mail or the network scanner, readings arrive by themselves.',
    FATURA: 'Issue the period invoice on the Invoices page. The first invoice is the first moment the dealer earns with the product.',
    EKIP: 'New user on the Users page. The technician opens tickets and enters meters from the phone.',
    FIS: 'New ticket on the Service Tickets page. Faults are tracked through tickets.',
    TARAYICI: 'Download the program on the Network Scanner page and install it on the dealer’s office computer.',
    ARAC: 'New location on the Stock Locations page, type van, pick the technician. Parts in the van are counted separately.',
    SOZLESME: 'Customer, start and end date on the Contracts page.',
    WHATSAPP: 'Turn on due-date or meter reminders on the WhatsApp page. Nothing reaches customers until the dealer turns it on.',
    EFATURA: 'Enter provider details on the e-Invoice page. Test mode sends no real document.',
    PORTAL: 'Pick a customer on the Customer Portal page and open the portal; the customer sees their meters and invoices.',
  },
  kanit: {
    FIRMA: '{n} of 3 filled: tax number, address, phone',
    CIHAZ: '{n} {n|device|devices}, {kiralik} rental',
    FIYAT: '{n} of {toplam} rentals have a price',
    SAYAC: '{n} of {toplam} rentals read in the last 35 days',
    FATURA: '{n} customer {n|invoice|invoices}',
    EKIP: '{n} technician or front desk {n|user|users}',
    FIS: '{n} {n|ticket|tickets} in the last 30 days',
    TARAYICI: '{n} {n|scan|scans} in the last 30 days',
    ARAC: '{n} {n|van|vans}',
    SOZLESME: '{n} active {n|contract|contracts}',
    WHATSAPP: '',
    EFATURA: '',
    PORTAL: 'Portal open for {n} {n|customer|customers}',
  },
  kanitUygulanmaz: 'Not needed for this dealer (no rentals, or outside Turkey).',
  sayacPay: '{pay}% of readings arrived by themselves',
  sayacPayYok: 'share arriving by themselves unknown (no readings)',
  whatsappKanit: { TAMAM: 'A reminder is on or a number is connected', EKSIK: 'Reminders are off' },
  eFaturaKanit: { TAMAM: 'Provider connected', KISMEN: 'Test mode only: no real document is sent', EKSIK: 'Not connected' },
  saglik: {
    SESSIZ: 'No activity from the dealer for {gun} {gun|day|days}',
    SAYAC_DUSTU: 'Only {yuzde}% of rentals read this month ({n} of {toplam})',
    FATURA_YOK: 'No invoice issued this month yet (today is day {gun})',
    DENEME_BITIYOR: '{n} {n|day|days} left in trial, no payment',
    ACIK_SORUN: '{n} open problem {n|report|reports}',
  },
  saglikDurduran: '{n} open problem {n|report|reports}, {durduran} blocking work',
  denemeBitti: 'Trial ended, no payment',
  saglikYesil: 'No problem showing right now.',
  geri: 'Back to list',
  iletisim: 'Contact',
  yetkili: 'Contact person',
  telefon: 'Phone',
  eposta: 'E-mail',
  il: 'City',
  acilis: 'Opened',
  hazirOldu: 'Ready in {n} {n|day|days}',
  bilinmiyor: 'Unknown',
  ara: 'Call',
  whatsapp: 'WhatsApp message',
  whatsappYok: 'No mobile number: WhatsApp cannot open.',
  mesajNotu: 'The message is drafted from the next step; read it before sending. Sent one by one.',
  adimlar: 'Setup steps',
  zorunlu: 'Required (for Ready)',
  istegeBagli: 'Optional',
  nasilBaslik: 'How',
  sayfa: 'Page the dealer opens',
  saglikBaslik: 'Health',
  takip: 'Follow-up',
  sorumlu: 'Owner',
  sonrakiTemas: 'Next contact',
  kaydet: 'Save',
  kaydedildi: 'Saved.',
  notlar: 'Notes',
  yeniNot: 'New note',
  notTuru: { ARAMA: 'Call', ZIYARET: 'Visit', NOT: 'Note' },
  notYer: 'What did you talk about, what was agreed?',
  notUyari: 'Do not write passwords or card details: the whole team sees notes.',
  notKaydet: 'Save note',
  notlarBos: 'No notes yet.',
  karakter: '{n} of {t}',
  sorunlar: '{n} open problem {n|report|reports}',
  sorunYok: 'No open problem reports.',
  sorunlaraGit: 'Go to problems',
  hata: {
    NOT_TURU: 'Pick a note type.',
    NOT_BOS: 'The note cannot be empty.',
    NOT_UZUN: 'A note can be at most 1000 characters.',
    NOT_KART: 'The note has a number that looks like a card number; remove it.',
    TAKIP_GECERSIZ: 'Owner or date could not be read.',
    BAYI_YOK: 'Dealer not found.',
    SORUMLU_YOK: 'This owner no longer exists; pick from the list.',
    OTURUM_YOK: 'Session ended; sign in again.',
    GENEL: 'Could not save; try again.',
  },
  mesaj: {
    FIRMA: 'Hello {ad}, the tax number and address that print on your Nextus Servis invoices are missing. Shall we fill them in together in 5 minutes?',
    CIHAZ: 'Hello {ad}, shall we load your customer and device list (Excel works) together? It takes 10 minutes.',
    FIYAT: 'Hello {ad}, rent or page prices are missing on your rental devices; without a price no invoice is produced. Shall we enter them together?',
    SAYAC: 'Hello {ad}, once your rental meters are read, your invoice is prepared by itself. Shall we do the first reading together?',
    FATURA: 'Hello {ad}, your devices and meters are ready. Shall we issue your first customer invoice together?',
    EKIP: 'Hello {ad}, let us add your technician so tickets and meters are entered from the field by phone. Does that suit you?',
    FIS: 'Hello {ad}, shall we open your first service ticket together? All faults in one place from now on.',
    TARAYICI: 'Hello {ad}, with the network scanner installed, meters arrive every month by themselves. Is there a good time for a 10-minute setup?',
    ARAC: 'Hello {ad}, shall we set up your technician’s van to track the parts in it separately?',
    SOZLESME: 'Hello {ad}, if we enter your rental contracts you get a heads-up before they end. Shall we enter them together?',
    WHATSAPP: 'Hello {ad}, due-date and meter reminders can go to your customers on WhatsApp in your name. Shall we talk about turning them on?',
    EFATURA: 'Hello {ad}, with e-invoicing connected, invoices go out directly. Shall we set it up together with your provider details?',
    PORTAL: 'Hello {ad}, with a portal your customers see their meters and invoices themselves. Shall we try it with one customer?',
    TAMAM: 'Hello {ad}, your setup is complete. How is it going, anything you are stuck on?',
  },
} satisfies KurulumMetni;

export function kurulumMetni(dil: string | null | undefined): KurulumMetni {
  return dil === 'en' ? en : tr;
}

/** Adımın kanıt cümlesi (sayılarla). */
export function kanitCumlesi(m: KurulumMetni, a: Adim): string {
  if (a.durum === 'UYGULANMAZ') return m.kanitUygulanmaz;
  if (a.kod === 'WHATSAPP') return a.durum === 'TAMAM' ? m.whatsappKanit.TAMAM : m.whatsappKanit.EKSIK;
  if (a.kod === 'EFATURA') return a.durum === 'TAMAM' ? m.eFaturaKanit.TAMAM : a.durum === 'KISMEN' ? m.eFaturaKanit.KISMEN : m.eFaturaKanit.EKSIK;
  const ana = doldur(m.kanit[a.kod], a.kanit);
  if (a.kod !== 'SAYAC') return ana;
  // Pay -1 = okuma yok: "%0" yazmak yalan olur, "bilinmiyor" denir.
  return `${ana} · ${a.kanit.pay < 0 ? m.sayacPayYok : doldur(m.sayacPay, a.kanit)}`;
}

/** Sağlık nedeninin cümlesi. */
export function saglikCumlesi(m: KurulumMetni, n: SaglikNedeni): string {
  if (n.kod === 'ACIK_SORUN' && n.deger.durduran > 0) return doldur(m.saglikDurduran, n.deger);
  if (n.kod === 'DENEME_BITIYOR' && n.deger.n <= 0) return m.denemeBitti;
  return doldur(m.saglik[n.kod], n.deger);
}

/** Hazır WhatsApp mesajı: sıradaki adıma göre, kişinin ilk adıyla. */
export function mesajMetni(m: KurulumMetni, o: { yetkili: string | null; firma: string; sonraki: AdimKodu | null }): string {
  const ad = (o.yetkili || o.firma).trim().split(/\s+/)[0] ?? '';
  return doldur(o.sonraki ? m.mesaj[o.sonraki] : m.mesaj.TAMAM, { ad });
}
