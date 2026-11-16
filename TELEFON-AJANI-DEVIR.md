# Telefon Ajanı — devir notu (17 Kasım 2026)

Dal: `claude/telefon-ajani-98308c` · Push ve yayın YAPILMADI.

> **Gerçek Retell hesabıyla DENENMEDİ — DOĞRULANMADI.** Kod, Retell'in yayımlanmış
> belgesine göre yazıldı. Gerçek bir telefon görüşmesi, gerçek bir Retell ajanı ya da
> gerçek bir numara bu oturumda hiç kullanılmadı. "İlk adım" bölümündeki deneme yapılmadan
> hiçbir bayiye açılmamalı.

## Amaç

Yazıcı/fotokopi bayisinin arıza telefonunu ve WhatsApp'ını yapay zekâ karşılasın (örnek:
Avoca, Fonio.ai). Ajan:

- müşteriyi numaranın son 10 hanesinden tanır,
- cihazı (seri no / model) ve arızayı sorar,
- sonunda yalnız bir **iş emri taslağı** bırakır.

Taslak, bayinin gelen kutusunda en üstte bekler. **Fişi bayi açar.** Ajan teknisyen
**önerir**, atamaz.

Ölçü: "ajanın açtığı taslak / bayinin onayladığı". İleride taslak başına ücret alınacak;
şimdilik yalnız sayaç tutuluyor.

## Bayiyle kararlaştırılan kurallar ve kodda nerede tutuldukları

| Kural | Nerede |
|---|---|
| Otomatik fiş yok; yalnız taslak | Fişi yazan tek yer `taslakOnayla`, yani bayinin "Fişe çevir" tıkı (`lib/telefon-ajani-veri.ts`). Kaynak bekçisi testi ajan yolunda başka bir fiş yazımı olmadığını denetler. |
| Fotoğraftan sayaç okuma yok | Ajan dosyaları medyaya hiç dokunmaz (testle denetleniyor). |
| Tanınmayan numaraya WhatsApp cevabı yok | Numara bir müşteriye eşleşmezse ne cevap gider ne taslak açılır. |
| "Böyle bir fiş yok" denmez | Fiş bulunamadığında, başkasına ait olduğunda ya da arayan tanınmadığında cevap birebir aynıdır (testle denetleniyor). |
| Fiş sorgusu bayiye **ve** müşteriye ait olmalı | Sorgu `ServiceTicket.customerId` ile yapılır. Kimlik yalnız Retell'in çağrı kaydından (`call.from_number`) gelir; modelin doldurduğu bilgi kimlik sayılmaz. Bir çağrıda en çok 3 sorgu yapılabilir. |
| Bayi başına aç/kapa, varsayılan kapalı | `TelefonAjani.acik`, varsayılan `false`; satır yoksa ajan kapalı sayılır. |
| Kapatınca bot susar, hat açık kalır | Telefonda gelen arama, yalnız aktarma yapan ayrı bir ajana gider: tek cümle söyler ve aramayı yetkiliye bağlar. WhatsApp'ta bugünkü davranış sürer. |

**Senin kararın (16.11):** Tanınmayan numaradan arayanın arızası alınır, taslak "tanınmayan
numara" etiketiyle açılır. Ajan hiçbir müşteri bilgisi söylemez.

## Yapılanlar

### Veritabanı
- `prisma/schema.prisma`: iki yeni model eklendi, `TelefonAjani` ve `AjanTaslagi`. Bunlar
  `WhatsAppMessage` modelinin hemen altında. Tenant'a yalnız iki ilişki satırı eklendi;
  başka hiçbir mevcut modele dokunulmadı.
- `prisma/migrations/20261116100000_telefon_ajani/migration.sql`: yalnız yeni iki tablo ekler.
  Tekrar tekrar çalışsa da zarar vermez.

### Ortak çekirdek: `lib/ses-cekirdek/`

