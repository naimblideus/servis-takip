# Matbaa sipariş okuyucu — devir notu

Dal: `claude/matbaa-okuyucu-1c3160` · Tarih: 17 Kasım 2026 · Push ve deploy **yapılmadı**.

## Amaç

Baskı merkezleri siparişi WhatsApp'tan fotoğraf, PDF ya da yazı olarak alıyor ve elle yazıyor. Okuyucu bu girdiyi
Claude'a okutur ve bir **baskı işi taslağı** çıkarır. Çalışan taslağı tek ekranda düzeltip onaylar. Onaylanmadan iş
panoya düşmez; hiçbir şey kendiliğinden kesinleşmez. Pilot: Lider Dijital. Pilotun ölçüsü sipariş başına WhatsApp
mesajı; okuyucunun kendi ölçüsü **okunan sipariş / düzeltmesiz onaylanan** oranı (ekranda gösteriliyor).

## Yapılanlar

**Ön koşul hakkında:** Görevde "Faz A çekirdeği yok" deniyordu, ama bu dalda zaten var ve canlıda çalışıyor:
`Tenant.hesapTuru`, `MATBAA_MENUSU` izin listesi, `BaskiIsi` modeli, İşler panosu, tezgah formu,
`requireMatbaaUser`. Bunlar yeniden yazılmadı; okuyucu üstüne kuruldu. `/matbaa/isler/*` alt sayfaları izin
listesinde zaten açık olduğu için menüye dokunulmadı.

- **Veri:** yeni tablo `BaskiOkuma` (taslak, okunan alanlar, düzeltilenler, model, süre, token). Göç
  `prisma/migrations/20261116100000_baski_okuma` yalnız ekleme yapıyor ve iki kez çalıştırılabilir (idempotent).
  `Tenant` ve `BaskiIsi`'ye yalnız geri ilişki satırı eklendi.
- **Belge okuyucu çekirdeği (üründen bağımsız):** `src/lib/belge-okuyucu.ts` (saf) ve
  `src/lib/belge-okuyucu-sunucu.ts` (SDK istemcisi, hata ayrımı, istekten girdi alma). Ayrı paket değil; aynı
  depoda, matbaaya dair tek satır içermiyor (testle korunuyor). Sonra Reçete'de tedarikçi faturası ve muhasebe
  belgesi için kullanılması düşünülüyor; Reçete'ye dokunulmadı.
  - Sözleşme: girdi = dosya ve/veya yazı + ürünün alan şeması (çekirdeğin `alan.metin/sayi/secim` yapıcılarıyla)
    + ürünün sistem metni + bağlam satırları. Çıktı = her alan için `{ deger, emin, kaynak }`; `kaynak` belgede
    nereden okunduğu (kısa alıntı ya da konum).
  - Çekirdekte: model çağrısı (`claude-opus-5-5`, resmi SDK `@anthropic-ai/sdk` 1.9.0, yeni bağımlılık),
    yapılandırılmış çıktı (JSON şeması), `effort: medium`, ret olursa sunucu tarafı yedek model
    (`fallbacks: 'default'`), boyut ve tür sınırı, anahtar yoksa kapalı, ortak kurallar (uydurma yok, "emin",
    "kaynak", güvenilmeyen içerik), alan doğrulayıcıları (sayı, tarih, telefon, seçim).
  - Dışarıdan gelen metin `<belge>` içinde gider; `</belge>` yazarak etiketten çıkamaz.
- **Matbaa katmanı:** `src/lib/baski-okuyucu.ts` (alan şeması, matbaa kuralları, taslağa dönüştürme, ölçü) ve
  `src/lib/baski-okuyucu-kayit.ts` (veritabanı).
  - Okunamayan alan boş kalır ve "emin değilim" işareti taşır; uydurulmaz. Emin olunmayan alanın altında
    "Belgede: …" alıntısı görünür.
  - Ürün yalnız matbaanın **fiyatlı** ürün listesinden, seçenek yalnız o ürünün kodlarından seçilebilir.
    Listede olmayan değer sunucuda atılır.
  - **Fiyat okunmaz ve hesaplanmaz.** Şemada fiyat alanı yok; tutarı onayda mevcut fiyat motoru hesaplar. Bu kural
    çekirdekte değil matbaa dosyasında, çünkü fatura okuyacak ürün fiyatı okumak zorunda.
- **Uçlar** (hepsi `requireMatbaaUser(['ADMIN', 'FRONT_DESK'])`; operatör giremez):
  - `POST /api/matbaa/okuma`: fotoğraf, PDF ve/veya yazı → taslak. Sipariş değilse taslak kaydedilmez.
  - `POST /api/matbaa/okuma/:id/onay`: tezgah formunun gövdesi → iş açılır (kanal WHATSAPP). Aynı anda iki kişi
    onaylarsa tek iş açılır (kilit).
  - `DELETE /api/matbaa/okuma/:id`: taslağı atar. Ad, telefon, firma ve not silinir; sayım için kayıt kalır.
