# Nextus Servis — kurumsal hazırlık: ne kuruldu, ne yapman gerekiyor

Bu dosya, büyük müşterinin BT/satın alma ekibinin sorduğu beş soruya karşılık
eklenen özellikleri ve **canlıda açman gereken adımları** anlatır. Kod hazır;
aşağıdaki adımlar yapılmazsa üçü kapalı kalır.

---

## 1. Süper yöneticide iki adımlı doğrulama

Kuruldu. Deploy'dan sonra **bir kez** aç:

`/super-admin/settings` → İki adımlı doğrulama → QR'ı Google/Microsoft
Authenticator ile okut → kurtarma kodlarını **kâğıda yaz ve kasaya koy**.

> Kurtarma kodları tek kullanımlıktır ve bir daha gösterilmez. Telefonunu
> kaybedersen sisteme girmenin tek yolu bunlar.

---

## 2. "Kim ne zaman ne değiştirdi?" — denetim kaydı

Kuruldu, otomatik çalışıyor. Ekran: **`/super-admin/audit`**

Kayıt tutulan işlemler: toplu zam, bayi ayarı/veri paylaşımı değişikliği,
yedek indirme, kullanıcı yetki değişikliği ve erişim iptali, SSO girişi.

Kayıtlar hash zinciriyle bağlı. Denetçi "bu kayıtlar sonradan düzenlenmiş
olabilir mi" diye sorarsa: bir bayi seç → **Zinciri doğrula**. Yeşil rozet
cevaptır. Düzenlenebilir ama **gizlenemez** — fark edilir.

**Yapılacak:** yok.

---

## 3. Yedek ve geri yükleme

İki katman var:

| | Ne | Nasıl |
|---|---|---|
| Veritabanı geneli | `scripts/backup-db.sh` (pg_dump + gzip + retention) | droplet'te cron |
| Tek bayi | `/api/backup` → JSON indir, `/super-admin/geri-yukle` → geri yaz | panelden |

**Yapılacak — droplet'te iki cron:**

```bash
crontab -e
```

```
0 3 * * *   cd /opt/servis-takip && DATABASE_URL='postgres://...' bash scripts/backup-db.sh   >> /var/log/st-backup.log 2>&1
0 4 1 * *   cd /opt/servis-takip && DATABASE_URL='postgres://...' bash scripts/restore-drill.sh >> /var/log/st-restore-drill.log 2>&1
```

İkincisi **tatbikattır**: en son yedeği geçici ve boş bir veritabanına yükler,
satır sayılarını doğrular, geçici veritabanını siler. Canlıya dokunmaz.
Müşteri "geri yükleme test edildi mi" diye sorduğunda log dosyasını gösterirsin.

`S3_BACKUP_BUCKET` verirsen yedek Spaces/S3'e de kopyalanır. **Öner:** ver.
Sunucu tamamen giderse yerel yedek de gitmiş olur.

Geri yükleme ekranı yalnız süper admindedir ve **firma adını birebir
yazdırmadan** uygulamaz. Bayinin kendi panelinde bu düğme yok — yanlışlıkla
altı ay öncesini yüklemek kurtardığından büyük kayıp olurdu.

**Bilinen sınır:** yedekte parola özeti yok (indirilebilir dosyaya parola
koymak güvenlik açığı). Geri yüklemede eksik kullanıcılar **pasif ve girilemez**
oluşur; bayi yöneticisi şifre atar.

---

## 4. Kurumsal giriş (SSO) — Microsoft / Google

Kod hazır, **anahtar yoksa düğme görünmez**. Açmak için:

**Microsoft (Entra ID)** — Azure portalı → Uygulama kayıtları → Yeni kayıt
Yönlendirme URI'si: `https://<alan-adın>/api/auth/callback/microsoft-entra-id`

**Google** — Cloud Console → Kimlik Bilgileri → OAuth 2.0 istemci kimliği
Yetkili yönlendirme URI'si: `https://<alan-adın>/api/auth/callback/google`

Coolify → Environment Variables:

```
AUTH_MICROSOFT_ENTRA_ID_ID=...
AUTH_MICROSOFT_ENTRA_ID_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
```

**Satarken söyleyeceğin cümle:** *"SSO yeni hesap açmaz. Sadece sizin
tanımladığınız kullanıcılar girebilir; birini işten çıkardığınızda Entra'dan
kapatmanız yeter."* Bu, BT'nin duymak istediği tek şeydir.

Microsoft varsayılanı **iş/okul hesaplarıyla sınırlı** (kişisel Microsoft
hesapları giremez). Tek bir firmaya kilitlemek istersen
`AUTH_MICROSOFT_ENTRA_ID_ISSUER`'a o firmanın dizin kimliğini ver.

---

## 5. "Sistem çökerse ne kadar sürede haberiniz olur?"

**Dış izleme — bunu bugün yap, 5 dakika sürer.**
UptimeRobot (ücretsiz) → yeni monitor → HTTP(s) →
`https://<alan-adın>/api/saglik` → 5 dakika → e-posta bildirimi.

