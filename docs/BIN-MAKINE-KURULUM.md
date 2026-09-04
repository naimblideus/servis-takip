<!--
  1000 makineye sayac kurulumu — 20 ajanlik arastirma+tasarim+curutme workflow ciktisi.
  Uretim: 2026-09-03. Kaynaklar OEM resmi belgeleri; her iddia ya DOGRULANDI ya
  DOGRULANMADI olarak isaretli. DOGRULANMADI isaretli hicbir cumle satista kullanilmaz.
-->

# 1000 Makine Nasıl Bağlanır — Nextus Servis Kurulum Kılavuzu

**Sürüm:** 2026-09-03 · **Kapsam:** 1000 makine / ~250 müşteri ofisi / karışık marka
**Temel plan:** Para Sırası (en yüksek puan) + Bir Ofis Bir Ziyaret'in kart/asalak mekanizması + Gölge Ay'ın fatura koruması
**Bu belge, çürütmede çıkan 3 ölümcül + 12 ağır kusur kapatılmış halidir.**

---

## 1. Tek cümlelik karar

> **Cihazın MEVCUT e-posta ayarına dokunmadan, sadece boş ALICI yuvasına Nextus adresini ekleyerek, ofis ofis, aylık aşım ₺'si en yüksek ofisten başlayarak bağlanır; hiçbir sayaç, bayinin elle okumasıyla bir dönem karşılaştırılmadan faturaya girmez.**

Bu cümlenin üç parçası da bilinçli:
- **"Mevcut ayara dokunmadan"** → cihazda SMTP profili TEKTİR ve tara-postala onu kullanır. Değiştirirsen müşterinin taraması bozulur, geri dönüşü yoktur (eski parola yıldızlı).
- **"Aşım ₺'si en yüksek"** → kira zaten okumadan bağımsız kesiliyor. Okunmayan sayacın bedeli **ciro değil aşım**dır. Brüt ciroya göre sıralamak makineleri 20+ kat yanlış sıralar.
- **"Bir dönem karşılaştırma"** → iki dönem değil. İki dönem kuralı takvimi 6 aya çıkarıyor ve bayi çift yükü kaldıramayıp gölgeyi atlıyor; o zaman koruma sıfır oluyor.

---

## 2. Karar ağacı — ilk görüşmeden sonra hangi daldasın

```
                    ┌─ SORU 1: Filo yazılımı hesabın var mı? ─┐
                    │                                          │
              VAR (KFS/eMaintenance/vCare)              YOK / BİLMİYORUM
                    │                                          │
        ┌───────────┴───────────┐                              │
   Kyocera KFS            Canon UGW                            │
   hesabı VAR             hesabı VAR                           │
        │                      │                               │
     DAL A                  DAL B                           DAL C
```

### DAL A — Kyocera KFS hesabı VAR
**Yol:** KFS liste raporu → CSV eki → uca düşer.
**Doğrulandı:** KFS rapor zamanlamasında alıcı alanına noktalı virgülle **serbest adres** yazılabiliyor (KFS Help 26-11 adım 19). Rapor `.csv`/`.xml`, **varsayılan olarak ZIP'li** (adım 9 — "Compress email attachment" kutusu kaldırılmalı). Şablonda "Include counter information" + "Change header label" ile başlıklar sabitlenebiliyor (26-5). Kaynak "Groups > All accessible" ile bayinin tüm müşterileri tek raporda (26-13).

**K1 BİTTİ (2026-09-04, `ab2a8a0`) — bu dal artık AÇIK.** Uç ek dosyaları okuyor: `src/app/api/sayac/eposta/route.ts` → `ekleriMetneCevir(body.attachments)`; ZIP okuyucu `src/lib/ek-dosya.ts`'te elle yazıldı (zlib `inflateRawSync` — halka açık depoya yeni bağımlılık girmesin diye). csv/xml/txt/tsv/html/json açılıyor. Gerçek ZIP'li KFS raporuyla uçtan uca doğrulandı: 3 cihaz işlendi, sayaçlar ve farklar veritabanına yazıldı. Apps Script köprüsü de ekleri taşıyor (8 MB üstü atlanır, en fazla 10 ek).

**Sonuç: "Compress email attachment" kutusu artık kaldırılmak ZORUNDA DEĞİL** — sıkıştırılmış ek de okunuyor. (Kaldırmak yine de zararsız.)

**Sıra:** Şablonu BİZ veririz (bayi kurgulamaz, yoksa parser her bayide ayrı kırılır) → bir kez "On demand" çalıştır → **ham dosyayı gördükten SONRA** eşleştirme kuralı yaz. Tahminle parser yazılmaz.

**Söz verme sınırı:** Kyocera Türkiye'den KFS hesabının bu bayiye açıldığı + ücreti **yazılı** gelmeden hiçbir cümle kurulmaz. KFS "subscription" olarak geçiyor, fiyatı kamuya açık değil.

### DAL B — Canon UGW/eMaintenance hesabı VAR
**Yol:** Portaldan **elle** CSV indir → panele yükle (K6 içe aktarım yolu).
**Doğrulandı:** Sektörün gerçek entegrasyon deseni bu (Readysell 8 bayi ERP belgesi: "e-Maintenance portalından dışa aktarılan CSV'den sayaç okumalarının içe aktarılması", "Request for UGW Accounts" formu + ALICE report).
**DOĞRULANMADI — satışta kullanma:** Canon portalının **zamanlanmış makine-okunur e-posta raporu** attığına dair Canon'un kendi belgesinde tek kanıt yok. 56 sayfalık UGW2 dokümanında "schedule/CSV/SMTP/export" kelimeleri sayaç raporu bağlamında hiç geçmiyor.
**Ticari kapı:** UGW2 dokümanının kendi kapsam cümlesi: *"This paper was written for Canon sales companies only."* Bayi yetkili değilse portal hesabı yok. Bu bir mühendislik problemi değil, bayilik sözleşmesi problemidir; kod yazarak çözülmez.

### DAL C — Filo yazılımı YOK / karışık marka (varsayılan dal — bu kılavuzun ana gövdesi)
**Yol:** Cihaz-içi zamanlanmış sayaç raporu, alıcı yuvasına ekleme.
**Bugün doğrulanmış iki kanal:**
- **Kyocera:** Command Center RX > Management Settings > Notification/Report > Scheduled Report (1-3 rapor yuvası × 1-3 alıcı), kalem "Counter Status", Interval None/Monthly/Weekly/Daily/Hourly, **"Run once now > Send"** ile anında test.
- **Konica Minolta:** Administrator mode > [Maintenance] > [Total Counter Notification Setting] — 3 adres, gün/hafta/ay, 2 takvim, "Send notice after setting complete" ile test maili. **vCare'den tamamen bağımsız**, kimseden izin gerekmez.

**Kapsam dışı bırakılanlar ve sebepleri:**

| Yol | Neden hayır |
|---|---|
| Xerox CentreWare Web e-postası | Kılavuz birebir: e-posta **veri değil, sunucudaki dosyaya giden 3 URL** taşıyor. Uç o linki çekemez. "Xerox'u destekliyoruz" demek kurulumda tutulamaz. |
| Konica vCare | Payload **şifreli** M2M, adresi servis sağlayıcı atıyor (Miercom vCare 2.10 raporu). |
| Ricoh @Remote | Sayaç e-postayla ÇIKMIYOR — yalnız "cihaz koptu" ve "aylık veri hazır" bildirimi. Export tamamen elle Excel. |
| Sharp SRDM | Sharp'ın kendi kılavuzu: *"It cannot be used for charging and billing purposes."* |
| SNMP ajanı / DCA | 250 ofis = 250 kurulum + 250 arıza noktası + 250 ayrı IT müzakeresi. **Doğru ifade:** standart Printer MIB'in tek sayacı (prtMarkerLifeCount) faturalık değil ve renkli/mono ayırmaz — HP kendi belgesinde "faturalama için değerli değil" diyor; ama **üretici özel MIB'leri faturalık sayaç verebilir** (PaperCut/FMAudit/uniFLOW böyle çalışır). Bu 90 günde kapsam dışı, 91. günden sonra "e-postası yapısal olarak imkânsız" ofisler için değerlendirilir. |

---

## 3. Takvim

### GÜN 0 — Sahaya çıkma, kod yaz ve kilitle

