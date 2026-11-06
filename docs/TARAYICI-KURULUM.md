# Ağ Tarayıcı Kurulum Kılavuzu

Bayi teknisyeni ve Nextus teknik ekibi (teknik1–teknik5) için. Müşteri ofisinde 10 dakikalık iş.

## Ne işe yarar

Müşterinin ofisindeki bir Windows bilgisayara bir kez kurulur. O günden sonra her sabah ofisteki yazıcıların sayacını, toner seviyesini ve arıza durumunu makinenin kendisinden okur, Nextus Servis'e gönderir. Ay sonunda kiralama faturası bu sayaçlardan hazırlanır.

Makinelerde hiçbir ayar değişmez. Tarayıcı yalnız okur.

## Gitmeden önce (ofisteyken, 2 dakika)

1. Müşteri Nextus Servis'te kayıtlı olsun. Makineleri kayıtlı değilse sorun değil: tarama bulur, tek tıkla eklenir.
2. Telefonunuzdan ya da dizüstünüzden panele girebildiğinizi kontrol edin.
3. Müşteriye sorun: "Her gün açık olan, yazıcılarla aynı ağda bir Windows bilgisayar var mı?" Sekreterin ya da muhasebenin masaüstü bilgisayarı en iyisidir. Akşam eve giden dizüstü uygun değildir.

## Müşteri ofisinde (10 dakika)

1. Panelde **Sayaçlar → Ağ Tarayıcı** sayfasını açın. En üstte **Müşteri ofisine kurulum** kutusu var.
2. Yazıcının IP adresini biliyorsanız kutuya yazın. Bilmiyorsanız boş bırakın.
3. **Kurulum kodu üret** düğmesine basın. Ekranda tek satırlık bir komut çıkar.
4. Müşterinin bilgisayarında klavyede **Windows + R** tuşlarına basın.
5. Komutu açılan kutuya yapıştırıp **Enter**'a basın.
   - Komutu müşterinin bilgisayarına nasıl getireceksiniz? **WhatsApp ile gönder** düğmesi komutu hazır mesaj yapar. Bilgisayarda WhatsApp Web açıksa oradan kopyalayın. Ya da komuttaki 8 harfli kodu elle yazın.
6. Mavi bir pencere açılır. Panel ekranını izleyin:
   - ✓ **Kod hazır**
   - ✓ **BİLGİSAYAR-ADI bağlandı**: birkaç saniye içinde gelir.
   - ✓ **Tarama bitti — 3 yazıcı bulundu · 3 tanesi sistemde**: bir iki dakika sürer.
   - ✓ **Her gün kendiliğinden çalışacak**
7. Yeşil **Kurulum tamam** kutusunu gördüyseniz iş bitti. Müşterinin bilgisayarındaki pencereyi kapatabilirsiniz.

Yeşil kutu yerine **Şimdi ne yapmalı** listesi çıktıysa aşağıdaki tabloya bakın.

> Kod 6 saat geçerlidir ve tek bilgisayarda bir kez kullanılır. Her ofis için yeni kod üretin. Yeni ofise kurmak eski ofislerdeki tarayıcıyı durdurmaz.

## Sık sorunlar

| Ekranda gördüğünüz | Sebebi | Ne yapmalı |
|---|---|---|
| 3 dakikadır **Komutun çalıştırılması bekleniyor** | Komut çalışmadı | Satırın tamamı yapıştırıldı mı? Windows + R kutusuna yapıştırıp Enter'a basın. Mavi pencere açılıp hemen kapandıysa antivirüs PowerShell'i durdurmuş olabilir: "izin ver" deyin. |
| Mavi pencerede **Sunucuya ulaşılamadı** | Bilgisayarda internet yok ya da kurumsal güvenlik duvarı engelliyor | İnterneti kontrol edin. Kurumsal ağsa BT ekibinden **nextusservis.com** adresine izin isteyin. |
| **Bu kurulum kodu daha önce kullanıldı** ya da **süresi doldu** | Kod tek kullanımlık ve 6 saat geçerli | Panelde **Yeni kurulum başlat** deyin, yeni komutu çalıştırın. |
| **Yazıcı bulunamadı** + **Bilgisayar büyük bir ağda** | Büyük ağlarda tarayıcı yalnız bilgisayarın kendi bölümünü tarar. Yazıcı başka bölümde. | Yazıcının IP adresini öğrenin: yazıcının ekranında ya da menüden basılan "Ağ ayarları" sayfasında yazar. Kutuya yazın, yeni kod üretin, komutu tekrar çalıştırın. |
| **Bu ağda yazıcı görünmedi** | Bilgisayar yazıcılarla aynı ağda değil (misafir Wi-Fi gibi) ya da yazıcılar kapalı | Bilgisayar kabloyla ya da şirket Wi-Fi'ı ile mi bağlı, bakın. Yazıcının IP adresini yazıp tekrar deneyin. |
| **Bu adreslerde yazıcı var ama sayacını vermiyor (SNMP kapalı)** | Yazıcı ağda ama SNMP özelliği kapalı | Tarayıcıda (Chrome, Edge) yazıcının IP adresini açın. Yazıcının web sayfası gelir. **Ağ / Protokol** ayarlarında **SNMP v1/v2c**'yi açın, topluluk adı **public** olsun. Menü adı markaya göre değişir; giriş şifresi isterse makinenin yönetici şifresini müşteriden ya da etiketten alın. Sonra yeni kod üretin. |
| SNMP açık ama yine görünmüyor | Topluluk adı "public"ten farklı değiştirilmiş | Panelde **Gelişmiş: SNMP topluluk adı** kutusuna makinedeki adı yazın, yeni kod üretin. |
| **N yazıcı sistemde kayıtlı değil** | Makine Nextus Servis'e henüz eklenmemiş | Aynı sayfada **Son taramalar** listesinde müşteriyi seçip **yazıcıyı cihaz olarak ekle** deyin. Seri, marka, model ve sayaç taramadan gelir. |
| **Renk ayrımı yok** | Bu renkli makine siyah ve renkli sayacı ayrı vermiyor | Bu makinenin sayacı faturaya kendiliğinden yazılmaz. Yanlış fatura olmasın diye böyle. Bu makine için sayaç e-postasını kurun ya da sayacı elle girin. |
| **Günlük çalışma kurulamadı** | Bilgisayar Görev Zamanlayıcı'ya izin vermedi | Komutu bir kez daha çalıştırın. Yine olmazsa müşterinin BT ekibinden izin isteyin. |

