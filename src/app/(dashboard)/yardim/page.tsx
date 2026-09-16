'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Section { id: string; icon: string; title: string; intro?: string; steps: string[]; tip?: string }

const SECTIONS: Section[] = [
  {
    id: 'musteri', icon: '👤', title: 'Müşteri ekleme (ve Excel’den toplu aktarma)',
    steps: [
      'Tek tek: Sol menü → Müşteriler → “＋ Yeni Müşteri”. Ad ve telefon zorunlu.',
      'TOPLU: Elinde müşteri/cihaz listesi varsa → Gelişmiş → Veri Aktarma → “Excel / CSV listesi”.',
      'Excel’de: Dosya → Farklı Kaydet → “CSV UTF-8”. Sonra dosyayı seç — kolonları sistem kendi tanır.',
      'Önizlemede ilk satırları kontrol et, yanlış eşleşen kolon varsa açılır menüden düzelt → Aktar.',
      'Aynı telefon/seri no zaten varsa güncellenir, kopyası oluşmaz — tekrar çalıştırmak güvenlidir.',
    ],
    tip: 'Adresi düzgün girersen müşteri kartındaki “Yol Tarifi” tek dokunuşla navigasyon başlatır.',
  },
  {
    id: 'goc', icon: '📦', title: 'Başka programdan taşınma (sayaç geçmişi dahil)',
    steps: [
      'SIRA ÖNEMLİ: önce müşteri/cihaz listesi, SONRA sayaç geçmişi. Cihaz yoksa seri no eşleşmez, sayaç satırları atlanır.',
      '1) Gelişmiş → Veri Aktarma → “Excel / CSV listesi” ile müşteri ve cihazları aktar.',
      '2) Aynı ekranda “Sayaç geçmişi” sekmesi → eski programdan çıkardığın okuma dosyasını yükle.',
      '3) “Açılış / borç devri” sekmesi → müşterilerin göç anındaki borcu. Bu olmadan ilk gün herkes ₺0 borçlu görünür ve Muhasebe ekranına güvenemezsin.',
      'Borç devrinde İKİ yol var: sadece bakiye (müşteri başına tek rakam) ya da fatura fatura. Bir müşteri için yalnız BİRİNİ kullan — ikisi de aynı borcu anlatır, ikisi birden yüklenirse borç iki katı görünür.',
      'Eksi bakiye yazabilirsin: peşin ödemiş müşteri alacaklı olarak kaydedilir.',
      'Gereken kolonlar: Seri No · Tarih · Siyah Sayaç (Renkli varsa ekle). Önizleme hiçbir şey yazmaz, önce ona bak.',
      'Aktarılan okumalar FATURALANMIŞ yazılır ve tutar üretmez — o sayfalar eski programda zaten faturalandı, müşteriye ikinci kez gitmesin.',
      'Yalnız cihazın mevcut en eski okumasından ÖNCESİ alınır; yazılmış farklar geriye dönük değişmez.',
    ],
    tip: 'Sayaç geçmişini aktarmazsan taşındığın ayın sayfaları kaybolur: fark her zaman bir önceki okumaya göre hesaplanır, geçmiş yoksa ilk okumanın farkı sıfır çıkar. Borç devri de GELİR YAZMAZ — devreden bakiyedir, satış değil; göç ayının cirosunu şişirmez.',
  },
  {
    id: 'disa-aktar', icon: '⬇️', title: 'Listeni Excel olarak indirme',
    steps: [
      'Müşteriler · Cihazlar · Servis Fişleri · Muhasebe — dördünün de sayfa başında “⬇️ Excel (CSV)” var.',
      'Müşteri dosyasında borç, fatura yolu (e-Fatura/e-Arşiv) ve eksik fatura bilgileri de yazar.',
      'Cihaz dosyasında sayaç, kira, dahil sayfa ve birim fiyatlar var — sayıma ya da sigortaya bunu ver.',
      'Muhasebedeki dosya “kim ne kadar borçlu” sorusunu kapatır; rakam ekrandakiyle aynıdır.',
      'Dosyalar Türkçe Excel biçiminde açılır (noktalı virgül, ondalık virgül) — çift tıklayıp açabilirsin.',
    ],
    tip: 'Hiç okunmamış cihazın sayaç hücresi BOŞ gelir, sıfır değil. Sıfır yazsaydık o cihaz geri yüklendiğinde bir sonraki fatura aradaki sayfaları kaybederdi.',
  },
  {
    id: 'cihaz', icon: '🖨️', title: 'Cihaz ekleme + kiralama ayarları',
    steps: [
      'Müşteri detayı ya da Cihazlar → “＋ Yeni Cihaz”. Marka, model, seri no gir.',
      'Kiralıksa “Kiralık” işaretle → aylık kira + sayfa fiyatlarını gir. Pakete dahil sayfa varsa “dahil” alanlarına yaz (yalnız aşan sayfa faturalanır).',
      'KONUM (kat/oda) yaz — sayaç turu ve cihaz dökümü bu sıraya göre dizilir, saha işini çok kolaylaştırır.',
      'Cihaza otomatik QR üretilir; “QR Kod” ile basıp makineye yapıştırabilirsin.',
    ],
  },
  {
    id: 'fis', icon: '🧾', title: 'Servis fişi açma (günlük ana iş)',
    steps: [
      'Servis Fişleri → “＋ Yeni Fiş” (telefonda: alttaki ＋ → Yeni Servis Fişi).',
      'Müşteri + cihaz seç, arızayı yaz.',
      'Kullanılan parçaları ekle — barkod okuyucun varsa parçayı okut, otomatik bulunur ve stoktan düşer.',
      'İş bitince durumu “Teslim Edildi” yap. Fiş tutarı otomatik olarak müşterinin cari hesabına borç yazılır.',
      '“🖨️ Yazdır” ile müşteriye imzalı fiş çıktısı verebilirsin.',
    ],
    tip: 'Durumu 3 gündür değişmeyen fişler ana ekranda “Duran İşler” olarak turuncu görünür — müşteri beklemede kalmaz.',
  },
  {
    id: 'sayac', icon: '🔢', title: 'Sayaç okuma — “Sayaç Turu” ile toplu',
    intro: 'Kiralık cihazın parası sayaçtan çıkar. Ayda bir okumak yeterli.',
    steps: [
      'Sol menü → Sayaç Turu → müşteriyi seç.',
      'O müşterinin TÜM kiralık cihazları kat/oda sırasına dizili tek listede çıkar.',
      'Her cihaz için yalnızca YENİ rakamı yaz — fark (kaç sayfa çekilmiş) anında görünür.',
      'Altta “12/60 okundu” yazar; “Kaydet”e bas, hepsi tek seferde işlenir.',
      'Sayaç önceki değerden düşükse satır kırmızı kalır ve SEBEBİ sorulur: “cihaz değişti” mi, “aynı makine, sayacı sıfırlandı” mı? İkisi farklı para demek — cihaz değiştiyse o ayın farkı sıfırdır, sayaç sıfırlandıysa okunan değer faturalanır. Emin değilsen birincisini seç.',
    ],
    tip: 'Cihaz dökümünü “sayaç sütunu boş” yazdırıp kâğıtla gezebilir, sonra sisteme girebilirsin.',
  },
  {
    id: 'cihazdan-sayac', icon: '📡', title: 'Cihazdan Sayaç — makine sayacı kendi göndersin',
    intro: 'Sayaç turuna hiç çıkmadan sayaçların düşmesi. Çoğu fotokopi/yazıcı, sayaç raporunu ayın belirli günü e-postayla gönderebiliyor.',
    steps: [
      'Ayarlar → “Sayaç” bölümündeki adresi kopyala. Adres SANA ÖZELDİR (içindeki kod firmanı söyler) — başka bayiyle paylaşma.',
      'Cihazın web arayüzüne gir (tarayıcıya cihazın IP’sini yaz) → e-posta / bildirim ayarları → sayaç raporu alıcısı olarak bu adresi gir, gönderim gününü ayın 1’i yap.',
      'Kyocera Fleet Services (KFS) kullanıyorsan cihazlara TEK TEK girmene gerek yok: KFS konsolunda tek bir zamanlanmış rapor kurulur, “Groups → All accessible” ile bütün müşterilerin tek dosyaya girer.',
      'Rapor gelince sayaç kendiliğinden düşer. Seri numarası eşleşmeyenler “Cihazdan Sayaç” ekranında seni bekler — cihazı bir kez elle seçersin, sistem o seriyi ÖĞRENİR ve sonraki aylar otomatik akar.',
      'Aynı rapor iki kez gelirse ikinci okuma yazılmaz; çift faturalama olmaz.',
    ],
    tip: 'Bu kanal kurulunca sayaç turu yalnız kurulumu olmayan cihazlar için kalır. Kurulum cihaz başına ~3 dakika, ofis başına bir kez.',
  },
  {
    id: 'sayac-uyarilari', icon: '🚨', title: 'Sayaç uyarıları — sistem sana ne söylüyor',
    intro: 'Kiralamada para sessizce kaybolur. Sistem beş ayrı sinyali ayrı ayrı söyler; hangisini gördüğün, ne yapacağını belirler.',
    steps: [
      'KANAL DURDU (Sayaç Turu, en üstte, koyu kırmızı): hiçbir cihazdan rapor gelmiyor. Müşterileri arama — önce kendi kurulumunu kontrol et.',
      'SAYACI GELMİYOR (kırmızı): o cihazdan 35+ gündür okuma yok. Okunmayan makineden o ay para kazanılmaz.',
      'SAYAÇ GELİYOR AMA ARTMIYOR (sarı): kira kesiliyor, makine basmıyor. Ya kullanılmıyor (yenilemede iptal gelir), ya bozuk, ya başka ofise taşınmış. Müşteriyi ARA.',
      'ŞÜPHELİ OKUMA (Kaçan Gelir, faturala düğmesinin yanında): rakam cihazın kendi geçmişine uymuyor. Faturalamadan önce kontrol et — yanlış fatura, yanlış rakamdan pahalıdır.',
      'FATURA ŞOKU (cihaz satırında): rakam DOĞRU ama fatura müşteriyi şaşırtacak. Göndermeden önce ara; çoğu zaman paketi büyütme fırsatıdır.',
    ],
    tip: 'Hiçbiri faturayı durdurmaz — karar senin. Sistem sessizce para tutmaz, sadece bakmanı ister.',
  },
  {
    id: 'portal', icon: '🔗', title: 'Müşteri Paneli — müşteri kendi sayfasını görsün',
    intro: 'Müşterin şifresiz bir bağlantıyla kendi cihazlarını, sayaçlarını ve onlara uyan sarf malzemesini görür.',
    steps: [
      'Sol menü → Müşteri Paneli → “Erişimi olmayan” listesinden müşteriyi seç, bağlantısını oluştur.',
      'Bağlantıyı WhatsApp’tan gönder (cep numarası kayıtlıysa tek tuş).',
      'Müşteri o sayfadan sayacını kendi girebilir; senin onayınla sisteme işlenir.',
      'Mağazan varsa aynı bağlantıdan toner/sarf siparişi de verebilir.',
    ],
    tip: 'Sayaç turuna çıkamadığın küçük müşterilerde en ucuz yol budur: okuma müşteriden gelir, onay sende kalır.',
  },
  {
    id: 'toner', icon: '🧴', title: 'Toner Verimi — tonerin ne zaman biteceğini bil',
    intro: 'Verimi artık YAZMANA GEREK YOK — sistem ölçüyor. Fişe toner eklediğin her seferde, bir önceki değişimden bu yana kaç sayfa basıldığını hesaplıyor. O sayı, o modelin sahadaki gerçek verimi.',
    steps: [
      'Teknisyen fişe toneri ekler. Parça adı rengi söylemiyorsa ve cihaz renkli basıyorsa ekranda tek dokunuşluk soru çıkar: S/B mi, Renkli mi. Başka bir iş yok.',
      'İKİNCİ toner değişiminde ölçüm çıkar: “7.200 sayfa ölçüldü”. O andan itibaren tükenme tahmini o cihazda çalışır.',
      'Aynı modelin iki ayrı cihazından ölçüm gelince, o modeldeki HİÇ toneri değişmemiş cihazlar da açılır.',
      'Sarf Takibi ekranında her satırın altında sayının nereden geldiği yazar: “Bu cihazda ölçüldü (3 toner)” / “Aynı modelde ölçüldü (6 toner)”.',
      'Toner Verimi ekranında ölçülen değerler yeşil görünür; “forma yaz” ile sabitleyebilirsin. Elle girdiğin sayı ölçümü her zaman yener.',
    ],
    tip: 'Ölçüm yoksa tahmin HİÇ üretilmez — uydurma verim, “toneriniz bitmek üzere” deyip yanılmak demek. Ölçüm hataları da eleniyor: 100 sayfanın altı (toner boşalmadan değişmiş) ve 200.000’in üstü (sayaç sıfırlanmış) sayılmıyor, ve ortalama değil ORTANCA kullanılıyor — sıkışma yüzünden erken değişen tek bir kartuş rakamı bozmasın.',
  },
  {
    id: 'sozlesme', icon: '📜', title: 'Sözleşmeler — kâğıtta yazanla sistemi karşılaştır',
    steps: [
      'Sol menü → Sözleşmeler → “＋ Yeni Sözleşme”. Müşteriyi seç, tarihleri gir, kapsanan cihazları işaretle.',
      'Şartlar cihazın MEVCUT ayarından dolar. Sen yalnız kâğıttan FARKLI olanları düzeltirsin — sıfırdan doldurmazsın.',
      'Fesih ihbar süresini gir: sözleşme bitmeden bu kadar gün önce haber verilmezse kendiliğinden uzar. Ekran o günü ayrıca gösterir.',
      'Zam aralığını gir (örn. 12 ay). Zamanı gelince ekran söyler; “Zammı uygula” Toplu Zam ekranını o müşteriyle açar.',
      'Ekranın üstündeki dört kart: uymayan fiyat · zam zamanı · bitiş/ihbar · sözleşmesiz makine. Tıklayınca listeyi süzer.',
      'Fark varsa “Sisteme uygula” cihazın ayarını sözleşmedeki hâline getirir — tek tıkla, elle kopyalamadan.',
    ],
    tip: 'Ekran hem “eksik faturalıyorsun” hem “FAZLA faturalıyorsun” der. İkincisi de önemli: müşteri bir gün fark ederse parayı iade edersin. Sözleşme yanlış girildiyse cihazı değil SÖZLEŞMEYİ düzelt.',
  },
  {
    id: 'karlilik', icon: '📈', title: 'Sözleşme kârlılığı — yenileme görüşmesine rakamla otur',
    intro: 'Hangi sözleşme ne kazandırıyor, ve hedef marj için fiyat ne olmalı. “Zam lazım” demekle “bu sözleşme %8 marjla çalışıyor, %25 için kira ₺1.500 değil ₺2.180 olmalı” demek aynı şey değil.',
    steps: [
      'Sol menü → Sözleşmeler → “Kârlılık ve fiyat kararı”.',
      'Ekranın üstüne iki şey gir: ziyaret başı maliyetin ve hedef marjın. İkisi de senin bildiğin sayılar; biz uydurmuyoruz.',
      'Liste en düşük marj başta sıralanır — ilk bakacağın yer orası.',
      'Her satırda aylık gelir, aylık maliyet ve marj yazar. Hedefin altındaysa “%25 marj için kira ₺X → ₺Y” cümlesi çıkar; müşteriye söyleyeceğin rakam odur.',
      'Sayfa başı toner maliyetin müşteriden aldığın sayfa fiyatını aşıyorsa kırmızı uyarı çıkar: her basılan sayfada para kaybediyorsun ve hacim arttıkça zarar da artıyor.',
    ],
    tip: 'Ziyaret maliyetini girmezsen işçilik hesaba KATILMAZ ve ekran bunu yazar — saat ücretini uydurmaktansa eksik ama dürüst bir marj göstermeyi seçtik. Aynı şekilde hiç maliyet kaydı olmayan sözleşme %100 marj gösterir; o kârlılık değil kayıt eksikliğidir ve satırda öyle yazar.',
  },
  {
    id: 'alis', icon: '🧾', title: 'Parça alışı — aynı toneri üç yerden farklı fiyata alıyorsan',
    intro: 'Stok listesindeki “alış fiyatı” tek bir sayı ve elindekinin gerçek maliyetini vermiyor. Her alışı ayrı kaydedersen sistem ağırlıklı ortalamayı kendisi tutuyor.',
    steps: [
      'Sol menü → Stok → “Alış Gir”. Parçayı seç, adet ve birim alış fiyatını yaz, tedarikçiyi gir.',
      'Kaydedince stok artar ve ortalama maliyet güncellenir: “₺480 → ₺500” diye gösterir.',
      'Aynı parçayı kimden kaça aldığın alt alta listelenir, en ucuz üstte. “Hep buradan alıyorum” cümlesinin doğru olup olmadığı ancak yan yana konunca görünür.',
      'Fişe parça eklendiğinde O GÜNÜN maliyeti fişin içine yazılır. Sonraki alışlar geçmiş kârlılığı değiştirmez.',
    ],
    tip: 'Ortalama şöyle hesaplanır: (eski stok × eski ortalama + adet × birim alış) ÷ (eski stok + adet). Parça KULLANMAK ortalamayı değiştirmez. Alış fiyatı hiç girilmemiş parça sıfır maliyetli sayılmaz — “Maliyeti Girilmemiş” kartında sayısı yazar, çünkü sıfır maliyet kârlılığı olduğundan yüksek gösterir.',
  },
  {
    id: 'teklif', icon: '📝', title: 'Teklif — aday müşteriye fiyat çıkarma',
    intro: 'Aday müşterinin makinelerini ve ŞU AN ödediğini gir; sistem onun sayfa başı maliyetini çıkarsın, seninkini ölçümden hesaplasın, hedef marjına göre fiyat önersin.',
    steps: [
      'Sol menü → Teklifler → “＋ Yeni Teklif”. Firma adını yaz, teklif açılır.',
      'Her makine için: marka, model, adet, aylık sayfa ve müşterinin o makineye şu an ödediği tutar. “Kaydet ve hesapla”.',
      'Ölçülmüş modelde fiyat kendiliğinden çıkar. Ölçülmemişse satır “bu modelin sayfa maliyeti henüz ölçülmedi” der ve fiyatı sen yazarsın.',
      '“Müşteri çıktısı” düğmesi ayrı bir sayfa açar: orada maliyet de marj da YOK, olduğu gibi müşteriye verilebilir.',
      'Teklifi Gönderildi/Kazanıldı/Kaybedildi olarak işaretle; liste hangi kapının açık kaldığını gösterir.',
    ],
    tip: 'Bir makinede bile müşterinin bugünkü ödemesi girilmemişse TOPLAM TASARRUF rakamı hiç gösterilmez — eksik veriden çıkan bir tasarruf vaadi, tutamayacağın bir sözdür. Ayrıca hesap yalnız SARF maliyetini kapsar; müşteri çıktısında “servis işçiliği dahil” yazdığı için servis payını fiyata sen eklemelisin.',
  },
  {
    id: 'fatura', icon: '📄', title: 'Faturalama (ay sonu)',
    steps: [
      'Gelişmiş → Faturalar → “⚡ Bu Dönemi Faturala”.',
      'ÖNCE KONTROL: Sistem “şu 5 cihazın sayacı okunmadı” diye uyarır — eksik aşım faturası gitmesin.',
      'İstersen “Önce sayaçları oku” ile Sayaç Turu’na gidersin, ya da “Yine de faturala” dersin.',
      'Sayaç + kira + ödenmemiş servis TEK faturada birleşir.',
      'Faturanın arkasına otomatik SAYAÇ EKİ eklenir: her cihazın önceki → yeni sayacı, çekilen sayfa, aşım ve tutar. Müşteri “niye bu kadar?” diye sormaz.',
    ],
  },
  {
    id: 'e-fatura', icon: '🧾', title: 'e-Fatura hazırlığı (eksikleri şimdi kapat)',
    steps: [
      'Önce Ayarlar → e-Fatura: sağlayıcı ve 3 harfli belge ön eki. “Elden gönderim”i seçersen kullanıcı adı/parola gerekmez; sistem belgeye numarasını verir, UBL XML dosyasını üretir, sen o dosyayı kendi entegratör portalına yükleyip faturayı kesersin. Entegratör sözleşmesi beklemeden çalışır.',
      'Parola girersen şifreli saklanır ve bir daha gösterilmez.',
      'TEST MODU varsayılan AÇIK: gönderdiğin belge GİB\'e ulaşmaz, müşteriye fatura gitmez. Rahatça dene.',
      'Gelişmiş → e-Fatura Hazırlığı: her faturanın hazır olup olmadığı, hazır değilse tam olarak neyin eksik olduğu yazar.',
      'Ekran her faturanın hazır olup olmadığını söyler; hazır değilse tam olarak neyin eksik olduğunu yazar.',
      'Önce kendi bilgilerin (kırmızı kutu) — vergi dairesi, il/ilçe, e-Fatura ön eki. Bunlar kapanmadan hiçbir fatura hazır olamaz.',
      'Sonra "en çok tekrar eden eksikler" listesi: bir müşteriyi düzeltmek genelde birkaç faturayı birden hazır eder.',
      'Alıcı eksikleri müşteri kartındaki "Fatura bilgileri" bölümünden kapatılır.',
      'Bir faturanın üstüne tıklayınca gönderilecek belgenin içeriğini olduğu gibi görürsün — kalemler, KDV oranları, toplam.',
      'Tek fatura için “Gönder”, ay sonu için “N hazır faturayı gönder”. Toplu gönderimde biri hata verirse diğerleri devam eder ve her sonuç tek tek gösterilir.',
      'Gönderdikten sonra “Durumu sor” ile kabul/red öğrenilir: TEMELFATURA 8 gün içinde reddedilebilir. Elden gönderimde durum sorulamaz — kendi portalından bakarsın.',
      'Numarası verilen her belgenin UBL XML dosyası indirilebilir; “N belgenin UBL XML’ini indir (ZIP)” ile ay sonunun hepsi tek arşivde iner. Muhasebeciye vermek ya da portala toplu yüklemek için birebir aynı dosya.',
    ],
    tip: 'Faturaya müşterinin defterdeki adı değil TESCİLLİ UNVANI yazılır; ikisi farklıysa "Ticari unvan" alanını doldur. "e-Fatura mükellefi mi" sorusu boş bırakılırsa fatura hazır sayılmaz: faturanın hangi yoldan gideceğini o belirliyor. GÖNDERİM GERİ ALINAMAZ — test modunu kapatmadan önce birkaç faturayı test olarak gönderip çıktısına bak. Belge numarası sırasında boşluk olamaz; sistem gönderim başarısız olsa bile numarayı o faturada tutar ve tekrar denemede aynısını kullanır.',
  },
  {
    id: 'kdv', icon: '🧮', title: 'KDV özeti — ay sonunda ne ödeyeceksin',
    steps: [
      'Sol menü → KDV Özeti. Dönemi ok tuşlarıyla değiştirirsin.',
      'Satış KDV\'si kestiğin faturalardan, alış KDV\'si girdiğin giderlerden gelir. Aradaki fark ödeyeceğin tutardır.',
      'Gider girerken KDV oranını yaz — tutarı fişteki KDV DAHİL rakam olarak gir, KDV\'yi sistem ayırır.',
      'Oran yazmazsan o gider özete GİRMEZ ve ekran bunu sana söyler: "şu kadar giderin KDV\'si girilmemiş".',
      'Alış satıştan fazlaysa ödenecek çıkmaz, DEVREDEN KDV çıkar.',
    ],
    tip: 'Bu bir beyanname değil, muhasebecine vereceğin rakam: tevkifat, istisna ve devreden mahsubu kapsam dışı. Satış tarafı FATURA TARİHİNE göre hesaplanır — tahsil etmemiş olsan da o ayın KDV\'sine girer. Göçte aktardığın eski sistem faturaları bu rakama girmez; onlar eski programda beyan edildi.',
  },
  {
    id: 'tahsilat', icon: '💰', title: 'Muhasebe, tahsilat ve borç hatırlatma',
    steps: [
      'Muhasebe = cari hesap. Her fiş borç, her ödeme alacak olarak işlenir; bakiye otomatik hesaplanır.',
      'Ödeme gelince: Muhasebe → müşteri → tahsilat gir. Borç kendiliğinden düşer.',
      'Kiralık cihazın aylık kira/sayaç bedelini cariye elle eklemek istersen: müşteri detayında “🖨️🔢 Kira/Sayaç Ekle” (hesaplar, sen onaylayınca cariye düşer).',
      'BORÇ HATIRLATMA: Muhasebe → “📩 Toplu Hatırlatma” → borçluları seç → SMS ile topluca gönder ya da WhatsApp’tan tek tek.',
      'Ekstre: müşteri detayında “Yazdır” — tüm hareketler + bakiye tek sayfada.',
    ],
    tip: 'Bakiye yeşil “Alacak (Kredi)” görünüyorsa müşteri fazla ödemiş demektir.',
  },
  {
    id: 'ciktilar', icon: '🖨️', title: 'Çıktılar — hangi kâğıt nereden çıkar',
    steps: [
      'Servis fişi: fiş detayı → “🖨️ Yazdır” (müşteri imzalı nüsha).',
      'İCMAL (çok fiş tek sayfada): Servis Fişleri → tarih aralığı + müşteri filtrele → “🖨️ İcmal Yazdır”. 100 fiş ≈ 3 sayfa.',
      'CİHAZ DÖKÜMÜ / ZİMMET: müşteri detayı → “🖨️ Döküm”. Kat/oda gruplu tüm cihazlar + imza alanı. “Sayaç sütunu boş” seçeneği saha föyü olur.',
      'Fatura ve tahsilat makbuzu: ilgili kayıtta “Yazdır”.',
      'Barkod/QR etiketi: Zebra Etiket ekranı (termal yazıcı).',
    ],
  },
  {
    id: 'patron', icon: '📊', title: 'Patron ekranı — ne kontrol etmeli',
    steps: [
      'ANA SAYFA: “Duran İşler” (3+ gündür kımıldamayan fişler), “Sözleşme Uyarısı” (biten/bitmek üzere olan kiralama sözleşmeleri), borçlu müşteriler. Sorun yoksa bu bölümler görünmez.',
      'Sözleşme tarihini girmek için: müşteri → Düzenle → “Sözleşme Bitiş Tarihi”.',
      'Gelişmiş → Cihaz Kârlılığı: hangi kiralık makine kazandırıyor, hangisi zarar ediyor (gelir − parça maliyeti).',
      'Gelişmiş → Toplu Zam: müşteri/cihaz süz → %X zam → önizleme → uygula → zam listesini yazdır.',
      'Gelişmiş → Kaçan Gelir: faturalanmamış sayaç/kira burada birikir.',
    ],
  },
  {
    id: 'saha', icon: '🗺️', title: 'Sahada: rota, telefon ve QR',
    steps: [
      'TELEFON: Siteyi telefonda aç → tarayıcı menüsünden “Ana Ekrana Ekle” → uygulama gibi tam ekran açılır.',
      'Altta sekme çubuğu: Ana · Fişler · ＋ (hızlı işlem) · Pazar · Muhasebe.',
      'Rota (Gelişmiş): açık fişli müşteriler durak durak listelenir, haritada sıralı yol tarifi alırsın.',
      'QR ARIZA: cihazdaki QR’ı müşteri okutur → giriş gerekmeden arıza bildirir → sisteminde otomatik fiş oluşur.',
      'Her müşteride 📞 Ara · 💬 WhatsApp · 🗺️ Yol Tarifi butonları hazırdır.',
    ],
  },
  {
    id: 'pazar', icon: '🤝', title: 'Bayi Pazarı (diğer bayilerle al-sat)',
    steps: [
      'Sol menü → Bayi Pazarı → “Pazara Katıl” (yalnız yönetici açabilir). Her pakete dahildir, ücretsizdir.',
      'İlan ver: elindeki fazla parçayı/makineyi sat. Stoktan seçerek bilgileri otomatik doldurabilirsin.',
      'Satın al: ihtiyacın olan parçayı ağdaki bayilerde ara, mesaj at, sipariş ver.',
      'Sipariş “Teslim aldım” yapılınca stok ve muhasebe kayıtları HER İKİ tarafta otomatik oluşur.',
      'Telefonun ilanda görünmez; önce uygulama içi mesajlaşılır.',
    ],
  },
  {
    id: 'guvenlik', icon: '🔐', title: 'Güvenlik ve yedek',
    steps: [
      'YEDEK: Ayarlar → “💾 Verinin Yedeği” → “Yedeği indir”. Tüm müşteri, cihaz, fiş ve muhasebe kaydın bilgisayarına iner. Ayda bir alman yeterli.',
      'İKİ ADIMLI DOĞRULAMA (isteğe bağlı): Ayarlar → “🔐 İki Adımlı Doğrulama” → “Kur ve Aç” → telefonundaki Google Authenticator ile QR’ı okut → çıkan 6 haneli kodu gir.',
      'Açarsan girişte şifrenin yanında kod da istenir; şifren çalınsa bile hesabına girilemez.',
      'Kurulumda verilen KURTARMA KODLARINI sakla — telefonunu kaybedersen giriş yolun onlardır.',
      'Kullanıcılar (Gelişmiş → Kullanıcılar): her çalışana ayrı hesap aç, kimin ne yaptığı kayıtlarda görünür.',
    ],
  },
];