Aynı ajan Frigora'ya ve Nextus Klinik'e de gidecek. Bu yüzden alan bilmeyen kısım ayrı bir
klasörde duruyor. Bu klasör Prisma'yı, Next'i, `@/lib`'i ve Servis kavramlarını (fiş, cihaz,
taslak) içe aktarmaz; bunu bir test denetliyor.

| Dosya | Ne |
|---|---|
| `cagri.ts` | Kimlik yalnız `call`'dan, kiracı kararı, gelen arama kararı, numara ayıklama, sorgu sınırı |
| `retell-govde.ts` | Araç tanımı kalıpları, LLM ve ajan gövdeleri, güvenli varsayılanlar, kurulum kapıları |
| `imza.ts` | Paylaşılan sır ve Retell imzası; sır tanımlı değilse uçlar kapalı |
| `retell-istemci.ts` | Retell'e giden istekler (ajan oluşturma/güncelleme, numara bağlama/çözme) |
| `uc.ts` | İki ucun işleyicisi (`aracIstegi`, `olayIstegi`) ve `SesUyarlayici` arayüzü |

Bir ürünün çekirdeğe bağlandığı tek yer onun uyarlayıcısıdır. Servis'inki `servisSesUyarlayici`
(`lib/telefon-ajani-veri.ts`); dört işlev verir: `kiraciBul`, `aracCalistir`, `hataCevabi`,
`gelenArama`. İki uç dosyası yalnız bu uyarlayıcıyı çekirdeğe verir.

**Ayrı paket kurulmadı.** Çekirdeği `＠cetin/platform-core` gibi tek bir pakete taşımak ayrı bir
karar. Klasör buna hazır: taşırken yalnız içe aktarım yolları değişir.

### Servis'e özgü kısım
- `lib/telefon-ajani.ts` — saf kurallar:
  - fiş no ayıklama, cihaz eşleme, WhatsApp kararı
  - teknisyen önerisi (bölge × 3 + marka × 2 + kategori, eksi açık iş yükü)
  - mesai kontrolü, sayaç
  - Servis'in komut metni, araç adları ve müşteriye söylenen cümleler
- `lib/telefon-ajani-veri.ts`:
  - Servis uyarlayıcısı
  - ajanın konuşma sırasında çağırdığı araçlar
  - gelen aramanın hangi ajana gideceği kararı
  - WhatsApp akışı
  - taslak listesi, ayrıntısı, onayı ve reddi
  - sayaç ve kurulum
- `lib/telefon-ajani-metin.ts`: ekran metinleri, Türkçe ve İngilizce.

### Uçlar
- `/api/voice/tools`: Retell'in konuşma sırasında çağırdığı uç. Sır **ve** imza ikisi
  birden doğru olmalı.
- `/api/voice/webhook`: gelen aramada hangi ajanın konuşacağına karar verir. Kapalı bayi
  için aktarma ajanını, açık bayi için asıl ajanı seçer.
- `/api/telefon-ajani/ayar`: aç/kapa, asistan adı, aktarma numarası (yalnız yönetici).
- `/api/telefon-ajani/taslaklar` ve `/api/telefon-ajani/taslaklar/[id]`: taslak listesi
  ve ayrıntısı. "Fişe çevir" ve "Reddet" buradan yapılır; teknisyen onaylayamaz.
- `/api/super-admin/tenants/[id]/telefon-ajani`: hat numarasını **yalnız platform ekibi**
  atar, kurulum buradan yapılır.

### Ekranlar
- `/telefon-ajani`: taslaklar, geçmiş, sayaç, ayarlar ve hazırlık listesi.
- WhatsApp gelen kutusunun en üstünde taslak kartı. Bekleyen taslak yoksa kart görünmez.
- Süper admin → Bayi → Özet sekmesinde "Telefon ajanı" kartı.
- Menü: yan menüdeki "WhatsApp" adı artık **"Gelen Kutusu"**. Altında iki sekme var:
  WhatsApp ve Telefon Ajanı. Bekleyen taslak sayısı menüde rozet olarak görünür.
  - Neden: menüde en çok 18 aile olabilir ve bunu bir test denetliyor; yeni aile
    açılamadı.