Bu uç veritabanına gerçek bir sorgu atar. Uygulama ayakta ama veritabanı
ölüyse sayfalar açık görünür; sıradan bir izleyici bunu kaçırır, bu uç 503 döner.

**İç izleme — nöbetçi.** Coolify → Scheduled Tasks, günde bir:

```
node run-cron.mjs nobetci
```

Sessiz arızaları arar: cron durmuş mu, WhatsApp webhook'u susmuş mu, sayaç
e-postaları birikmiş mi, bildirim kuyruğu tıkanmış mı. Bunlar hata vermez —
sadece olmaz, ve ay sonunda fatura kesilmemiş olur.

Sonuç süper admin panelinin en üstünde kart olarak görünür. Anlık bildirim
istersen `ALARM_WEBHOOK_URL` ver (Slack/Discord/n8n). Vermezsen de kritik
bulguda Coolify görevi kırmızı olur.

---

## 6. Cihazdan gelen sayaç e-postası — **şu an KAPALI, açman gerekiyor**

Bu, sayaç toplamanın en ucuz kanalı: cihaz ayın belirli günü sayaç raporunu
kendi e-postayla gönderiyor, sistem okuyup işliyor. Kimse gezmiyor, kimse
fotoğraf beklemiyor. **Yüzlerce makinesi olan firmada asıl kaldıraç budur:**
filo yazılımı hepsini tek raporda yollar, sistem her satırı ayrı cihaza yazar.

**Kod hazır ve testli** (ayrıştırma 11/11, uçtan uca hat 10/10) **ama uç
kapalı:** `SAYAC_EPOSTA_SECRET` tanımlı değilken uç 503 döner. Bu bilinçli —
sırsız bir uç, herkesin sayaç yazabildiği bir uçtur.

### Her bayinin KENDİ adresi var — bayi başına kurulum yok

Adres kalıbı: **`sayac+<bayikodu>@nextusservis.com`**

Alan adı `SAYAC_EPOSTA_ALANADI` ile değişir (varsayılan `nextusservis.com`).
Farklı bir alan adı kullanacaksan Coolify'a bunu da ekle — bayi ekranda hangi
adresi görüyorsa posta oraya gitmeli.

**Kanal kapalıyken bayi bu kartı görmez.** `SAYAC_EPOSTA_SECRET` tanımlı
değilken uç 503 döner, yani o adrese giden e-posta kaybolur; tutulamayacak bir
söz vermektense adres hiç gösterilmez. Sırrı tanımlayınca kart kendiliğinden
çıkar, ayrıca bir iş yapman gerekmez.

Kod bayi açılırken otomatik üretilir; bayi kendi adresini **Ayarlar → Cihazdan
Otomatik Sayaç** kartında görür ve Kopyala'ya basar. Senin her yeni bayi için
yapman gereken **hiçbir şey yok** — aşağıdaki kurulum bir kezlik.

Kod niçin gerekli: aynı seri numarası iki bayide olabilir (aynı model, aynı
üretici serisi). Koddan bayi belli olunca arama o bayinin cihazlarıyla
sınırlanır — hem doğru cihaza yazılır hem de her e-postada tüm bayilerin tüm
cihazları taranmaz.

**Adim adim kurulum: [docs/SAYAC-EPOSTA-KURULUM.md](docs/SAYAC-EPOSTA-KURULUM.md)**
Orada iki yol var: kendi alan adin yokken Gmail koprusu (ucretsiz, bugun
calisir) ve alan adi alindiginda yapilacaklar listesi. Asagisi alan adi
yolunun ozetidir.

### Kurulum (bir kez, ~20 dakika)

**1) Sır üret ve Coolify'a ekle**

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Coolify → Environment Variables → `SAYAC_EPOSTA_SECRET` = üretilen değer.
Sonra Redeploy.

**2) Cloudflare Email Routing — CATCH-ALL kur**

Cloudflare → alan adı → **Email → Email Routing**.

Tek tek adres tanımlama; **catch-all** kur. `sayac+abcd1234@...`,
`sayac+xyz99999@...` — hepsi tek kurala düşer. Yeni bayi geldiğinde
Cloudflare'de hiçbir şey yapmazsın; kritik nokta budur.

- Routing rules → **Catch-all address** → Action: **Send to a Worker**
- Worker: aşağıdaki kod (`sayac-worker` adıyla oluştur)
- Worker → Settings → Variables: `SAYAC_SECRET` = 1. adımdaki değer

```js
export default {
  async email(message, env) {
    const metin = await new Response(message.raw).text();
    await fetch('https://<alan-adin>/api/sayac/eposta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sayac-secret': env.SAYAC_SECRET },
      body: JSON.stringify({
        to: message.to,            // ← BAYİYİ BU BELİRLER, atlanırsa hat çalışmaz
        from: message.from,
        subject: message.headers.get('subject') ?? '',
        text: metin,
      }),
    });
  },
};
```

`to` alanını göndermeyi unutma. Yoksa bayi kodu okunamaz ve e-postalar
"kod yok" diye tüm bayilerde aranır — çalışır ama zayıf çalışır.

