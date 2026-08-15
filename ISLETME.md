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
fotoğraf beklemiyor.

**Kod hazır ve testli (8/8) ama uç kapalı:** `SAYAC_EPOSTA_SECRET` tanımlı
değilken uç 503 döner. Bu bilinçli — sırsız bir uç, herkesin sayaç yazabildiği
bir uçtur.

### Kurulum (bir kez, ~20 dakika)

**1) Sır üret ve Coolify'a ekle**

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Coolify → Environment Variables → `SAYAC_EPOSTA_SECRET` = üretilen değer.

**2) Bir e-posta adresi belirle**

Örn. `sayac@nextusservis.com`. Cihazlar rapora bu adresi yazacak.

**3) Gelen e-postayı uca ilet**

Alan adı Cloudflare'deyse en kolayı **Email Routing → Email Workers**:

```js
export default {
  async email(message, env) {
    const metin = await new Response(message.raw).text();
    await fetch('https://<alan-adin>/api/sayac/eposta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sayac-secret': env.SAYAC_SECRET },
      body: JSON.stringify({
        subject: message.headers.get('subject') ?? '',
        from: message.from,
        text: metin,
      }),
    });
  },
};
```

Cloudflare değilse aynı işi Mailgun/Postmark **inbound webhook**'u ya da
Zapier/Make ile de yapabilirsin — uç sade bir JSON bekliyor, kaynağı umursamıyor.

**4) Cihazlara adresi tanımla**

Cihazın web arayüzü → e-posta bildirim/sayaç raporu → alıcı olarak o adresi
gir, gönderim gününü ayın 1'i yap.

### Nasıl çalıştığını bil

- E-posta **her zaman** kaydedilir; işlensin işlenmesin kaybolmaz.
- Metinde **sistemdeki bilinen seri numaraları** aranır (cihaz biçimi tahmin
  edilmez, ters eşleştirme yapılır).
- Seri ve siyah sayaç **güvenle** okunduysa okuma kaydedilir ve aylık
  faturalama zinciri onu kendiliğinden alır.
- Okunamadıysa **BEKLIYOR** olarak kuyrukta bekler — asla tahmin edilmez.
  Kuyruk: menüde **Cihazdan Sayaç** (bekleyen varsa rozetli).
- Aynı seri iki bayide varsa **hangisi olduğu tahmin edilmez**, elle seçilir.
- Aynı e-posta iki kez gelirse çift fatura oluşmaz: ikinci okumanın farkı
  sıfır çıkar.

### Test et (kurulumdan sonra)

```bash
curl -X POST https://<alan-adin>/api/sayac/eposta -H "Content-Type: application/json" -H "x-sayac-secret: <SIR>" -d "{\"subject\":\"Test\",\"from\":\"test@x.com\",\"text\":\"Serial Number: <GERCEK-SERI>\nTotal: 12345\"}"
```

`islendi: true` dönerse hat çalışıyor. `503` dönerse sır tanımlanmamış,
`401` dönerse sır yanlış.

---

## Deploy sonrası kontrol listesi

- [ ] Redeploy (bekleyen migration'lar startup'ta otomatik uygulanır)
- [ ] `/api/saglik` 200 dönüyor mu — tarayıcıda aç
- [ ] UptimeRobot monitor'ü kur
- [ ] Coolify Scheduled Task: `node run-cron.mjs nobetci` (günde bir)
- [ ] Droplet cron: `backup-db.sh` (günlük) + `restore-drill.sh` (aylık)
- [ ] **`SAYAC_EPOSTA_SECRET` tanımla + e-posta yönlendirmesini kur (§ 6)** — bu
      kanal şu an tümden kapalı, en yüksek değerli eksik
- [ ] Süper admin 2FA'yı aç, kurtarma kodlarını kâğıda yaz
- [ ] Süper admin panelinde sistem durumu kartını oku — uyarı varsa çöz

## Testler

```bash
node scripts/test-backup-restore.mjs
node scripts/test-counter-email.mjs
```