### Mevcut koda dokunulanlar
- WhatsApp webhook: ajan açıksa otomatik cevabın yerine ajan çalışır. Ajan ayarı okunamazsa
  eski otomatik cevap çalışmaya devam eder.
- Gelen kutusunda fiş mesajdan açılırsa ajanın o mesaj için açtığı taslak kapanır.
- Rozetler.
- Demo hesabında ajanın aç/kapa ayarı kapalı.
- `.env.example`.
- Ana sözlüğe 3 hata kodu, 1 menü adı ve 1 aile adı eklendi.

### Testler
- `scripts/test-telefon-ajani.mjs`: 159 kontrol, sunucu ve veritabanı gerektirmez. Çekirdeğin alan bilmediğini ve uç işleyicisini (sahte uyarlayıcıyla) da denetler.
- `scripts/test-telefon-ajani-eszamanli.mjs`: 35 kontrol, yerel veritabanında çalışır.
  Denetlediği durumlar:
  - aynı anda iki onay verilirse tek fiş açılır
  - onay ile ret aynı anda gelirse tek sonuç çıkar
  - aynı çağrıda iki taslak isteği gelirse tek taslak açılır
  - başkasının fişi sorulursa cevap birebir aynıdır
  - kapalı ajan taslak açmaz
  - fiş mesajdan açılmışsa taslak onayı ikinci fişi açmaz

  Yerel veritabanı yoksa test "ATLANDI" der.
- Yerel geliştirme veritabanına yalnız bu göç uygulandı (iki yeni tablo).

## Kullanıcıdan gerekenler

### Ortam değişkenleri (sunucuda)
| Değişken | Ne | Yoksa |
|---|---|---|
| `RETELL_API_KEY` | Retell API anahtarı; araç ve olay imzaları da bununla doğrulanır | Telefon kanalı tamamen kapalı |
| `RETELL_VOICE_ID` | Türkçe, lisanslı bir ses (Retell panelinden) | Ajan kurulamaz |
| `VOICE_TOOL_SECRET` | En az 16 karakter rastgele değer, ör. `openssl rand -hex 24` | Araç ucu kapalı |
| `VOICE_TOOL_BASE_URL` | Dışarıdan erişilen https adres, ör. `https://nextusservis.com` | Ajan kurulamaz |

`VOICE_TOOL_BASE_URL` neden şart: canlıda `NEXTAUTH_URL` http kalmış olabilir. Kod http
adresi https'e çevirmez, kendiliğinden bir yedek adrese de düşmez.

### Numara
- Türkiye numarası (0850 ya da sabit hat), SIP üzerinden Retell'e içe aktarılır. Abonelik
  **bayinin adına** olmalı.
- Numara, Süper Admin → Bayi → Özet → "Telefon ajanı" kartında girilir.

### Aktarma numarası
- Ajan kapalıyken ya da insan gerektiğinde arayan bu numaraya bağlanır.
- **Yapay zekâ hattına yönlendirilen numara olmamalı**, yoksa arama döngüye girer. Cep
  telefonu önerilir.
- 0900 ve yurt dışı numaralar kabul edilmez.

## İlk adım (sırayla)

1. **Göçü uygula.** Sunucu her açılışta göçleri zaten uyguluyor (`apply-migrations.js`).
2. **Ortam değişkenlerini gir** (yukarıdaki dört değişken).
3. **Test bayisinde hattı ve ajanı kur.**
   - Süper admin → test bayisi → "Telefon ajanı" kartı.
   - Hat numarasını ve aktarma numarasını gir.
   - **"Kaydet ve ajanı kur"** düğmesine bas. Hata çıkarsa kart, nedenini Retell'in hata
     metniyle birlikte gösterir.
4. **Retell panelinde kontrol et:**
   - iki ajan oluşmuş olmalı: "… servis hattı" ve "… aktarma"
   - numara aktarma ajanına bağlı olmalı
   - numaranın gelen arama adresi `…/api/voice/webhook` olmalı
5. **Ajan KAPALIYKEN** numarayı ara. Beklenen: "Sizi hemen yetkilimize bağlıyorum" denir ve
   arama aktarma numarasına geçer.