- **Ekranlar:**
  - `/matbaa/isler/oku`: sürükle-bırak, dosya seç, Ctrl+V ile yapıştır (WhatsApp Web), yazı kutusu. Altında onay
    bekleyen taslaklar ve son 30 günün oranı (okunan · onaylanan · düzeltmesiz, en çok düzeltilen 3 alan).
  - Okununca taslak aynı ekranda **tezgah formu** olarak açılır, solda gönderilen dosya durur. Sarı alanlarda
    okuyucu emin değil; alana dokununca işaret kalkar. "Onayla, işi aç" ya da "Taslağı at".
  - `/matbaa/isler/oku/:id`: sonradan açılan taslak (asıl dosya yok, not düşülüyor).
  - İşler panosunda "Siparişi oku · N taslak" düğmesi (operatörde yok). İş geçmişinde "WhatsApp siparişinden
    okundu · N alan düzeltildi".
- **Dosya saklanmaz:** yüklenen dosya yalnız istek boyunca bellekte durur, base64 olarak modele gider, sonra atılır.
  Diske ya da R2'ye yazılmaz. Önizleme yalnız çalışanın tarayıcısında. (Testte kaynak taramasıyla korunuyor.)
- **Boyut ve sınırlar:**
  - Uç, gövdeyi okumadan `content-length > 8 MB` ise anlaşılır hata verir (middleware 10 MB'ta kesiyor).
  - Fotoğraf en çok 5 MB (modelin sınırı), PDF en çok 8 MB, yazı en çok 20.000 karakter.
  - Tarayıcı fotoğrafı göndermeden önce en uzun kenar 2000 px JPEG'e küçültür (mobil veri + 5 MB sınırı).
  - Kiracı başına saatte 60 okuma.
- **Ölçü kuralı (`duzeltmeler`):**
  - İş içeriği (ürün, adet, sayfa, ölçü, seçim, kalem sayısı) her farkta düzeltme sayılır; boş ürünü doldurmak da.
  - Ad, telefon, firma ve teslim yalnız okuyucunun yazdığı değer değişince ya da silinince düzeltme sayılır.
    Okuyucunun boş bıraktığını doldurmak sayılmaz: numara çoğu zaman mesajın içinde değil, WhatsApp'ın kendisinde.
  - Telefon biçimi, ad büyük/küçük harfi, varsayılan seçeneği açıkça seçmek ve siparişte saat yokken saati
    değiştirmek düzeltme sayılmaz. Not, ödeme ve acil ölçüye girmez.
- **Testler:** `scripts/test-baski-okuyucu.mjs`, 98 kontrol, model yanıtı taklit edilerek (API anahtarı
  gerekmez). Örnek veriler açıkça **SAHTE**: ürünlerin, kişilerin ve numaraların adında SAHTE / ÖRNEK yazıyor.

## Doğrulama durumu

- **Birim testleri:** `node scripts/test-baski-okuyucu.mjs` → 107 geçti, 0 kaldı (çekirdeğin başka bir şemayla, sahte bir faturayla çalıştığı dahil).
- **`tsc --noEmit`** ve değişen dosyalarda **eslint**: temiz.
- **`next build --webpack`**: geçti; yeni sayfalar ve uçlar çıktıda listeleniyor.
- **Göç:** yerel veritabanına uygulandı, iki kez çalıştırılınca da hatasız (idempotent).
- **Yerelde uçtan uca** (sahte bir Anthropic sunucusuyla, dışarıya istek gitmedi; demo matbaa kullanıcıları):
  - okuma → taslak, ekranlar 200, panoda "Siparişi oku · N taslak";
  - onay → iş açıldı (kanal WHATSAPP), iş geçmişinde okuma satırı, ikinci onay 409;
  - fiyat motoru reddedince (sayfa eksik) taslak geri açıldı;
  - 9 MB PDF → 413 "en çok 8 MB", yanlış tür → 415, boş → 400, operatör → 403;
  - modele giden istek: `claude-opus-5-5`, JSON şeması, `effort: medium`, `fallbacks: default`; reddedilen
    istekler modele gitmedi.
  - Ekran görüntüsüyle bakıldı (1280 px ve 375 px): sarı alanlar, "emin değilim" rozeti, "Siparişte: …"
    ipucu, saatsiz teslim notu, onay düğmesi ürün seçilmeden kapalı.
  - Deneme kayıtları yerel veritabanından silindi.
- **Çekirdek ayrıldıktan sonra yeniden** (sahte API, demo dışı matbaada geçici test kullanıcısı, sonra silindi):
  fotoğraf + açıklama okundu, modele görsel bloğu olarak gitti; taslakta `kaynaklar` geldi; onay → iş, ikinci onay
  409; 9 MB → 413, HEIC → 415, 6 MB fotoğraf → 413; demo dışında "taslağı at" 200; sınır hataları modele gitmedi.
  Ekranda emin olunmayan alanın altında "Belgede: “…”" alıntısı görüldü. `next build --webpack` yeniden geçti.
- **Gerçek modelle ve gerçek bir siparişle DOĞRULANMADI.** Yerelde API anahtarı yok; okuma kalitesi bilinmiyor.
- **Herkese açık demoda okuyucu kapalı** (`src/lib/demo-yazma.ts`): her okuma ücretli bir model çağrısı ve
  ziyaretçinin dosyasını dışarı gönderir. Demoda ekran açılıyor ama "Oku" demo uyarısı veriyor. Demoda
  göstermek istenirse düşük bir sınırla açılabilir; bu bir ürün kararı.
- **Önceden kırmızı testler** (değişiklikten önce HEAD'de de aynı kırmızı, bu işle ilgisiz): `test-baski-rapor`,
  `test-matbaa-menu`, `test-matbaa-online`, `test-i18n` (her biri 1 kontrol).

## Kalanlar

**Okuyucu:**
- **Gerçek siparişle denenmedi.** El yazısı, bulanık fotoğraf ve karışık PDF'lerde okuma kalitesi bilinmiyor.
- Lider Dijital'in fiyat listesi ve en çok gelen 15 iş gelmedi. Gelince testteki sahte örnekler onlarla
  değiştirilmeli ve sistem metni gerçek hatalara göre ayarlanmalı.
- Fiyat listesinde fiyatlı ürün yoksa taslak onaylanamaz (iş fiyat listesinden hesaplanıyor). Pilotta önce fiyat
  listesi girilmeli.
- Asıl dosya saklanmıyor. R2 canlıda bağlanınca okunan dosya işe `BaskiDosyasi` olarak eklenebilir.
- WhatsApp'tan doğrudan okuma yok: çalışan dosyayı WhatsApp Web'den sürükler ya da yapıştırır. Matbaanın numarası
  gelen kutusuna bağlanınca (Meta onayı) otomatik taslak düşünülebilir.
- Oturumlu uç testleri (403 operatör, 413, 503) yalnız kaynak taramasıyla korunuyor; sunucuya karşı otomatik test
  yok.
- Okuma 10–60 sn sürebilir. Canlıdaki ters vekilin (Coolify/Traefik) zaman aşımı kontrol edilmeli.
- Hız sınırı bellek içi: birden çok sunucu kopyasında kopya başına sayar.
- Çekirdek ayrı pakete taşınmadı (bilerek). Reçete'de tedarikçi faturası için kullanılınca ya `src/lib/belge-okuyucu*.ts`
  kopyalanır ya da ortak pakete alınır; o zaman karar verilmeli.
- Bu işten bağımsız bir bulgu: yerelde deneme süresi bitmiş bir kiracıda ekranlar "Erişim Kapalı" diyor, ama
  `/api/matbaa/*` uçları çalışmaya devam ediyor (önceden de böyleydi). Ayrıca bakılmalı.

**Matbaa planının geri kalanı** (`C:\Users\Mehmet Naim\.claude\plans\matbaa-hesap-turu-plani.md`). Kasa, TV
panosu, prova, sipariş sayfası ve R2 kodu önceki oturumlarda yazılmıştı; bu işte bunlara dokunulmadı. Açık kalanlar:
- e-Arşiv (Faz C);
- kâğıt/mürekkep stok düşümü ve iş maliyeti;
- cari ekstreden baskı işine bağlantı;
- canlıda R2 env girilmedi, dosya yükleme kapalı;
- pilot kurulumu: fiyat listesi, karşılama mesajı, öncesi/sonrası WhatsApp sayımı.

## Kullanıcıdan gereken env

- `ANTHROPIC_API_KEY`: sunucuda (Coolify ortam değişkeni). Değeri sohbete yazmayın.
  - Yoksa okuyucu **kapalı** kalır, ekran nedenini söyler, başka bir şey etkilenmez.
  - Aynı anahtar WhatsApp fiş önerisinin model yolunu da açıyor. **Canlıda zaten tanımlıysa okuyucu yayına
    çıkınca kendiliğinden açılır.**
- `MATBAA_OKUYUCU=kapali` (isteğe bağlı): anahtar dururken yalnız okuyucuyu kapatır.
- Veri akışı: matbaanın yüklediği sipariş içeriği okunmak için Anthropic API'ye gider. Matbaa sözleşmesi ve KVKK
  aydınlatma metni buna göre gözden geçirilmeli.

## İlk adım

1. Bu dalı gözden geçirip birleştirin (bu oturumda push ve deploy yapılmadı).
2. Yayına alınca göç açılışta `apply-migrations.js` ile uygulanır. `ANTHROPIC_API_KEY` canlıda tanımlı mı bakın.
3. Lider Dijital'den 5 gerçek WhatsApp siparişini okutun. `/matbaa/isler/oku` altındaki orana ve "en çok
   düzeltilen" satırına bakıp sistem metnini (`SISTEM_METNI`, `src/lib/baski-okuyucu.ts`) ayarlayın.