Bu günün tamamı masa başıdır. **Sahaya çıkılan ilk gün, kurulumun en pahalı hatasıdır.**

**0.1 — Adres kilidi (bu tek karar 1000 ziyareti belirler).**
Bugün hiçbir cihaz henüz yeni adrese göndermiyor → adres BEDELSİZ değiştirilebilir. İlk cihaz kurulduktan sonra her değişiklik 1000 ziyaret demektir.
- Alan adı alınır. **Ücretsiz Gmail adresi kartlara basılmaz** — kurumsal posta filtreleri iç cihazdan `@gmail.com`'a gideni belirgin biçimde daha şüpheli sayar.
- Biçim: `<bayikodu>@sayac.<alanadi>` — **'+' kullanılmaz**. MFP panellerinin '+' kabul ettiğine dair doğrulanmış belge yok; ayrıca bazı kurumsal ağ geçitleri alt-adresi siler → posta gelir, bayi çözülemez.
- **Regex düzeltmesi zorunlu:** `route.ts:49`'daki iki desen aynı sağlamlıkta değil. `/\+([a-z0-9]{4,32})@/i` dizginin her yerinde eşleşiyor ama `/^([a-z0-9]{4,32})@/i` **yalnız başta**. Saha kuralımız "mevcut adresi silme, EKLE" olduğu için gerçek `to` başlığı çok alıcılı olacak (`muhasebe@firma.com, kod@sayac...`) → çıpalı desen ÇÖKER. Düzeltme: `(?:^|[\s<,;:])([a-z0-9]{4,32})@sayac\.` ve webhook'un `recipient`/`envelope-to` alanı `to` başlığından ÖNCE okunur.
- `route.ts:45`'teki `to` kırpması 200 → 1000 karakter. Bizim adres listeye EN SON eklendiği için tam da bayiyi tanımlayan adres kırpılıp atılıyor.
- **Bilinmeyen bayi kodu REDDEDİLİR.** Bugün kod çözülse bile eşleşen bayi yoksa `bayi = null` oluyor ve arama **tüm aktif bayilere** yayılıyor. Aynı şehirdeki iki bayi rakiptir; müşterinin ham raporu rakibin kuyruğuna düşemez. Yeni davranış: karantina, hiçbir bayinin kuyruğunda görünmez.

**0.2 — Gelen posta yolu.** Catch-all → gelen-posta ayrıştırma webhook'u (Mailgun Routes / SendGrid Inbound Parse / Postmark). Böylece **spam klasörü diye bir sessiz kayıp noktası kalmaz**. Google 1 Şubat 2024'ten beri her gönderenden SPF veya DKIM + geçerli PTR + TLS istiyor; uymayan posta spam'e düşer veya 5.7.26 ile reddedilir — ve Workspace kutusunda spam'e düşen mail uca **hiç gelmez, hata bile görünmez.**

**0.3 — Gönderim gününü SABİTLE.** Hash yalnız **saat ve dakika** üzerinden alınır (1440 slot fazlasıyla yeter; uç zaten 1000 cihazı 120 sn sınırında işliyor). Gün TÜM filoda ayın **8-15'i arası sabit** (hash%8+8).
Neden gün hash'lenmez:
- `invoicing.ts:205` okumaları `billed:false AND readingDate >= ayBaşı AND < aySonu` ile seçiyor. **Geçmiş dönemi tarayan hiçbir süpürme yok.** Fatura kesildikten sonra düşen okuma hiçbir faturaya girmez ve bir sonraki delta ondan hesaplandığı için o sayfalar **ertelenmez, YANAR**.
- Ayın 29/30/31'ine atanan cihaz yılda 5 ay hiç ateşlemez.
- Ayın 1-5'ine atanan cihaz düzenli olarak öbür aya kayar → iki okuma aynı takvim ayına düşer → `counterOverage` dahil paketi **bir kez** uygular → müşteri bir aylık dahil sayfasını kaybeder (5.000 dahil × ₺0,35 ≈ cihaz başına ₺1.750 **fazla fatura**).

**0.4 — Kod kapısı, 8 madde.** Sahayı hiçbir gün bloklamaz, ama K0-K5 bitmeden Gün 2 pilotu başlamaz.

| # | İş | Neden |
|---|---|---|
| **K0** | Her cihaz için bayinin SON elle okuması `source:'ELLE'` başlangıç okuması olarak girilir | `readings.ts:87` ilk okumada delta=0. K0 olmazsa **devir ayı sahipsiz**: son elle okuma ile ilk otomatik okuma arasındaki sayfalar hiçbir sistemde faturaya bağlanmaz. 1000 cihaz × ~3.000 sayfa × ₺0,35 ≈ ₺1.000.000 mertebesinde belirsizlik. Ters riski aynı büyüklükte: iki taraf da faturalarsa çift fatura. |
| ~~**K1**~~ **BİTTİ (`ab2a8a0`)** | Uca `attachments[]`: düz .csv, .xml, ZIP içinden çıkarma. Ek VAR + metin ayrıştırılamadı → **ASLA başarılı sayma**, kuyruğa at | KFS varsayılanı sıkıştırılmış ek. **Yazıldı ve gerçek KFS ZIP raporuyla doğrulandı** (`src/lib/ek-dosya.ts`, `scripts/test-ek-dosya.mjs` 19 test). DAL A artık sessizce sıfır üretmiyor. |
| **K2** | Sarkan okuma süpürmesi: `invoicing.ts:205`'te alt sınır KALDIRILIR (`readingDate: { lt: end }`) | Yanan sayfaları geri getirir. Dahil paket kümülatifi dönem içi `billed` toplamına baktığı için bozulmaz. **Önce ölç:** `SELECT count(*), sum(deltaBlack) FROM CounterReading WHERE billed=false AND readingDate < ayBaşı` — bugün bile sıfır çıkmayabilir. |
| **K3** | Cron'u doğru aya bağla | `vercel.json` `0 6 1 * *` çalışıyor ama `periodOf()` **yeni ayı** veriyor → ayın 1'i 06:00'da 6 saatlik yeni ay faturalanıyor: sayaç kalemi boş. Biten ay, birinin elle `?period=2026-09` geçmesi dışında **hiç faturalanmıyor**. Cron `periodOf(new Date(y, m-1, 1))` olmalı. |
| **K4** | "Sıfırlandı" matematiği — **İKİ dosyada birden** | `readings.ts:88-89` VE `devices/[id]/readings/route.ts:192-193`: `reset && counterBlack < prevB ? Math.max(0, counterBlack)` → yenilenmiş cihaz takasında **yeni cihazın ömür sayacı** faturalanıyor. 240.000 sayfa = ~₺84.000 tek satır. Yeni davranış: ekran "yeni cihazın açılış sayacı kaç?" diye sorar, delta=0 yazar, yeni sayacı taban alır. Üstelik onay bayi **sahibine** düşer: *"Bu onay bu cihaza 479.000 sayfa fatura eder. Emin misiniz?"* |
| **K5** | **DURUM alanı: `golge` \| `faturalanabilir`** — dört şart birlikte | (a) migration toptan varsayılan atamaz, cihaz bazlı açık atar; (b) `invoicing.ts:205` sorgusuna `durum` şartı **aynı commit'te** girer; (c) mezuniyette geçmiş gölge okumalar `billed:true` işaretlenir (silinmez); (d) gölge okuma `prev` sorgusuna, delta zincirine ve `prevAgg` kümülatifine **girmez**, `device.counterBlack/Color` alanlarını ezmez. **23 dosya `counterReading` okuyor** — biri filtrelemeyi unutursa gölge okuma faturaya sızar. Bu 1 günlük iş değil, tek başına bir haftadır. |
| **K6** | Faturalanabilir CSV içe aktarım, önizlemeli + tek tuşla geri alınabilir | `import/sheet/route.ts:215-216` `counterBlack/Color`'ı Device'a yazıyor, **CounterReading ÜRETMİYOR** → "portaldan indir, panele yükle" yedek planı bugün YOK. Canon'lu her bayide gerekecek. |
| **K7** | Marka × model → etiket eşleme tablosu **kilitlenir** | `counter-email.ts` tek "siyah" tek "renkli" çıkarıyor; **A3 geçmiyor**, kopya/yazdır/faks ayrımı yok, satır 170-175'e göre etiket altındaki **en büyük sayı** seçiliyor. Türkiye'de A3 çoğu sözleşmede 2 tık. Tablosu olmayan model kurulmaz. |

