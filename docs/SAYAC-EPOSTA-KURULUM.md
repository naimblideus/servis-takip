# Sayaç e-postası kurulumu — adım adım

Cihaz sayaç raporunu e-postayla gönderir, sistem okur ve işler. Kimse gezmez,
kimse fotoğraf beklemez. Yüzlerce makinesi olan firmada filo yazılımı hepsini
tek raporda yollar; her satır kendi cihazına işlenir.

Kurulum **bir kezliktir**. Bittiğinde her yeni bayi kendi adresini Ayarlar
ekranında hazır bulur — bayi başına iş yoktur.

**Paylaşılan sır (bu kurulum için üretildi — gizli tut, herkese açık yere yazma):**

```
5c8ec642ce2bc95837f500dd30e1dfb1a8c51676cb233a0a
```

Bu değer **iki yere** girilecek: Apps Script (ya da ileride Cloudflare Worker)
ve Coolify. İkisi aynı olmazsa uç 401 döner.

---

# A. ŞİMDİ — Gmail üzerinden (alan adı gerekmez, ücretsiz)

Gmail artı-adreslemeyi destekler: `hesabin+abcd1234@gmail.com` adresine gelen
posta senin kutuna düşer ve `To` başlığında kod korunur. Yani bayi kodu şeması
kendi alan adın olmadan da aynen çalışır.

**Bunun tek zayıf yanı satış tarafında:** bayi cihazına `nextusservis@gmail.com`
gibi bir adres yazacak. Teknik olarak kusursuz çalışır, kurumsal durmaz. Alan
adı alınca B bölümüne geçilir, uygulama tarafında hiçbir şey değişmez.

## A1 — Hangi Gmail hesabı

**Öneri: bu iş için yeni bir Gmail aç** (örn. `nextusservis@gmail.com`).
Sebep: adres bayiye görünüyor, ayrıca kişisel kutunda script çalıştırmamış
olursun. Kişisel hesabını kullanırsan da güvenli — script yalnız `+kod@`
kalıbına uyan adresleri dışarı gönderir, diğer postalara hiç dokunmaz — ama
adres bayiye `mehmet1703naim@gmail.com` diye görünür.

Hesap adını not et; A3'te lazım.

## A2 — Apps Script'i kur

1. `script.google.com` → **New project** → adını `nextus-sayac` yap
2. `docs/gmail-sayac-aktar.gs` dosyasının içeriğini kopyala, editöre yapıştır
   (varsayılan `myFunction` içeriğini tamamen sil)
3. En üstteki iki satırı doldur:
   - `UC` → Coolify'daki uygulama adresin + `/api/sayac/eposta`
     (sslip.io adresi de olur)
   - `SIR` → yukarıdaki sır
