/**
 * "BUGÜN KİMİ ARAMALI" metinleri — TR/EN. Ana sözlükte değil, burada: bu
 * ekran kendi başına duruyor ve sözlük dosyaları aynı anda başka işlerde
 * değişiyor. İki dil aynı anahtarları taşımak ZORUNDA (`satisfies`).
 */
const tr = {
  menu: 'Bugün kimi aramalı',
  baslik: 'Bugün kimi aramalı',
  alt: 'Deneme hesapları, en çok dokunuşa ihtiyacı olandan başlayarak. Değer gören bayi satın alır: hedef, her hesapta Kaçan Gelir’de bayinin kendi rakamının çıkması.',
  sadeceToplanti: 'Yalnız toplantıdan gelenler',
  hepsi: 'Bütün deneme hesapları',
  odeyenlerDahil: 'Ödeyenler dahil',
  bos: 'Şu an aranacak deneme hesabı yok.',
  adimlar: ['Hesap açtı', 'Giriş yaptı', 'Cihaz girdi', 'Sayaç okuttu', 'Ekip/iş', 'Ödedi'],
  sutunFirma: 'Bayi',
  sutunAdim: 'Nerede',
  sutunNeden: 'Bugün neden',
  sutunAra: 'Ara',
  denemeBitti: 'Deneme bitti',
  denemeKalan: 'Denemenin bitmesine {n} gün',
  sonHareket: 'Son hareket {t}',
  hareketYok: 'Hiç hareket yok',
  toplanti: 'Toplantı',
  sayilar: '{m} müşteri · {c} cihaz · {s} okuma · {k} kullanıcı',
  neden: {
    BITIYOR_HAZIR: 'Deneme bitiyor ve rakamı var: Kaçan Gelir’i birlikte açın, paketi konuşun.',
    BITIYOR_EKSIK: 'Deneme bitiyor ama kurulum eksik: kurulumu bugün bitirin, süreyi konuşun.',
    SICAK: 'Değeri gördü (sayaç ve ekip var): ödeme ve paket görüşmesi.',
    GIRIS_YOK: 'Hesap açıldı, hiç giriş yok: hoş geldin araması.',
    CIHAZ_YOK: 'Giriş var, cihaz yok: müşteri ve cihaz listesini birlikte yükleyin.',
    SAYAC_YOK: 'Cihaz var, sayaç yok: ilk okumayı ya da ağ tarayıcıyı birlikte kurun.',
    EKIP_YOK: 'Rakam çıkabilir: Kaçan Gelir’i birlikte açın, teknisyeni ekleyin.',
    SESSIZ: '5 günden uzun süredir hareket yok: nerede takıldığını sorun.',
    YENI: 'Bugün açıldı: ilk 48 saat içinde arayın.',
    ODEDI: 'Ödeyen bayi: referans ve tanıştırma isteyin.',
  },
  mesaj: {
    GIRIS_YOK: 'Merhaba {ad}, Nextus Servis hesabınız açık. Müşteri ve cihaz listenizi 10 dakikada birlikte yükleyelim mi? Bugün uygun olduğunuz bir saat var mı?',
    CIHAZ_YOK: 'Merhaba {ad}, Nextus Servis’e giriş yaptığınızı gördüm. Müşteri ve cihaz listenizi (Excel de olur) birlikte yükleyelim; 10 dakika sürer. Ne zaman uygunsunuz?',
    SAYAC_YOK: 'Merhaba {ad}, cihazlarınız sisteme girmiş. Sayaçları okutunca Kaçan Gelir ekranında sizin rakamınız çıkıyor; ilk okumayı birlikte yapalım mı?',
    EKIP_YOK: 'Merhaba {ad}, sayaçlarınız girildi. Kaçan Gelir ekranında sizin rakamınıza birlikte bakalım mı? Teknisyeninizi de ekleyelim, işleri sahadan kapatsın.',
    SICAK: 'Merhaba {ad}, Nextus Servis’i birkaç gündür kullanıyorsunuz. Kaçan Gelir’de çıkan rakamı ve size uyan paketi 5 dakikada konuşalım mı?',
    BITIYOR: 'Merhaba {ad}, deneme süreniz {n} gün sonra bitiyor. Bugüne kadar çıkan rakamlara birlikte bakıp devam edip etmeyeceğinize karar verelim mi?',
    ODEDI: 'Merhaba {ad}, Nextus Servis’i kullandığınız için teşekkürler. Çevrenizde bu işi yapan bir bayiyle tanıştırabilir misiniz?',
  },
};