const QUICK = [
  { i: '🧾', t: 'Arıza gelince', d: 'Yeni Fiş aç, parçayı okut, teslim et' },
  { i: '🔢', t: 'Ayda bir', d: 'Sayaç Turu — tüm cihazları tek listede oku' },
  { i: '💰', t: 'Para gelince', d: 'Muhasebe’den tahsilatı gir' },
];

const CHAIN = [
  { i: '👤', t: 'Müşteri' },
  { i: '🖨️', t: 'Cihaz' },
  { i: '🧾', t: 'Servis Fişi' },
  { i: '💰', t: 'Para' },
];

/**
 * ── KILAVUZ AİLELERE AYRILIYOR ───────────────────────────────────────────
 * 23 bölüm birbirinin aynı beyaz satırı olarak alt alta duruyordu: aradığını
 * bulmak için hepsini okumak gerekiyordu ve kimse okumuyordu. Bölümler artık
 * işin sırasına göre dört aileye ayrılmış ve her ailenin kendi rengi var —
 * "para" işini arayan yeşil bloğa, kurulum arayan turuncu bloğa gidiyor.
 *
 * EŞLEŞMEYEN BÖLÜM KAYBOLMUYOR: listede adı geçmeyen her bölüm en sondaki
 * "Diğer" ailesine düşer. Yeni bir bölüm eklenip buraya yazılmak unutulursa
 * ekrandan sessizce silinmesin diye.
 */