6. **Bayi ekranında ajanı aç** (`/telefon-ajani` → "Ajanı aç") ve kayıtlı bir müşterinin
   numarasından ara. Ajandan beklenenler:
   - yapay zekâ olduğunu söylemesi
   - cihazı ve arızayı sorması
   - "kaydınızı aldım" demesi

   Ardından taslak `/telefon-ajani` ekranında görünmeli. "Fişe çevir" ile fişi aç; sayaç
   1 açılan / 1 onaylanan göstermeli.
7. **Kayıtsız bir numaradan ara.** Ajan bilgi vermemeli; taslak "Tanınmayan numara"
   olarak düşmeli.

### İlk denemede özellikle bakılacaklar (doğrulanmadı)
- **Araç çağrısının imzası.** Retell belgesi araç çağrılarında da `X-Retell-Signature`
  gönderildiğini söylüyor. Tutmazsa her araç 401 döner ve ajan "aksaklık oldu,
  bağlıyorum" der: güvenli ama işe yaramaz.
- **Arayan numarası.** `call.from_number` Türkiye SIP hattında gerçekten arayanın numarası
  mı? Gelmezse herkes "tanınmayan" görünür.
- **Numara bağlama ve gelen arama yönlendirmesi** (`inbound_agents`, `inbound_webhook_url`).
- **Türkçe dil kodu** `tr-TR` ve sesin Türkçe telaffuzu.
- **Gecikme:** araç cevapları 8 saniyede gelmezse Retell hata sayar.

## Kararlar (bilerek böyle)

- **SLA süresi fiş açıldığında başlar, arama anında değil.** Fiş onay anında açılıyor.
- **Bot kapalıyken de aktarma Retell dakikası harcar**, çünkü arama önce Retell'e gelir.
  Bayi ana hattını yalnız mesai dışında AI hattına yönlendirirse maliyet düşer.
- **Teknisyen önerisi** bayi "Fişe çevir"i açınca, bir kez hesaplanır. Gelen kutusu
  listesi bu yüzden yavaşlamaz.
- **WhatsApp cevabı** yalnız iki koşul birlikte sağlanınca gider: mesaj platformun ortak
  numarasına gelmiş olmalı ve numara tek bir bayiye ait olmalı. Bayinin kendi numarası
  varsa cevap başka bir numaradan gideceği için yazılmaz; taslak yine açılır.
- **Gelen arama ucu hiçbir şey saklamaz.** Ajanda açıkça bizim adresimiz yazılı ki
  görüşmeler aynı Retell hesabındaki başka bir ürüne (klinik, Frigora) gitmesin.
- **Ses kayıtları Retell'de 30 gün saklanır** (KVKK).

## Kalanlar

- Taslak başına fiyatlandırma. Sayaç hazır; reddedilen taslaklar ve mesajdan açılan fişler
  ayrı sayılıyor.
- Süper admin genel panelinde bütün bayilerin sayaçları.
- Fiş onaylanınca müşteriye "fişiniz açıldı SF-…" mesajı.
- Reddedilen taslakların belirli bir süre sonra anonimleştirilmesi (KVKK).
- İngilizce müşteri cümleleri (şimdi yalnız Türkçe).
- Çok sunuculu kurulumda "çağrı başına 3 fiş sorgusu" sınırı sunucu başına sayılır.
- **Önceden var olan, bu işin kapsamı dışında kalan sorunlar:**
  - Gelen kutusunda mesajdan fiş açma (`api/whatsapp/inbox` createTicket) fiş numarasını
    eski yoldan alıyor ve kontrol ile yazma arasında yarış var.
  - Mevcut otomatik WhatsApp cevabı bayinin kendi numarası olsa da platform numarasından
    gidiyor.
  - `test-i18n` iki anahtarda kırmızı (`superAdmin.menuBolum.platform`,
    `superAdmin.detay.ozet.crm`). Bu, son "CRM sayacı" commit'inden geliyor, bu işten değil.