Cloudflare değilse aynı işi Mailgun/Postmark **inbound webhook**'u ya da
Zapier/Make ile de yapabilirsin — uç sade bir JSON bekliyor, kaynağı
umursamıyor. Tek şart: `to` alanını iletmesi.

**3) Bayiye söylenecek tek cümle**

> Ayarlar → Cihazdan Otomatik Sayaç'taki adresi kopyala, cihazın web arayüzünde
> **e-posta bildirim / sayaç raporu** bölümüne alıcı olarak yapıştır, gönderim
> gününü ayın 1'i yap.

Yüzlerce makinesi olan firmada tek tek cihaza girmeye gerek yok: filo yönetim
yazılımının (Canon eMaintenance / Konica vCare / PaperCut vb.) **toplu sayaç
raporu** alıcısına aynı adres yazılır, ayda bir tek e-posta gelir.

### Nasıl çalıştığını bil

- E-posta **her zaman** kaydedilir; işlensin işlenmesin kaybolmaz.
- Metinde **sistemdeki bilinen seri numaraları** aranır (cihaz biçimi tahmin
  edilmez, ters eşleştirme yapılır).
- **Tek e-posta, çok cihaz:** rapor tablo biçimindeyse başlık satırından
  SİYAH/RENKLİ sütunları bulunur ve her satır kendi cihazına yazılır. Tablo
  değilse her serinin çevresindeki bölge ayrı okunur.
- **Bir cihazın hatası diğerlerini durdurmaz.** 200 makinelik raporda 3'ü
  okunamazsa 197'si işlenir, 3'ü kuyrukta bekler.
- **Raporda renkli sayaç yoksa öncekisi taşınır** (artış 0). Çoğu filo raporu
  yalnız siyah verir; 0 yazmak "sayaç geriledi" demek olurdu ve raporun yarısı
  reddedilirdi. Okunmayan renkli sayfa hiç ücretlendirilmez; farkı bir sonraki
  rapor zaten toplar.
- Seri ve siyah sayaç **güvenle** okunduysa okuma kaydedilir ve aylık
  faturalama zinciri onu kendiliğinden alır.
- Okunamadıysa **BEKLIYOR** olarak kuyrukta bekler — asla tahmin edilmez.
  Kuyruk: menüde **Cihazdan Sayaç** (bekleyen varsa rozetli).
- **Sayaç geriliyorsa otomatik kabul edilmez.** Cihaz değişmiş/sıfırlanmış
  olabilir; bu karar bayinin, sistemin değil.
- Aynı seri iki bayide varsa ve adreste kod yoksa **tahmin edilmez**, elle
  seçilir. Kodlu adreste bu sorun zaten oluşmaz.
- Aynı e-posta iki kez gelirse çift fatura oluşmaz: ikinci okumanın farkı
  sıfır çıkar.

### Test et (kurulumdan sonra)

Bayinin gerçek kodunu Ayarlar ekranından al, gerçek bir seri numarası yaz:

```bash
curl -X POST https://<alan-adin>/api/sayac/eposta -H "Content-Type: application/json" -H "x-sayac-secret: <SIR>" -d "{\"to\":\"sayac+<BAYIKODU>@nextusservis.com\",\"subject\":\"Test\",\"from\":\"test@x.com\",\"text\":\"Seri No  Siyah\n<GERCEK-SERI>  12345\"}"
```

- `"bayi":"kodla belirlendi"` + `"islenen":1` → hat tam çalışıyor.
- `"bayi":"kod tanınmadı"` → koddaki harf yanlış (0/O, 1/l karışıklığı kodda
  bilerek yok, ama yine de kopyala-yapıştır kullan).
- `503` → sır tanımlanmamış. `401` → sır yanlış.

Gerçek e-posta akışını denemek için kendi Gmail'inden
`sayac+<BAYIKODU>@nextusservis.com` adresine bir seri + sayaç yaz, gönder.
Menüdeki **Cihazdan Sayaç** ekranında görünmeli.

---

## Deploy sonrası kontrol listesi

- [ ] Redeploy (bekleyen migration'lar startup'ta otomatik uygulanır)
- [ ] `/api/saglik` 200 dönüyor mu — tarayıcıda aç
- [ ] UptimeRobot monitor'ü kur
- [ ] Coolify Scheduled Task: `node run-cron.mjs nobetci` (günde bir)
- [ ] Droplet cron: `backup-db.sh` (günlük) + `restore-drill.sh` (aylık)
- [ ] **`SAYAC_EPOSTA_SECRET` tanımla + Cloudflare catch-all Worker kur (§ 6)** —
      bu kanal şu an tümden kapalı, en yüksek değerli eksik. Bir kezlik iş;
      sonrasında her yeni bayi kendi adresini Ayarlar ekranında hazır bulur.
- [ ] Süper admin 2FA'yı aç, kurtarma kodlarını kâğıda yaz
- [ ] Süper admin panelinde sistem durumu kartını oku — uyarı varsa çöz

## Testler

```bash
node scripts/test-backup-restore.mjs
node scripts/test-counter-email.mjs
```