const GRUPLAR = [
  {
    ad: 'Başlangıç', aciklama: 'Bir kez yapılır, sonra unutulur',
    cizgi: 'border-l-amber-400', etiket: 'text-amber-700', nokta: 'bg-amber-400',
    idler: ['musteri', 'goc', 'disa-aktar', 'cihaz'],
  },
  {
    ad: 'Günlük iş', aciklama: 'Her gün ve her ay dokunduğunuz yerler',
    cizgi: 'border-l-blue-500', etiket: 'text-blue-700', nokta: 'bg-blue-500',
    idler: ['fis', 'sayac', 'cihazdan-sayac', 'sayac-uyarilari', 'portal', 'saha', 'toner'],
  },
  {
    ad: 'Para', aciklama: 'Fatura, tahsilat, sözleşme ve kârlılık',
    cizgi: 'border-l-emerald-500', etiket: 'text-emerald-700', nokta: 'bg-emerald-500',
    idler: ['fatura', 'e-fatura', 'kdv', 'tahsilat', 'sozlesme', 'karlilik', 'alis', 'teklif'],
  },
  {
    ad: 'Yönetim', aciklama: 'Çıktılar, patron ekranı, pazar ve güvenlik',
    cizgi: 'border-l-violet-500', etiket: 'text-violet-700', nokta: 'bg-violet-500',
    idler: ['ciktilar', 'patron', 'pazar', 'guvenlik'],
  },
];