**0.5 — Renkli sayaç kapısı (K7'nin ikizi, ayrı yazılıyor çünkü ayrı para deliği).**
- `route.ts:112` `cihazlar.filter(c => renksizSeriler.has(c.serialNo))` **yalnız etiket serisine** bakıyor; kuyrukta bir kez elle eşleştirilmiş cihaz (`reportedSerial`) bu filtreye girmiyor → `sonRenk` boş → satır 198 `okuma.color ?? sonRenk ?? 0` → `counterColor=0` → `readings.ts:80` düşüş kontrolü → **COUNTER_DECREASE → okumanın tamamı, siyahı dahil, reddediliyor.** Yani "bir kez eşleştirirsen bir daha sorulmayacak" denen cihazlar her ay reddediliyor. Filtre `serialNo` **ve** `reportedSerial` üzerinden kurulur.
- `?? 0` dalı **tamamen kaldırılır.** Önceki renkli okuması yoksa 0 yazılmaz, cihaz kuyruğa gider. Yoksa: ilk gerçek renkli okumada `deltaColor = 45.000+` → tek makineye ₺67.500'lük satır.
- `ANOMALY=200.000` eşiği **bloklar**, uyarmaz — ve eşik mutlak değil, cihazın son 3 ay ortancasının 3 katı olur (3.000 sayfa/ay basan makinede 200.000 hiç tetiklenmez). Ayrıca `route.ts:194-206` `createReading` dönüşünden yalnız `reading.id` alıyor, **`warning` alanını yere atıyor** → tek anomali freni devre dışı. Yakalanır, `CounterEmail`'e yazılır, panelde görünür.
- Parser kuralı: renkli sayaç bulundu VE siyah yalnız `SIYAH_GENEL` ('toplam'/'total') kademesinden geldiyse **otomatik faturalama YOK, kuyruğa** — o "toplam" siyah+renklidir, renkli iki kez faturalanır (`counter-email.ts:224`).
- `blackLabel`/`colorLabel` **CounterEmail'e yazılır.** Bugün üretilip atılıyor; itirazda "hangi alandan okuduk" sorusunun tek kanıtı bu.

**0.6 — Mükerrer anahtarı.** `(deviceId, counterBlack, counterColor)` — **tarih GİRMEZ**. Varış zamanı anahtardaysa yeniden teslimatta hiç tutmaz. Asıl koruma `createReading`'de prev-oku/yaz yarışını kapatmak: yazım transaction içine, `(deviceId, counterBlack, counterColor)` unique kısıt. Not: aynı değerli mükerrer zaten delta=0 üretiyor, ₺0. **Gerçek risk:** ay sınırını geçen yeniden teslimat yeni ayda delta-0 okuma yaratıp cihazı "okundu" gösteriyor → o ay 0 sayfa faturalanıyor → eksik kartına da düşmüyor. Delta-0 okuma "okundu" sayılmaz.

---

### GÜN 1 — İlk görüşme + para listesi (masa başı, sahada kimse yok)

**1.1 — Sayım, 4 saat, zaman kutulu.** Bayinin fatura listesinden: marka × model × ofis. **Dört sütun daha (bunlar olmadan sayı gerçek değil):**

| Sütun | Neden |
|---|---|
| Cihazda SMTP dolu mu / tara-postala kullanılıyor mu | Bu, kurulum süresini 20-30 dk'dan 60 sn'ye indiren tek bilgidir |
| Yönetici (Command Center RX) parolası **bizde mi** | Kurumsal ofiste MFP admin parolasının değiştirilmiş ve müşteri BT'sinde olması **standart sertleştirme uygulamasıdır**. Fabrika sıfırlaması müşterinin adres defterini siler. |
| Ofisin IT tipi: iç BT / dış "bilgisayarcı" / **muhatapsız** (plaza ağı, ortak çalışma alanı) | Muhatapsız ofisler **seferle değil masabaşı tiplemesiyle** elenir |
| Firmware TLS 1.2 yapıyor mu | 2015 öncesi cihazlar modern rölelerle el sıkışamaz |

**Sayım 4 saatte bitmezse durma.** Çıktı "en kalabalık 20 model + ofis başına makine histogramı" olsun, tam envanter beklenmesin. Aksi halde program daha ilk haftada masa başında tıkanır.

**1.2 — Para listesinin ölçüsü: AŞIM ₺'si, brüt ciro değil.**
```
sıralama_puanı = max(0, aylık_tık − includedBlack) × overagePriceBlack
                + max(0, aylık_renkli − includedColor) × overagePriceColor
```
Kira `invoicing.ts:246`'da `lastInvoicedPeriod !== period` ile okumadan bağımsız kesiliyor. 5.000 dahil paketli, 5.200 tık çeken makinede okunmayan sayacın riski **₺70'tir, ₺1.820 değil** — 26 kat fark. İlk sorgu: *bu bayide `includedBlack/includedColor` sıfırdan farklı kaç cihaz var?* Hepsi 0 ise brüt sıralama kabul edilebilir.

**Sıralamayı analize kilitleme:** Bayi sahibinden 20 dakikada "en çok ödeyen ilk 40 müşteri"yi kafadan al, sahaya onunla çık. Aşım analizi paralel yürüsün, Gün 5'te sıralamayı düzeltsin. Kaba ve kesin sıralama ilk 40'ta neredeyse aynıdır.

**1.3 — Bayiye maliyet/geri dönüş tablosu (bu olmadan Gün 1 toplantısı "güzel fikir, sonra bakarız" diye biter):**

| Kalem | Rakam |
|---|---|
| Alan adı + gelen posta servisi | Yıllık alan adı + aylık webhook ücreti |
| Teknisyen | ~250 ofis, **gerçekçi 2-3 ofis/gün** (yol dahil) = 85-125 teknisyen-günü |
| Servis kapasitesi | 1 teknisyen tam gün + 1 yarım gün, 5 hafta kampanya |
| Karşılık | Bugün sayaç kovalamaya giden saat + geç/tahmini faturalanan aşım ₺ |

**⛔ "2 teknisyen 3 hafta tam gün, başka işe verilmez" YAZILMAZ.** 1000 makineli bayide günlük servis çağrısı 10-20'dir; sahip SLA'yı 3 hafta askıya almaz, bunu Gün 1'de reddeder ve **tüm takvim ilk toplantıda çöker.** Kapasite bayinin çağrı hacminden çıkarılır.

**1.4 — Kapsam belgesi, tek sayfa, bayi imzalar:**
> "Sayaç e-postası gönderebilen cihazları otomatiğe alıyoruz; gönderemeyeni size her ay isim isim listeliyoruz."

"1000 makinenin tamamını bağlarız" cümlesi hiçbir yerde geçmez.

**1.5 — DUR KURALI.** E-posta gönderemeyen pay **%25'i aşarsa** bu program bu haliyle satılmaz. Bayi her ay yine tam elle tur atar, satın alma sebebi olan rahatlama hiç gelmez. O durumda ya vaat "gönderebilen filo" üzerinden yeniden yazılır, ya elle turu HIZLANDIRAN ürün satılır.

---

### GÜN 2 — Telefonla nitelendirme (n=20, sefer maliyeti sıfır)

**Tek ofise gitmek yerine ilk 20 ofis telefonla nitelendirilir.** Sebep: Gün 2'de tek ofiste ölçülen şeylerin üçü (587, gönderici reddi, BT tavrı) **ofise özgüdür** ve n=1 bir oran değildir; üstelik seçilen ofis en atipik (en kurumsal) ofistir. İki teknisyeni üç haftaya bağlamadan önce elde n=20 olur.

**Randevu için üç zorunlu soru — yazılı/sözlü net cevap alınmadan randevu verilmez:**
1. Bu makineden **tarayıp e-posta gönderiyor musunuz?** (evet = altın; egress zaten açık, kimlik zaten var, BT zaten onaylamış)
2. Makinenin **yönetici parolası kimde?**
3. Yazıcının bulunduğu ağdan dışarı **587 açık mı / açılabilir mi?**

Üçünde de "hayır/bilmiyorum" gelen ofis **ilk haftaya konmaz**, ikinci dalgaya alınır.

**Firewall talebi en dar haliyle yazılır** — "giden SMTP açın" değil:
> "Şu tek cihazın IP'sinden, şu tek hedef host'a, yalnız 587/STARTTLS. Gelen bağlantı yok."

Genel SMTP egress talebi neredeyse otomatik reddedilir; giden SMTP kurumsal ağlarda **en sık engellenen giden porttur** (ele geçirilen cihaz spam rölesine döner). Bu bir bilgilendirme değil, **ofis başına güvenlik duvarı istisna talebidir** ve bir DEĞİŞİKLİK TALEBİ olarak günler-haftalar sürer. Teknisyenin 25 dakikasında çözülmez.

**Yapısal imkânsız sınıfı açılır:** Kimlik doğrulamalı HTTP proxy zorunluluğu (MFP SMTP istemcisi proxy konuşmaz) veya internete hiç çıkışı olmayan yazıcı VLAN'ı → "kapalı port" değil, **"e-posta yolu YOK"**. Bu ofislerde ikinci kez denenmez, doğrudan elle okuma + 91. gün sonrası toplayıcı hattına yazılır.

---

### GÜN 3 — Pilot: BİR kurumsal müşteri ofisi (bayinin kendi ofisi DEĞİL)

Bayinin kendi ofisinde güvenlik duvarı bayinin, parola bayinin, VLAN bayinin. Orada yapılan pilot **DEĞİŞMEYEN değişkenleri ölçer** ve bu planın baskın arıza modunu (müşteri ağı) **yapısal olarak göremez.**

**Ölçülecek 8 şey (hiçbiri varsayılmaz):**

| # | Ölçüm | Neden kritik |
|---|---|---|
| 1 | Cihazda kaç **alıcı** yuvası var | Resmî CCRX kılavuzu 1-3 rapor × 1-3 alıcı diyor; giriş seviyesi ECOSYS'te tek yuva çıkabilir |
| 2 | Cihazda kaç **gönderici (SMTP)** bloğu var | **DOĞRULANDI: TEKTİR** ve tara-postala onu paylaşıyor (Kyocera Function Settings > E-mail tek blok). 3 alıcı yuvası var, **3 gönderici yuvası YOK** |
| 3 | Scheduled Report ayarına **panelden** erişilebiliyor mu, yoksa web şart mı | Web şartsa teknisyen müşteri ağına aygıt sokacak — "müşteriden hiçbir şey istenmez" iddiası ilk fiziksel adımda çöker |
| 4 | Admin parolası bayinin standardı mıydı | |
| 5 | 587/465 dışarı açık mıydı, cihazın **gateway/DNS**'i dolu muydu | Yazıcıların ciddi kısmında statik IP var ama gateway/DNS boş — bugüne kadar sadece LAN'dan yazdırıldı |
| 6 | Cihazın yazdığı **seri**, bayinin etiketiyle aynı mı | |
| 7 | Ayrıştırıcı o markanın **gerçek gövdesini** okudu mu | |
| 8 | **Panelden elle okunan sayaç**, rapordaki değerle VE bayinin geçen ay faturaladığı kalemle **kalem kalem tutuyor mu** | En kritik ölçüm. "Otomatik ama yanlış", elle okumadan pahalıdır. |

**Ayrıca burada '+' adresi de test edilir** — bedava, 20 dakika, planın tek "belirsiz" kalemini kapatır.

**DEĞİŞMEZ SAHA KURALLARI (kart basılmadan önce yazılır):**

1. **Cihazda ÇALIŞAN bir SMTP profili varsa DOKUNMA.** Yalnız zamanlanmış rapor ALICI listesine bizim adresi ekle. Uç bayiyi `to` adresinden çözüyor; **`from`'un müşterinin alan adı olması hiçbir şeyi bozmaz.** Kendi SMTP'mizi ancak cihazda hiç e-posta yapılandırması yoksa kurarız.
2. **"Değiştirmeden önce kaydet":** SMTP sayfasına dokunmadan önce ekranın fotoğrafı çekilir, iş emrine iliştirilir. Parola yıldızlıysa "eski parola bilinmiyor" kutusu işaretlenir → **cihazda tarama kullanılıyorsa DOKUNULMAZ**, "müşteri IT onayı bekliyor" listesine yazılır. Geri dönüş yolu ancak bu kayıtla vardır.
3. **Bayinin/müşterinin mevcut alıcı adresi SİLİNMEZ**, boş yuvaya EKLENİR. Boş yuva yoksa cihaza dokunulmaz, "tek yuvalı" listesine yazılır. **Dolu yuvadaki adres müşterinin muhasebesiyse karar MÜŞTERİNİNDİR, bayinin değil.**
4. **587 testi ASLA PC'den yapılmaz.** Kurumsalda yazıcı segmenti PC segmentinden farklı ve daha sıkıdır → PC testi **yanlış pozitif** üretir ve tüm kampanyayı yanlış varsayıma oturtur. Tek geçerli kanıt cihazın kendi "Run once now" düğmesidir.
5. Firewall istisnası IP'ye yazılacaksa **DHCP rezervasyonu** istenir; yoksa IP değiştiği gün kanal sessizce ölür.

---

### GÜN 4 — Kurulum kartı (projenin en yüksek kaldıraçlı belgesi)

**Kart MARKAYA değil ARAYÜZ KUŞAĞINA göre basılır** — tek başına Kyocera 3-4 kart edebilir (8-15 yaşındaki FS/TASKalfa'nın Command Center'ı bugünküne benzemez).

**Kart iki yüzlü, 2 sayfa EKRAN GÖRÜNTÜSÜ** (yaşlı teknisyen menü tarifini değil resmi izler):

**ÖN YÜZ — YOL A (varsayılan, cihazda mail zaten çalışıyor):**
```
1. Cihazın IP'sini panelden yapılandırma sayfası basarak al
2. Tarayıcı → IP → yönetici girişi
3. Function Settings > E-mail → Server Name DOLU MU?  → EVET ise DOKUNMA
4. Management Settings > Notification/Report > Scheduled Report
5. Boş ALICI yuvasına:  [QR ile kopyala] <bayikodu>@sayac.<alanadi>
6. Rapor kalemi: ★ Counter Status  (BAŞKA HİÇBİR ŞEY)
7. Interval = Monthly,  Gün = [karttaki sabit gün],  Saat = 10:00
8. "Run once now > Send"
9. Telefonuna WhatsApp gelene kadar ÇIKMA
```

**ÖN YÜZ — YOL B (cihazda hiç mail yok):** 5 SMTP değeri + yukarıdakiler. **Parola alanı BOŞ basılır** — teknisyen kurulum anında telefonuna gelen tek kullanımlık bağlantıdan okur.

**ARKA YÜZ — TERK KURALI ve 3 arıza dalı:**
```
10 DAKİKADA OLMUYORSA BIRAK. Kartın arkasına ofis adını ve
nerede takıldığını yaz, çık.

(a) "Sunucuya ulaşılamıyor"   → gateway/DNS boş
(b) "Kimlik doğrulama hatası" → parola
(c) "Bağlantı reddedildi"     → port kapalı; bu ofis elle okumada kalır
                                 → planlamacıya bildir
```

**KARTTA İKİ KIRMIZI YASAK SATIRI:**
- ⛔ **Yalnız "Counter Status" işaretlenir. Job Log / Accounting / kullanıcı raporu İŞARETLENMEZ.** Yanlış kalem seçilirse müşterinin **çalışan adları ve belge adları** bayiye ve oradan Nextus'a akar. Bu, müşteri BT'sinin en haklı korkusudur; bir kez olursa o müşterideki tüm makineler kapanır. **Uçta ikinci kemer:** gelen metinde kullanıcı adı / belge adı deseni görülürse kayıt işlenmez, karantinaya alınır.
- ⛔ **Net Viewer sayaç raporunda "Automatic counter reset" kutusu ASLA açılmaz** — rapor gidince cihazdaki sayaçları SIFIRLIYOR. Tık faturalayan bayide fatura tabanı uçar. Kontrol listesine "kapalı olduğu görüldü" maddesi konur.

**Kartta parola taşıma politikası:** SMTP kimlik bilgisi **ofis başına ayrı** (tercihen cihaz başına), her birine sıkı hız sınırı (5 mesaj/gün — aylık rapor için fazlasıyla yeter) ve mümkünse **alıcı kısıtı** (yalnız `sayac.<alanadi>`'ye gönderebilsin). *Alıcı kısıtı desteği sağlayıcıya göre değişir — sözleşmeden ÖNCE doğrula, çünkü sızan parolayı zararsızlaştıran tek özellik budur.*
**Neden tek ortak parola olmaz:** MFP'den kimlik bilgisi çekmek bilinen bir sızma testi tekniğidir; sızan parola bayinin KENDİ alan adından SPF/DKIM uyumlu posta gönderme yetkisidir — aylık fatura kesen bir bayi için mükemmel sahte-fatura silahı. Ayrıca tek hesap tek arıza noktasıdır: sağlayıcı askıya alırsa **1000 cihaz aynı gün, sessizce susar** ve düzeltmenin bedeli 250 ziyarettir.

---

### GÜN 5-7 — İlk gerçek saha + doğrulama ekranı

**5.1 — Teknisyen ekranı `/kurulum` (kod listesinde para ekranından ÖNCE gelir).**
Para ekranı Gün 30'da lazım, bu Gün 5'te. Seri gir → yeşil/kırmızı "test raporu geldi mi" + o ofiste kurulan/kalan sayaç. **Geri bildirim WhatsApp'tan gider** (ürün zaten WhatsApp entegre): `KM4823 BAĞLANDI — siyah 480.230`. Teknisyen panele girmez, filtrelemez, hesap açmaz.

**⛔ Teknisyen beyanı kanıt sayılmaz.** İş emrindeki "__/__" alanı tek başına denetlenemez; yaşlı teknisyen adresi yazar, Send'e basar, forma 4/4 yazar. **Tek geçerli ölçüt: cihazdan gerçek posta düştü mü.**

**5.2 — Zamanlayıcı doğrulaması, 1 SAAT (7 gün değil).** Pilot cihazda aralık önce **Hourly**, 1 saat sonra ucun kendiliğinden mail aldığı görülür, sonra Monthly'ye çevrilir. "Run once now çalıştı" ≠ "zamanlayıcı ateşliyor" — bu, elle testin yakalayamadığı tek arızadır. **Test MODEL başına yapılır**, cihaz başına değil: aynı modelden 3 cihaz test etmek hiçbir şey kanıtlamaz.

**5.3 — İlk 2 ofis**, nitelendirmeden geçmiş, kartla.

**HAFTA 1 KAPISI (Gün 7) — 5 şart, hepsi:**
1. En az 2 ofis / 8-10 makine bağlı
2. **En az 1 ofis GERÇEK bir müşteri güvenlik duvarının arkasında**, SMTP'ye dokunmadan veya kaydedilmiş geri dönüşle bağlandı
3. En az 1 marka gövdesi gerçek raporla ayrıştırıldı
4. **Zamanlayıcı ateşledi** (Hourly testiyle doğrulandı, "Run once now" ile değil)
5. **Pilot cihazın rapor değeri, panelden elle okunan sayaçla kalem kalem tuttu**

Şart sağlanmazsa yayılma YOK, hafta tekrar edilir.

---

### GÜN 8-30 — İlk ay

| Gün | İş |
|---|---|
| 8 | **Randevu hattı açılır.** 250 ofis × 2-3 arama = 500-750 görüşme. Bunu **kim yapıyor, günde kaç arama, kabul/red/erteleme oranı ölçülüyor** — planda adı yazılı bir kişi. **Teknisyen randevu almaz**, teknisyenin günü kurulumdur. |
| 8 | **Canon'un 10 dakikalık bedava testi:** [Sayaç Kontrol] tuşu > [Monitoring Service] > [Communication Test]. **Bu menü Ayarlar > Cihaz Yönetimi ALTINDA DEĞİL** — daha önce gezilen ağaç bu yüzden boş çıktı. Sonuç ne olursa olsun Ay 1'de Canon elle okumada kalır. |
| 8 | **Canon Türkiye'ye 3 yazılı soru** (cevap beklenmeden ilerlenir): (1) UGW portal hesabı açılır mı, şartı/ücreti, (2) "Request for UGW Accounts" + ALICE raporu açılır mı, (3) portalın zamanlanmış makine-okunur raporu var mı, biçimi ne. **3. sorunun cevabı araştırmada doğrulanamadı.** |
| 8 | **Kyocera Türkiye'ye 3 yazılı soru:** KFS hesabı + ücreti, External System Integration API erişimi, M2540dn/M3540dn doğrudan kayıt. Cevap gelene kadar KFS üzerinden tek cümle söz verilmez. |
| 8-20 | **K1 + K6 kodu** (ek okuma + faturalanabilir CSV içe aktarım). Sahayı bloklamaz. |
| 8-25 | **KAMPANYA: aşım ₺'si en yüksek ~40 ofis.** Randevulu. **Ofis başına 1,0 değil 1,3-1,5 ziyaret bütçelenir** (gerçek katsayı Gün 2-3 nitelendirmesinden gelir). Kapıda çözülmeyen ofis için yeni durum: **SEFER DEĞİL, TALEP AÇIK** — BT onayı beklenirken teknisyen dönmez, takvim boşuna yanmaz. |
| 8-25 | Aynı ofiste çok Kyocera varsa **Net Viewer "Multi Set"** ile SMTP tek işlemde. ⚠ Multi-Set paketinin **rapor ALICI adresini taşıyıp taşımadığı kılavuzda çelişkili** — 2 cihazla 20 dakikada test edilir. Taşımıyorsa alıcı elle girilir; **plan bu testin sonucuna bağlı değildir.** |
| 10, 17, 24 | **Eşleştirme triyajı, takvime yazılı 1 saat.** İlk toplu ateşlemede seri uyuşmazlık dalgası gelir; sistem tahmin etmiyor, kuyruğa atıyor, bir kez elle eşleşince öğreniyor. **Sürpriz olursa bayi "çalışmıyor" der.** |
| 20 | **Kuyruk ekranı:** aynı anda 5 satır, ama **TOPLAM KUYRUK SAYISI her zaman büyük punto.** Birikmiş borcu bayiden saklamak ay sonunda güveni tek seferde patlatır. Sıralama ₺ ile — **ama eşleşmemiş satırın ₺'si hesaplanamaz** (cihaz yok → sözleşme yok → fiyat yok); sıralama "aynı müşteri/model grubu × tahmini hacim" ile yapılır ve ekranda "tahmini" yazar. Ekranda tek cümle: *"Bunu bir kez eşleştirirsen bu cihaz bir daha sorulmayacak."* |
| 20 | **Yanlış eşleştirme freni:** bayi bir seriyi cihaza bağlarken bildirilen sayaç, o cihazın bilinen sayacına makul yakın değilse sistem uyarır. Yanlış eşleşme `reportedSerial`'a **yazılır ve öğrenilir** → her ay iki yanlış fatura üretir ve sessizleşir. "5 satır, hızlı kapat" tasarımı tam da hızlı-yanlış eşleşmeyi teşvik ediyor. |
| 22 | **Panelin ana sayısı değişir:** okunan değil **okunamayan** cihaz + karşılığı ₺. **İki ayrı liste:** (1) *okuma gelmedi* — cihazın kendi gönderim günü + 48 saat; (2) *okuma geldi ama EKSİK/ŞÜPHELİ* — renkli taşındı, delta 0, anomali, dönem dışına düştü, sıfırlama dondu. `sayac/eksik/route.ts` `ESIK_GUN=35` bir alarm değil, **kesilmiş faturanın gecikmeli raporudur** (bir aydan uzun). Dosyanın kendi yorumu "kart 7 derken liste 12 gösterirse bayi ikisine de güvenmez" diyor → kart/liste/preflight **birlikte** değişir. |
| 22 | **`invoices/preflight` fatura kesiminde ZORUNLU adım olur.** Bugün var ama `generatePeriodInvoice` onu **hiç çağırmıyor** — yani rapor, kapı değil. Dönem okuması olmayan kiralık cihaz varsa fatura kesilmez; "N cihaz eksik, bilerek kesiyorum" onayı istenir. Bugün `invoicing.ts:246` kirayı yine ekliyor ve fatura **"tam" görünerek** çıkıyor. Canon/elle okunanlar aynı sayacın içinde. |
| 25-30 | **AY 1 KAPANIŞI: GÖLGE FATURA.** Bağlanan cihazların Nextus okuması, bayinin elle topladığı sayaçla **yan yana**. Nextus'tan fatura KESİLMEZ. |

**Gölge karşılaştırmanın matematiği (üç plandan birinin ölümcül hatası burada kapatıldı):**

⛔ **"±0 fark" kapısı olduğu gibi imkânsızdır.** Cihaz ayın 8-15'inde raporluyor, bayi ay sonunda okuyor; 20 gün arayla alınmış iki sayaç asla eşit olmaz (ayda 3.000 sayfa basan makinede ~2.000 sayfa fark). Sıfır cihaz geçer, ikinci dalga hiç başlamaz, ekip kapıyı gevşetir ("yaklaşık tutuyor, aç gitsin") ve **tek koruma buharlaşır.**

**Doğru kural — üçünden biri:**
- **AYNI GÜN:** cihazın rapor attığı gün panelde bayiye "bu cihazın sayacını şimdi oku" görevi düşer → **sayaç türü bazında** (siyah ayrı, renkli ayrı) karşılaştırılır, ya da
- **DELTA:** iki otomatik okuma arasındaki delta ile bayinin aynı penceredeki deltası karşılaştırılır.
- **Tolerans SAYFA ile değil ₺ ile:** *fark ≤ ₺50 ⇒ eşleşti.* Bayinin kabul edeceği ölçü budur.

**Fark sebepleri sabit listeden seçilir:** etiket eşlemesi / **A3 çarpanı** / tarama-faks sayacı / birim farkı / **CİHAZ YER DEĞİŞTİRDİ**. Son kalem şart — kiralama filosunda yedek makine bırakma haftalık olaydır ve bu fark tablosunda "sayaç tutmuyor" gibi görünür, oysa cihaz başka ofistedir. Kategori yoksa tablo gürültüye boğulur ve **plan yanlış sebeple durur.**

**Karşılaştırma ekrana yazılır (K8):** sayaç turu ekranında her cihazın yanında sistemin beklediği değer görünür; ofis sadece TUTTU / TUTMADI işaretler. **Elle iki listeyi yan yana koymak — hem de ayın ilk günlerinde, fatura telaşının ortasında — ay 1'de yapılır, ay 2'de yarısı yapılır, ay 3'te "tutuyor zaten" denip atlanır.**

**GÜN 30 KAPISI — 4 sayı:**
1. Kurulan cihazların **kaçı ilk hafta içinde geçerli rapor gönderdi** (kurulum başarı oranı — %80 altındaysa kart veya yordam bozuktur, ölçekleme DURUR). *"Kaç makine kuruldu" hiçbir şey ölçmez; bozuk yordamla da tutturulur.*
2. Gölge farkı ₺50 altında olan cihaz oranı
3. Eşleşmemiş kuyruk uzunluğu
4. **Kesilen yanlış fatura sayısı = 0** olmalı

---

### GÜN 31-90

| Gün | İş |
|---|---|
| 31-35 | **FATURA KAPISI koda girer:** bir cihaz **BİR dönem** gölgede ₺50 toleransla tuttuysa "faturalanabilir" adayı olur — ama geçiş **otomatik değil**, bayi sahibinin tuşudur. Ekran: *"84 makine bu dönem birebir tuttu. Faturaya al."* + tek geri alma: *"Deneme moduna döndür."* Yaşlı bayi sahibi için "sistem kendi kendine faturaya geçirdi" cümlesi güven bitiren cümledir. |
| 36-60 | **İkinci dalga:** 41-100. sıradaki ofisler. Ziyaret başına makine oranı düşer → yarısı servis ziyaretine iliştirilir, yarısı haftada bir planlı rotayla. |
| 36-60 | **İŞ EMRİ ZORUNLU ALANLARI (iki tane, ikincisi çoğu planda unutuluyor):** (a) servis çağrısı formu: *"bu ofiste kurulan makine __ / __"*; (b) **TAŞIMA/DEĞİŞİM iş emri:** *"cihaz taşındı → alıcı + takvim yeniden kuruldu mu?"* Kiralama filosunda makineler ofis değiştirir; bu alan yoksa **bağlı filo her ay sessizce erir.** |
| 40-60 | **DAL A açılır (yalnız KFS hesabı varsa — K1 bitti).** Şablon: sütunlara seri + model + grup, "Include counter information", "Change header label" ile başlıklar bizim beklediğimiz adlara **sabitlenir**. Zamanlamada `.csv`, Source = Groups/All accessible, "Send report only if there are results". **"Compress email attachment" artık kaldırılmak zorunda değil** — ZIP okunuyor. Bir kez "On demand", **ham dosya saklanır**, kural ondan sonra yazılır. |
| 45, 75 | **"Hiç ziyaret almamış ofis" listesi** çıkarılır ve özel rota kurulur. Piggyback tek başına bitirmez — ziyaretler ofislere eşit dağılmaz; **ofis dağılımı güç yasasıdır**: başta 20-50 makineli birkaç ofis, kuyrukta yüzlerce 1-2 makineli ofis. Tek makineli ofis hem makine başına en pahalı kurulumdur hem en az çağrı üretendir. |
| 60 | **CANON KARARI**, Gün 8 testinin ve yazılı cevabın sonucuna göre: (a) yetki varsa portaldan aylık CSV → K6 yolu; (b) yetki yoksa Canon **kalıcı** elle okumada kalır ve bu bayiye **yazılı** söylenir; (c) Canon payı büyükse ayrı ölçüm işi açılır. **Hiçbir durumda "Canon'u da otomatik okuyoruz" denmez.** 101/201/301 numaralı sayaçlarda tahmin etmeme kuralı aynen sürer. |
| 61-85 | **Uzun kuyruk, kampanya değil.** Ayrı sefer edilmez; her arıza/toner/bakım ziyaretinde o ofisin TÜM makineleri kurulur. **Onarım döngüsü:** planlamacının satırı İKİ değer taşır — *"bağlanmamış: N"* ve *"kurulmuş ama rapor gelmiyor: M"*. M>0 olan ofis bir sonraki HERHANGİ bir sefere otomatik iliştirilir. Bugün başarısız kurulumun ne sahibi ne tetikleyicisi var — ve **arıza ile ziyaret nadirliği pozitif korelasyonludur**: sıkı ağ yönetimi olan ofis hem kurulumun en çok tıkandığı hem en az çağrı üreten yerdir. |
| 86-90 | **AY 3 KAPANIŞI.** Mezun cihazlarda elle toplama **tamamen durdurulmaz**: aylık rastgele **%10 örneklem** kontrol okuması kalıcı olarak sürer. "30 gün daha yedek, sonra kapat" demek, bağımsız ikinci ölçümü tam da filo 500+ makineye çıktığı anda — hata bedelinin en yüksek olduğu anda — kapatmaktır. |
| 90 | **KAPI 2, 4 sayı:** faturaya geçen makine / okunamayan liste uzunluğu / gölgede+eşleşmeyen / **kesilen yanlış fatura + müşteri itirazı**. Sonuncusu 0 değilse yayılma durur. |

---

## 4. Kim ne yapar

| Rol | İş | Süre |
|---|---|---|
| **Bayi sahibi** | Gün 1: fatura verisi + kapsam belgesi imzası + "en çok ödeyen 40 müşteri"yi kafadan söyleme. Tek yuvalı cihaz kararı. **Aylık: gölge→fatura geçiş tuşuna basma.** Gün 8: sabah toplantısında tek cümle — *"Kart Ahmet Usta'nın kartı, gittiğiniz yerde yapıyoruz"* + WhatsApp grubuna kart fotoğrafı. | 90 günde ~4 saat |
| **Randevu hattı (1 kişi, adı yazılı)** | 250 ofis × 2-3 arama. Üç nitelendirme sorusu. Kabul/red/erteleme oranını ölçer. | Günde 2 saat |
| **Planlamacı (1 kişi)** | İş emrine iki satır: "bağlanmamış: N" / "kurulmuş ama gelmiyor: M". M>0 ofisleri bir sonraki sefere iliştirir. | Günde 15 dk |
| **Teknisyen (1 tam + 1 yarım gün, kampanyada)** | Kart. YOL A ise 60 saniye, YOL B ise 5 değer. Mevcut ayarı fotoğraflar, silmez. "Run once now" → **WhatsApp gelene kadar çıkmaz.** 10 dakikada olmuyorsa BIRAKIR ve kartın arkasına yazar. | Kampanya 5 hafta |
| **Ofis elemanı** | Günde 10 dk eksik listesi. **Haftada 1 saat** eşleştirme triyajı (ayda 1 değil — 450 makine bağlanacaksa kuyruğa 450 satır düşer, ayda 50 satır kapasitesi 10 kat yetersizdir). Ay sonu TUTTU/TUTMADI ekranı. | ~5 sa/hafta |
| **Nextus (biz)** | K0-K8 kodu. Gün 0 altyapı (alan adı, webhook, SPF/DKIM/PTR/TLS, saat dağıtımı, regex+karantina). Gün 3 pilotta **kurucu bizzat** — 8 ölçümü kendi gözüyle görür; ikinci elden duyulursa kampanya yanlış varsayım üzerine kurulur. Marka başına ilk gerçek rapor doğrulaması. | — |
| **Müşteri** | **Tek seferlik yazılı bildirim** (izin değil, bilgilendirme; bayi sahibinin imzasıyla): *"Cihazlarınız faturalama için sayfa sayısını bize otomatik gönderecek. Belge içeriği gönderilmez, ağınıza yazılım kurulmaz."* + **karşılık:** aynı raporun kopyası müşterinin kendi adresine de gider (alıcı yuvası 2). Sayaç itirazı geçmişi olan müşteride HAYIR'ı EVET'e çeviren tek argüman budur. | — |
| **KİMSE YAPMAZ** | SNMP ajanı, KFS API, Canon UGW entegrasyonu, Xerox CWW e-postası, uniFLOW. 90 günde hiç denenmez. | — |

**⛔ "Müşteriden istenen TEK şey giden 587" cümlesi YANLIŞTIR ve satışta kullanılmaz.** En az beş şey isteniyor: (a) yazıcı segmenti için egress istisnası, (b) o segmentten DNS çözümlemesi, (c) cihazın yönetici parolası, (d) BT'den insan zamanı, (e) bazı ağlarda hiç verilemeyecek olan şey. Doğru cümle **"hiç dokunulmaz" değil, "en az dokunuş"tur.**

---

## 5. İlk görüşmede sorulacak 5 soru

| # | Soru | Cevap → Dal |
|---|---|---|
| **1** | **Filo yazılımı hesabınız var mı? KFS / Canon e-Maintenance / vCare?** | **KFS var** → DAL A, ama K1 kodu bitene kadar söz yok. **Canon UGW var** → DAL B (elle CSV, K6). **Yok** → DAL C, bu kılavuzun ana gövdesi. *Varsa iş 10 dakikaya iner; yoksa bayi zaten filosunu yönetemiyordur.* |
| **2** | **Sözleşmelerinizde "dahil paket + aşım" var mı, yoksa her tık mı faturalanıyor? A3 kaç tık?** | **Dahil paket var** → sıralama aşım ₺'si ile, K7 A3 çarpanı **go-live ön koşulu**. **Her tık faturalı ve A3=1** → brüt sıralama kabul, K7 hafifler. *Bu soru sorulmazsa 2 teknisyen 5 hafta yanlış ofislere gider.* |
| **3** | **Makinelerinizin kaçından bugün "tarayıp e-posta gönder" kullanılıyor?** | **Çoğunda** → YOL A varsayılan: sahadaki iş "SMTP kur" değil "alıcı ekle", 60 saniye, parola yok, güvenlik konuşması yok. **Azında** → YOL B ağırlıklı, kurulum süresi 4-5 katına çıkar, kapasite planı yeniden yazılır. *Bu, projedeki en büyük tek bedava kazançtır.* |
| **4** | **Cihazlarınızın yönetici parolası sizde mi, yoksa müşteri BT'si değiştirmiş olabilir mi? Kaç müşterinizin gerçek BT departmanı var?** | **Parola bizde + BT az** → kampanya takvimi 1,3 ziyaret katsayısıyla kurulur. **Parola bilinmiyor / BT çok** → nitelendirme kapısı sertleşir, muhatapsız ofisler masabaşı elenir, katsayı 1,5'e çıkar. *Bu soru hiçbir planda yoktu ve tek başına "günde 4 ofis" varsayımını çökertebilir.* |
| **5** | **Filonuzun kaçı Canon? Kaçı 2015 öncesi model?** | **Canon+eski pay <%25** → program aynen. **>%25** → **DUR KURALI:** vaat "gönderebilen filo" üzerinden yeniden yazılır veya elle turu hızlandıran ürün satılır. *iR1643i II'nin sayaç e-postası gönderemediği menü ağacı gezilerek doğrulandı; eski firmware modern TLS'i konuşamaz.* |

---

## 6. Ölçekte bozulan şeyler ve önlemleri

| Ölçekte bozulan | 10 makinede görünmez çünkü | Önlem |
|---|---|---|
| **Gönderim günü aya yayılırsa okuma faturasız yanar** | Tek makinede ay sınırı hiç aşılmaz | Gün SABİT (ayın 8-15'i), yalnız saat/dakika hash. + `invoicing.ts:205` alt sınır kaldırılır (K2) |
| **Atlanan ay = müşteriye FAZLA fatura** | Bir ay atlamak istisna | İki aylık delta tek dahil pakete çarpıyor → fatura satırı **"iki dönem, tek paket"** yazar; kurumsal müşteri itirazında bayi savunabilsin |
| **Renkli sayaç kalıcı donar, hiçbir ekran görmez** | Tek markalı filoda format hep aynı | `?? 0` kaldırılır, `reportedSerial` filtreye girer, "renkli sayacı N aydır sabit" kartı, taşıma en fazla 1 ay |
| **"Toplam" siyah sanılıyor, renkli iki kez faturalanıyor** | 10 makinede aynı etiket | `SIYAH_GENEL` kademesinden gelen siyah + renkli>0 → otomatik faturalama YOK |
| **"Sıfırlandı" tek tıkla 6 haneli fatura** | Cihaz değişimi yılda bir | Ekran yeni cihazın açılış sayacını sorar, delta=0. Onay bayi **sahibine** düşer. İki dosyada birden düzeltilir. |
| **Anomali freni devre dışı** | Küçük filoda 200.000 hiç aşılmaz | `warning` yakalanır, **bloklar**; eşik = son 3 ay ortancasının 3 katı |
| **Aynı seri iki müşteride** | 10 cihazda çakışma olmaz | "Seri eşleşmezse tahmin etme" → **"seri BİRDEN FAZLA eşleşirse de tahmin etme"** |
| **Cihaz taşınması = asıl fatura hatası** | Yılda bir olur | Sayaç CİHAZA, fatura (cihaz × müşteri × tarih) üçlüsüne. Taşımada kapanış okuması zorunlu alan; yoksa oransal böl ve **"tahmini" etiketle** |
| **Zaman damgası cihazdan geliyor** | Tek cihazın saati doğrudur | Okuma tarihi = **varış zamanı**; cihaz beyanı ayrı alanda. Karta "cihazın tarih/saatini kontrol et" satırı |
| **50 satırlık kuyruk = 0 satırlık kuyruk** | 5 satırda tıklanır | 5 satır göster + **toplam sayıyı büyük punto**; ₺ grubuyla sırala; "bir kez eşleştirirsen bir daha sorulmayacak" |
| **Yanlış elle eşleştirme kalıcı ve sessiz** | Küçük kuyrukta dikkat edilir | Sayaç yakınlık freni + geri alma + geriye dönük düzeltme yolu |
| **Tek SMTP kimliği = filo çapında karartma** | Tek hesap tek cihazda risksiz | Ofis/cihaz başına anahtar + hız sınırı + alıcı kısıtı + **bayi bazlı günlük nabız alarmı (%50 düşüşte 24 saatte)** |
| **Ajan/cihaz "3 gündür sessiz" kartı** | — | Aylık raporlayan cihaz **tasarımı gereği 30 gün sessizdir**. Ölçüt: **beklenen gönderim günü + 48 saat**, cihaz kaydına yazılır |
| **Ağ değişimi kuyruğu** | Router hiç değişmez | 250 ofiste yılda router/ISP/VLAN değişimi kaçınılmaz → aylık sabit **yarım gün** bakım kapasitesi; steady-state yük bayiye baştan söylenir |
| **Kampanya sonrası sönme** | — | İyi niyet değil, **iş emri formundaki zorunlu alan** (iki tane: servis + taşıma) |

---

## 7. BİLMEDİKLERİMİZ

### 7.1 — Sahada ölçülecek (hepsi ucuz, hiçbiri varsayılmayacak)

| Ne | Nasıl | Süre | Ne zaman |
|---|---|---|---|
| Cihazda **kaç alıcı yuvası** var (giriş seviyesi ECOSYS'te 1 olabilir) | CCRX ekranı | 2 dk | Gün 3 |
| **'+' adreslemeyi** MFP paneli kabul ediyor mu | 3-5 cihazda dene | 20 dk | Gün 3 |
| Scheduled Report'a **panelden** erişiliyor mu, web şart mı | Panel menüsü | 5 dk | Gün 3 |
| Cihaz **derin uykudan** zamanlanmış rapor atıyor mu | Hourly + gece bekle | 1 gece | Gün 5 |
| Net Viewer **Multi-Set alıcı adresini taşıyor mu** (kılavuz kendi içinde çelişiyor) | 2 cihaz | 20 dk | Gün 40 |
| ECOSYS M2540dn/M3540dn'de **Remote Services (KFS) menüsü** var mı | CCRX > Management Settings | 2 dk | Gün 8 |
| Canon iR1643i II **Communication Test** sonucu | Sayaç Kontrol > Monitoring Service | 10 dk | Gün 8 |
| Müşteri ofislerinde **587/465 açık olma oranı** | Cihazın kendi test düğmesi (PC'den ASLA) | Ofis başına 5 dk | Gün 2'den itibaren |
| **Kyocera "Counter Status" raporu kullanıcı adı taşıyor mu** | Ham metni oku | 5 dk | Gün 3 |
| Bugün **sarkan billed=false okuma** var mı | Tek SQL | 5 dk | Gün 0 |

### 7.2 — Doğrulanmamış varsayımlar (satışta kullanılmaz)

- **"~250 ofis"** — bir varsayımdır, Gün 1 sayımı verir.
- **"En yoğun 50 ofis filonun yarısını taşır"** — dağılım tahmini, ölçüm değil. Gün 1 histogramı çürütürse takvim değil **hedef sayısı** düzeltilir.
- **Kurulum başarı oranı** — hiçbir planda modellenmemişti. Yakalama = ziyaret kapsaması × **ilk-seferde-başarı**; ikincisi 1 kabul edilirse hedef ~%40 şişer. Gün 30'da **iki sayı ayrı ayrı** ölçülür.
- **Ajan/kanal sessizlik oranı** — sektörde yayımlanmış yüzde bulunamadı. İlk 20-30 ofiste 60 gün ölçülmeden taahhüt verilmez.
- **Aylık okuma kayıp oranı** — sektör kıyas rakamı yok.

### 7.3 — DOĞRULANMADI, satışta ağza alınmayacak cümleler

| ⛔ Söylenmeyecek | Neden |
|---|---|
| "1000 makinenizi bağlarız" | Canon + tek yuvalı + egress kapalı + parola alınamayan + TLS uyumsuz sınıfların toplamı ölçülmedi |
| "Canon'u da otomatik okuyoruz" | UGW erişimi yetkili bayiliğe bağlı; **portalın zamanlanmış makine-okunur e-posta raporu attığına dair Canon belgesinde tek kanıt yok** |
| "KFS'e bağlanıyoruz" | Hesap Kyocera Türkiye'nin **ticari** kapısına bağlı, ücret kamuya açık değil — ve yalnız **KFS'e zaten kayıtlı** cihazları kapsar. (Uç tarafı hazır: K1 bitti, ZIP'li rapor okunuyor.) |
| "Xerox'u destekliyoruz (CWW ile)" | CWW e-postası **veri değil link** taşıyor; teknik olarak doğru, işlevsel olarak yalan |
| "Lexmark'ı otomatik çekiyoruz" | Zamanlanmış raporun **ek mi link mi** olduğu ve seri kolonu taşıyıp taşımadığı kılavuzda yok; canlı e-posta görülmedi |
| "Ricoh/Sharp/Brother/HP bağlanabilir" | **Ayrıştırıcıda 16 marka biçiminin testte geçmesi, o cihazın rapor GÖNDEREBİLDİĞİNİ kanıtlamaz** — yalnız gönderirse okuyabildiğimizi kanıtlar. Marka, sahadan ilk GERÇEK raporu gelene kadar "bağlanabilir" sayılmaz. |
| "SNMP faturalık sayaç veremez" | **Ters yönden yanlış iddia.** Standart MIB için doğru; üretici özel MIB'leri verebilir. Doğru cümle: *"standart Printer MIB faturalık değil ve renkli/mono ayırmaz; özel MIB'ler verebilir ama marka bazlı doğrulama + müşteri ağında toplayıcı ister."* |
| "1000 cihaz 11 saniyede" (kurulum hızı olarak) | O, **ucun sentetik düz metin gövdeyle ölçülmüş işleme kapasitesidir** (sınır 120 sn, tavan ~10.800). Gerçek bir filo yazılımı raporu bu hattan hiç geçmemiştir. Kurulum 85-125 teknisyen-günüdür. **Bu ikisini karıştırmak bu projede verilebilecek en pahalı yanlış sözdür.** |
| "Müşteriden istenen tek şey giden 587" | En az beş şey isteniyor (bkz. §4) |
| "Ağınıza hiç dokunulmaz" | Gateway/DNS düzeltmesi gerekebilir; **"en az dokunuş"** denir |

### 7.4 — Tutulabilir tek satış cümlesi

> "Filonuzun tamamını ilk gün bağlamıyoruz. Önce dökümü çıkarıp hangi cihazın hangi yoldan okunacağını **yazılı** veriyoruz. Aşım riski en yüksek ~40 ofisi beş haftada, kalanını servis ziyaretlerinizde bağlıyoruz. Hiçbir sayaç, sizin kendi okumanızla bir dönem karşılaştırılmadan faturaya girmiyor — geçiş tuşuna siz basıyorsunuz. Okunamayan cihazı size her ay isim isim, ₺ karşılığıyla gösteriyoruz."

---

## Ek: Kod işleri özeti — dosya ve satır

| Kod | Dosya | Durum |
|---|---|---|
| K0 açılış okuması | `src/lib/readings.ts` (`source:'ELLE'` girişi) | Yeni |
| K1 ek dosya | `src/app/api/sayac/eposta/route.ts:42` — yalnız `body.text/html` | Yeni |
| K2 sarkan süpürme | `src/lib/invoicing.ts:205` — alt sınır kaldır | Tek satır |
| K3 cron dönemi | `vercel.json` `0 6 1 * *` + `periodOf()` | Tek satır |
| K4 reset matematiği | `src/lib/readings.ts:88-89` **ve** `src/app/api/devices/[id]/readings/route.ts:192-193` | **İKİ dosya** — `readings.ts` başlığı zaten "bu mantık kopyalanmamalı" diyor |
| K5 gölge/faturalanabilir | Şema + `invoicing.ts:205` + 23 tüketici dosya | ~1 hafta |
| K6 faturalanabilir CSV | `src/app/api/import/sheet/route.ts:215-216` — Device'a yazıyor, CounterReading üretmiyor | Yeni |
| K7 etiket/A3 tablosu | `src/lib/counter-email.ts` (A3 geçmiyor, satır 170-175 "en büyük sayı") | Yeni |
| Renkli filtre | `route.ts:112` — `serialNo` + `reportedSerial` | Tek satır |
| `?? 0` kaldır | `route.ts:198` | Tek satır |
| Anomali topraklama | `route.ts:194-206` — `warning` atılıyor | Tek satır |
| Etiket kanıtı | `blackLabel/colorLabel` → `CounterEmail` | Küçük |
| Regex + `to` kırpma | `route.ts:45, 49` | Tek satır |
| Bilinmeyen kod karantinası | `route.ts:49-58` — `bayi=null` → tüm bayilere yayılıyor | Küçük, **güvenlik** |
| Preflight kapısı | `generatePeriodInvoice` preflight'ı **hiç çağırmıyor** | Küçük |
| Eksik eşiği | `src/app/api/sayac/eksik/route.ts` `ESIK_GUN=35` | Küçük |
| `/kurulum` ekranı | Yeni + WhatsApp geri bildirimi | Yeni |
| K8 fark tablosu | Sayaç turu ekranına beklenen değer + TUTTU/TUTMADI | Yeni |