const en = {
  menu: 'Who to call today',
  baslik: 'Who to call today',
  alt: 'Trial accounts, starting with the ones that need a touch most. A dealer who sees value buys: the goal is every account seeing its own number in Missed Revenue.',
  sadeceToplanti: 'Event sign-ups only',
  hepsi: 'All trial accounts',
  odeyenlerDahil: 'Include paying',
  bos: 'No trial account to call right now.',
  adimlar: ['Signed up', 'Logged in', 'Added devices', 'Read counters', 'Team/jobs', 'Paid'],
  sutunFirma: 'Dealer',
  sutunAdim: 'Progress',
  sutunNeden: 'Why today',
  sutunAra: 'Call',
  denemeBitti: 'Trial ended',
  denemeKalan: '{n} days left in trial',
  sonHareket: 'Last activity {t}',
  hareketYok: 'No activity',
  toplanti: 'Event',
  sayilar: '{m} customers · {c} devices · {s} readings · {k} users',
  neden: {
    BITIYOR_HAZIR: 'Trial ending and it has a number: open Missed Revenue together, discuss the plan.',
    BITIYOR_EKSIK: 'Trial ending but setup incomplete: finish setup today, discuss timing.',
    SICAK: 'Saw the value (counters and team): talk payment and plan.',
    GIRIS_YOK: 'Account opened, never logged in: welcome call.',
    CIHAZ_YOK: 'Logged in, no devices: load customers and devices together.',
    SAYAC_YOK: 'Devices in, no counters: do the first reading or set up the network scanner together.',
    EKIP_YOK: 'A number can show: open Missed Revenue together, add the technician.',
    SESSIZ: 'No activity for over 5 days: ask where they got stuck.',
    YENI: 'Opened today: call within the first 48 hours.',
    ODEDI: 'Paying dealer: ask for a reference and an introduction.',
  },
  mesaj: {
    GIRIS_YOK: 'Hello {ad}, your Nextus Servis account is open. Shall we load your customers and devices together in 10 minutes? Is there a good time today?',
    CIHAZ_YOK: 'Hello {ad}, I saw you logged in to Nextus Servis. Let us load your customer and device list (Excel works) together; it takes 10 minutes. When suits you?',
    SAYAC_YOK: 'Hello {ad}, your devices are in. Once counters are read, Missed Revenue shows your own number; shall we do the first reading together?',
    EKIP_YOK: 'Hello {ad}, your counters are in. Shall we look at your number in Missed Revenue together? Let us also add your technician so jobs close from the field.',
    SICAK: 'Hello {ad}, you have been using Nextus Servis for a few days. Shall we take 5 minutes to go over your Missed Revenue number and the plan that fits you?',
    BITIYOR: 'Hello {ad}, your trial ends in {n} days. Shall we look at the numbers so far together and decide whether to continue?',
    ODEDI: 'Hello {ad}, thank you for using Nextus Servis. Could you introduce us to another dealer around you doing this work?',
  },
} satisfies {
  [K in keyof typeof tr]: (typeof tr)[K] extends string
    ? string
    : (typeof tr)[K] extends string[]
      ? string[]
      : { [J in keyof (typeof tr)[K]]: string };
};

export type AktivasyonMetni = typeof tr;
export function aktivasyonMetni(dil: string | null | undefined): AktivasyonMetni {
  return (dil === 'en' ? en : tr) as AktivasyonMetni;
}