4. Kaydet (Ctrl+S)
5. Fonksiyon listesinden **`tetikleyiciKur`** seç → **Run**
   - İlk çalıştırmada Google izin isteyecek: **Review permissions** →
     hesabını seç → "Google hasn't verified this app" → **Advanced** →
     **Go to nextus-sayac (unsafe)** → **Allow**.
     (Bu senin kendi hesabında, kendi yazdığın script — uyarı yayımlanmamış
     script'ler için standart.)
6. Log'da `tetikleyici kuruldu: 15 dakikada bir` görmelisin

Bundan sonra script 15 dakikada bir kutuyu tarar. Sayaç ayda bir geldiği için
bu fazlasıyla sık.

## A3 — Coolify (EN SON)

Coolify → uygulama → Environment Variables:

| İsim | Değer |
|---|---|
| `SAYAC_EPOSTA_SECRET` | yukarıdaki sır |
| `SAYAC_EPOSTA_KULLANICI` | Gmail hesabının @ öncesi kısmı (örn. `nextusservis`) |
| `SAYAC_EPOSTA_ALANADI` | `gmail.com` |

Sonra **Redeploy**.

Coolify'ı niye en sona bıraktık: sır tanımlandığı anda bayiler Ayarlar'da
adreslerini görmeye başlar. Adres henüz posta almıyorsa, bayiye tutulamayacak
bir söz vermiş olursun.

## A4 — Doğrula

**Uç ayakta mı:** Ayarlar ekranını aç. **Cihazdan Otomatik Sayaç** kartı
görünüyorsa sır işlendi. Görünmüyorsa sır Coolify'a geçmemiş ya da redeploy
edilmemiş.

**Hat çalışıyor mu:** karttaki adresi kopyala, başka bir e-posta hesabından o
adrese **düz metin** olarak şunu gönder (seri sistemdeki gerçek bir cihaz
olmalı, sayaç mevcut değerden büyük olmalı):

```
Seri No    Siyah
ABC12345   54321
```

15 dakika içinde menüdeki **Cihazdan Sayaç** ekranında kayıt **İŞLENDİ**
görünmeli, cihazın sayacı güncellenmiş olmalı. Beklemek istemezsen Apps
Script'te `sayaclariAktar` fonksiyonunu elle **Run** et.

## A5 — Sorun çıkarsa

Apps Script → sol menü **Executions** → son çalıştırmanın log'u.

| Belirti | Sebep |
|---|---|
| Ayarlar'da kart yok | `SAYAC_EPOSTA_SECRET` Coolify'da yok ya da redeploy edilmedi |
| Log'da `uc reddetti (401)` | Coolify'daki sır ile script'teki `SIR` farklı |
| Log'da `uc reddetti (503)` | Coolify'da sır tanımlı değil |
| Log'da `bize ait olmayan` sayısı artıyor, aktarılan 0 | Adres artı-kodsuz gönderilmiş; Ayarlar'daki adresi birebir kullan |
| `"bayi":"kod tanınmadı"` | Kod yanlış yazılmış — kopyala-yapıştır kullan |
| Kayıt BEKLIYOR'da kalıyor | Seri sistemde yok, ya da sayaç öncekinden düşük (kasıtlı: sıfırlama kararı bayinin) |
| Hiç çalışmıyor | Tetikleyici kurulmamış: `tetikleyiciKur` fonksiyonunu Run et |

---

# B. ALAN ADI ALINDIĞINDA — yapılacaklar listesi

Aşağısı Gmail kurulumunun yerine geçer. Uygulama kodunda **hiçbir değişiklik
yok**; uç kaynağı umursamıyor, yalnız `to` alanının gelmesini bekliyor.
Toplam ~20 dakika.

### B1 — Alan adını al

Öneri: **Cloudflare Registrar**, `nextusservis.com` (2026-08-15'te boştaydı).
Cloudflare'den alırsan DNS zaten Cloudflare'de olur, nameserver taşıma adımı
hiç olmaz. Maliyet fiyatına satar, gizlilik koruması dahil.

Başka yerden alırsan (GoDaddy, Natro): alan adını Cloudflare'e ekle,
nameserver'ları Cloudflare'inkilerle değiştir, yayılmasını bekle (birkaç saat).

### B2 — Email Routing'i aç

Cloudflare → alan adı → **Email** → **Email Routing** → Get started.
Gerekli MX kayıtlarını Cloudflare kendisi ekler; onaylaman yeterli.

### B3 — Worker oluştur

Workers & Pages → Create → Worker → adı `sayac-worker` → Deploy →
**Edit code** → içeriği tamamen bununla değiştir:

```js
export default {
  async email(message, env) {
    const metin = await new Response(message.raw).text();
    await fetch('https://UYGULAMA-ADRESIN/api/sayac/eposta', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sayac-secret': env.SAYAC_SECRET,
      },
      body: JSON.stringify({
        to: message.to,          // BAYİYİ BU BELİRLER — atlanırsa hat zayıf çalışır
        from: message.from,
        subject: message.headers.get('subject') ?? '',
        text: metin,
      }),
    });
  },
};
```

Sonra Worker → Settings → Variables and Secrets → **Add** → tür **Secret**,
isim `SAYAC_SECRET`, değer aynı sır → Deploy.

### B4 — CATCH-ALL kur

Email → Email Routing → Routing rules → **Catch-all address** →
Action: **Send to a Worker** → `sayac-worker` → Save.

**Tek tek adres tanımlama.** Catch-all, `sayac+abcd1234@`,
`sayac+xyz99999@` — hepsini tek kurala düşürür. Yeni bayide Cloudflare'e hiç
dönmemenin sebebi budur.

### B5 — Coolify'da iki değişkeni güncelle

| İsim | Yeni değer |
|---|---|
| `SAYAC_EPOSTA_KULLANICI` | `sayac` |
| `SAYAC_EPOSTA_ALANADI` | yeni alan adın |

`SAYAC_EPOSTA_SECRET` aynı kalır. Redeploy.

### B6 — Gmail köprüsünü kapat

Apps Script → `nextus-sayac` projesi → sol menü **Triggers** → tetikleyiciyi
sil. (Projeyi silmene gerek yok, tetikleyici yeter.)

### B7 — Bayilere haber ver

**Adresleri değişti.** Bayilerin cihazlarındaki eski Gmail adresi artık posta
üretmez. Yeni adres Ayarlar ekranında görünüyor; bayinin cihazlarında alıcıyı
güncellemesi gerekiyor.

Bu, Gmail'le başlamanın tek gerçek bedelidir — bu yüzden bayiye adres vermeden
önce alan adını almak daha ucuzdur. Az sayıda bayi varken geçiş kolaydır.

---

# Bundan sonra bayi başına ne var

Senin tarafında **hiçbir şey**. Kod veritabanı trigger'ı ile üretiliyor; bayi
hangi yoldan açılırsa açılsın kodu olur ve adresini Ayarlar'da görür.

Bayinin işi: adresi kopyala, cihazın web arayüzünde e-posta/sayaç raporu
alıcısına yapıştır, gönderim gününü ayın 1'i yap.

Yüzlerce makineli firmada tek tek cihaza girilmez: filo yazılımının
(Canon eMaintenance, Konica vCare, PaperCut) toplu sayaç raporu alıcısına aynı
adres yazılır, ayda bir tek e-posta gelir, her satır kendi cihazına işlenir.