const SON_AILE = {
  ad: 'Diğer', aciklama: 'Henüz sınıflanmamış bölümler',
  cizgi: 'border-l-gray-300', etiket: 'text-gray-600', nokta: 'bg-gray-400',
  idler: [] as string[],
};

export default function YardimPage() {
  const [open, setOpen] = useState<string>('');

  // Aileler kuruluyor; eşleşmeyenler sona düşüyor.
  const yerlesen = new Set(GRUPLAR.flatMap((g) => g.idler));
  const artan = SECTIONS.filter((s) => !yerlesen.has(s.id));
  const aileler = [
    ...GRUPLAR.map((g) => ({
      ...g,
      bolumler: g.idler.map((id) => SECTIONS.find((s) => s.id === id)).filter(Boolean) as Section[],
    })),
    ...(artan.length ? [{ ...SON_AILE, bolumler: artan }] : []),
  ].filter((g) => g.bolumler.length > 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-16">
      <div className="rounded-2xl bg-gradient-to-br from-[#0f2253] to-blue-600 p-6 text-white sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Nasıl kullanılır?</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-blue-100 sm:text-base">
          Önce aşağıdaki <b className="text-white">2 dakikalık özet</b> — sistemi anlamak için yeterli.
          Ayrıntı gerekirse altındaki başlıkları açın.
        </p>
      </div>

      {/* 2 DAKİKADA SİSTEM (hep açık) */}
      <section className="mt-5 rounded-xl border-2 border-[#0f2253] bg-white p-6">
        <div className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-blue-600">
          2 dakikada sistem
        </div>

        <h2 className="mt-2 text-lg font-bold text-slate-900">Her şey tek bir zincir</h2>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {CHAIN.map((c, i) => (
            <div key={c.t} className="flex items-center gap-1.5">
              <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5">
                <span>{c.i}</span>
                <span className="text-sm font-bold text-slate-900">{c.t}</span>
              </span>
              {i < CHAIN.length - 1 && <span className="font-bold text-slate-400">&rarr;</span>}
            </div>
          ))}
        </div>
        <p className="mt-4 max-w-2xl text-[0.95rem] leading-relaxed text-slate-600">
          Müşteriyi ve cihazını bir kere kaydedersiniz. Sonra her serviste fiş açarsınız;{' '}
          <b className="text-slate-900">fatura, cari hesap ve borç takibini sistem kendi yapar</b>.
        </p>

        <h2 className="mt-6 text-lg font-bold text-slate-900">Günde yaptığınız 3 şey</h2>
        <div className="mt-2 grid gap-2">
          {QUICK.map((q) => (
            <div key={q.t} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
              <span className="text-lg">{q.i}</span>
              <span className="text-[0.95rem] text-slate-900">
                <b>{q.t}</b> <span className="text-slate-500">&mdash; {q.d}</span>
              </span>
            </div>
          ))}
        </div>

        <h2 className="mt-6 text-lg font-bold text-slate-900">Nerede ne var</h2>
        <div className="mt-2 grid gap-1.5 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Ana Sayfa', 'dikkat gereken her şey (duran iş, borç, sözleşme)'],
            ['Servis Fişleri', 'işler + icmal yazdırma'],
            ['Sayaç Turu', 'toplu sayaç girişi'],
            ['Muhasebe', 'cari, tahsilat, borç hatırlatma'],
            ['Stok / Barkodla Satış', 'parça ve tezgâh satışı'],
            ['Gelişmiş', 'fatura, rota, rapor, zam, kârlılık'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-1.5">
              <b className="whitespace-nowrap text-[#0f2253]">{k}</b>
              <span className="text-slate-500">&mdash; {v}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/import"
            className="rounded-lg bg-[#0f2253] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#16306e]">
            Excel&rsquo;den verimi aktar &rarr;
          </Link>
          <Link href="/customers/new"
            className="rounded-lg border bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
            İlk müşteriyi ekle
          </Link>
        </div>
      </section>

      {/* AYRINTILI BÖLÜMLER */}
      <div className="mt-8 lg:grid lg:grid-cols-[210px_1fr] lg:gap-8">
        {/* İÇİNDEKİLER — 23 bölümü kaydırmadan gezmenin tek yolu. */}
        <nav className="hidden lg:block">
          <div className="sticky top-6">
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
              İçindekiler
            </div>
            <ul className="mt-3 space-y-3">
              {aileler.map((g) => (
                <li key={g.ad}>
                  <div className={`flex items-center gap-2 text-xs font-bold ${g.etiket}`}>
                    <span className={`h-2 w-2 rounded-full ${g.nokta}`} />
                    {g.ad}
                  </div>
                  <ul className="mt-1 space-y-0.5 border-l pl-3">
                    {g.bolumler.map((b) => (
                      <li key={b.id}>
                        <a href={`#k-${b.id}`} onClick={() => setOpen(b.id)}
                          className="block truncate py-0.5 text-xs text-slate-500 hover:text-slate-900">
                          {b.title.split(/[\u2014(]/)[0].trim()}
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="min-w-0 space-y-8">
          {aileler.map((g) => (
            <section key={g.ad}>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h2 className={`text-base font-extrabold ${g.etiket}`}>{g.ad}</h2>
                <span className="text-sm text-slate-500">{g.aciklama}</span>
              </div>

              <div className="mt-3 grid gap-2">
                {g.bolumler.map((s) => {
                  const isOpen = open === s.id;
                  return (
                    <div key={s.id} id={`k-${s.id}`}
                      className={`scroll-mt-6 overflow-hidden rounded-xl border border-l-4 bg-white ${g.cizgi}`}>
                      <button type="button" onClick={() => setOpen(isOpen ? '' : s.id)}
                        className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${isOpen ? 'bg-slate-50' : 'hover:bg-slate-50'}`}>
                        <span className="text-lg">{s.icon}</span>
                        <span className="flex-1 text-[0.95rem] font-bold text-gray-900">{s.title}</span>
                        <span className="text-lg text-gray-400">{isOpen ? '−' : '+'}</span>
                      </button>
                      {isOpen && (
                        <div className="border-t px-4 pb-4">
                          {s.intro && (
                            <p className="mt-3 max-w-2xl text-[0.93rem] leading-relaxed text-slate-700">{s.intro}</p>
                          )}
                          <ol className="mt-3 grid list-decimal gap-2 pl-5">
                            {s.steps.map((st, i) => (
                              <li key={i} className="max-w-2xl text-[0.93rem] leading-relaxed text-slate-800">{st}</li>
                            ))}
                          </ol>
                          {s.tip && (
                            <div className="mt-4 max-w-2xl rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2.5 text-[0.9rem] leading-relaxed text-cyan-900">
                              {s.tip}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      <p className="mt-10 text-center text-sm text-slate-400">
        Takıldığınız bir yer olursa bize yazabilirsiniz &mdash; birlikte hallederiz.
      </p>
    </div>
  );
}