## Kurulumdan sonra (bayi sahibi)

- **İlk hafta karşılaştırın.** Ağ Tarayıcı sayfasında her tarama onay bekler. Tarayıcının okuduğu sayacı, makinenin ekranındaki sayaçla bir iki kez karşılaştırın. Aynıysa **Okumalar onay beklemeden sayaç olarak yazılsın** kutusunu açın.
- **Susan bilgisayar.** **Tarayan bilgisayarlar** tablosunda bir bilgisayar 3 günden uzun süre tarama göndermezse kırmızı "sessiz" yazar. Bilgisayar kapatılmış ya da ağdan çıkmış olabilir. O müşterinin sayacı o günden beri gelmiyordur.
- **Bilgisayar değişti ya da kayboldu.** **Kurulumlar** tablosunda o satırda **Kapat** deyin. Yalnız o bilgisayar durur, öbür ofisler çalışmaya devam eder. Yeni bilgisayara yeni kodla kurun.
- **Ay sonu.** Faturalar → **Dönem Faturala**. Ayarlar'da fatura onayı "elle" ise faturalar taslakta bekler. Kalemleri kontrol edip **Kes** deyin.

## Müşteri "bu ne, ne gönderiyor?" diye sorarsa

"Her sabah yazıcılarınızın sayacını ve toner seviyesini okuyup bize gönderir. Böylece sayaç için kimseyi aramayız, toner bitmeden getiririz. Belgelerinize, bilgisayarınızdaki dosyalara ve yazdırdıklarınızın içeriğine dokunmaz. Makinelerde ayar değiştirmez."

Gönderdiği tek şey: yazıcıların IP adresi, marka ve modeli, seri numarası, sayacı, toner seviyesi ve makinenin kendi bildirdiği durum (kâğıt sıkışması, servis uyarısı gibi).

## Bilgisayardan kaldırmak

Panelden **Kapat** demek yeterlidir; tarayıcı çalışsa da gönderdiği reddedilir. Bilgisayardan tamamen silmek için Windows + R → `cmd` → şu iki satır:

```
schtasks /Delete /TN "Nextus Sayac Tarayici" /F
rmdir /S /Q "%LOCALAPPDATA%\NextusSayacTarayici"
```

## Teknik ekip için

**Nasıl çalışır.** Panel 8 harfli bir kurulum kodu üretir (`TarayiciKurulumu` tablosu). Komut `irm …/k/KOD | iex` küçük bir önyükleyici indirir. Bağlantıyı açmak kodu harcamaz; WhatsApp önizlemesi kodu yakmaz. Önyükleyici `POST /api/sayac/tarayici/kurulum/kullan` ile kodu harcar ve bu kuruluma özel anahtarlı betiği alır. Betik `%LOCALAPPDATA%\NextusSayacTarayici` klasörüne yazılır ve `-Kurulum` kipinde çalışır. Bu kipte önce günlük görev kurulur: her gün 09:00, bilgisayar o saatte kapalıysa açılınca, Windows izin verirse oturum açılınca da. Sonra `/api/sayac/tarayici/nabiz` "başladım" sinyali gelir, sonra tarama gönderilir. Taramayla birlikte teşhis bilgisi de gider: taranan aralıklar, ağ kartları, 9100/631 kapısı açık ama SNMP vermeyen adresler, görevin kurulu olup olmadığı. Kurulum ekranı 3 saniyede bir sorar.

**Betik seçenekleri:** `-Ek 10.0.5.20` (kendi ağına ek olarak tara; günlük görev hatırlar), `-Topluluk`, `-Deneme` (tara ve gönder, görev kurma; kendi dizüstünüzle denemek için), `-Kuru` (hiçbir şey gönderme, ekrana yaz).

**Gerçek yazıcı olmadan prova:**

```
node scripts/seed-tarayici-prova.mjs        # yerel prova bayisi, 2 kiralık cihaz
node scripts/snmp-benzetim.mjs              # 127.0.0.20 Pantum, .21 Kyocera, .22 SNMP'si kapalı
```

Panelde IP kutusuna `127.0.0.20, 127.0.0.21, 127.0.0.22` yazın, kod üretin, komutu çalıştırın. Kendi bilgisayarınıza görev kurmak istemiyorsanız betiği `-Deneme` ile çalıştırın. İkinci ay için benzetimi `--sayfa 300` ile yeniden başlatın.

**Testler:** `node scripts/test-tarayici-kurulum.mjs` (kod, anahtar, önyükleyici, gerçek betik uçtan uca) ve `node scripts/test-sayac-tarayici.mjs`.

**Gerçek yazıcıda henüz doğrulanmadı.** Kurulum zinciri benzetimle uçtan uca denendi; gerçek bir Pantum ya da Kyocera ile denenmedi. İlk gerçek kurulumda şunları not edin: makinenin ekranındaki sayaç ile taramadaki sayaç aynı mı, SNMP fabrikadan açık mı geliyor, SNMP menüsü hangi adla geçiyor. Notları bu dosyaya ekleyin.
