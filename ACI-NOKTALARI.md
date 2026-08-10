# Acı Noktaları — müşterimizin müşterisi ne diyor

> Üretildi: 2026-08-10. Kaynak: Google Maps ≤3 yıldız yorumlar.
> Canlı hâli: Nexus CRM → **Acı Noktaları** (`http://localhost:3040/acilar`).
> Tazeleme yöntemi: `nexus-crm/DURUM.md` → *3b. Acı noktaları*.

Bu belgedeki cümleleri biz yazmadık. **Hedef müşterimizin (fotokopi/ofis cihazı
servisi veren bayinin) kendi müşterileri** yazdı. Amaç iki soruya cevap vermek:

- **ÜRÜN** — sıradaki özelliği ne belirlemeli
- **SATIŞ** — hangi cümle kapıyı açar

---

## Veri ne kadar sağlam?

| | Sayı |
|---|---|
| Taranan firma (Google Maps) | 217 |
| Kötü yorum toplanan firma | 83 |
| Toplanan ≤3 yıldız yorum | 345 |
| **Ürün kararına giren yorum** | **68** |
| **Ürün kararına giren firma** | **31** |

345'in 277'si listeye alınmadı. Sebebi önemli: bu yorumlar fotokopi
dükkânlarından, kırtasiyelerden, hazır ofislerden geliyor ve **tezgâh
hizmetini** anlatıyor ("sıra bekledim", "çıktı yavaş"). Bir servis
operasyonunu anlatmıyorlar; yol haritasına girerlerse yanlış şey inşa ederiz.

Süzgeç iki şartı birden arıyor (`urunSinyaliFirmasi`): firma **servis yapıyor**
*ve* **çekirdek segmentte** (fotokopi/toner/yazıcı/büro makinesi). Tek şart
yetmiyordu — segment tek başına fotokopi dükkânını, "servis" tek başına
Kapo Klima Servisi'ni ve Vodafone Kurumsal'ı içeri alıyordu.

> **Havuz tükendi.** CRM'deki servis + çekirdek segment firmalarının tamamı
> gezildi; taranmamış firma kalmadı. 68 yorum bu ICP tanımıyla elimizdeki
> **tüm** veri. Sayıyı büyütmenin yolu daha çok lead toplamak — süzgeci
> gevşetmek değil.

**Örneklem küçük. Bu tablo yön verir, kanıtlamaz.** 9 şikâyetle 5 şikâyet
arasındaki fark istatistiksel değil; ikisi de "var" demektir.

---

## Tablo — 68 yorum, 31 firma

| Tema | Adet | Bizim alanımız mı | servis-takip'te durum |
|---|---|---|---|
| Fatura / ücret anlaşmazlığı | 9 | ✅ | ✅ Var |
| Genel memnuniyetsizlik (somut değil) | 8 | — | — |
| Garanti / iade sorunu | 6 | ⚠️ | ❌ **Yok** |
| İlgisiz / kaba davranış | 5 | — | — |
| Aynı arıza tekrar / çözemedi | 5 | ✅ | ⚠️ Kısmi |
| Telefona çıkmıyor / dönmüyor | 3 | ✅ | ⚠️ Kısmi |
| Cihaz kayboldu / teslim belirsiz | 3 | ✅ | ⚠️ **Kısmi** |
| Ürün/işçilik kalitesi | 3 | — | — |
| Gelmedi / geç geldi / oyaladı | 2 | ✅ | ✅ Var |
| Sınıflanmadı | 24 | — | — |

Sınıflanmayan %35: bir kısmı gerçekten içeriksiz ("Bu normaldi.", "Fena
sayılmaz"), bir kısmı tek seferlik kalıplar. Zorla bir temaya sokulmadı —
yanlış etiket, boş kutudan zararlıdır.

---

## Ürün: üç somut boşluk

Aşağıdakiler şemadan ve rotalardan **doğrulandı**, hafızadan yazılmadı.

### 1. Emanet cihaz kaydı — YOK

> *"SAKIN BU İŞLETMEYE GÜVENİP HERHANGİ BİR DEĞERLİ CİHAZINIZI TESLİM ETMEYİN."*
> *"Cihaz bıraktım, 10 gün mekânda kaldı, ne hikmetse cihaz da yok."*

**Mevcut:** `Device.barcode` (cihazın üstündeki mevcut barkod okutulabiliyor),
`TicketStatus.IN_SERVICE`. `Device.location` müşterideki yeri tutuyor.

**Eksik:** "Şu an bizde olan cihazlar" listesi çıkarılamıyor. Teslim alma anının
kaydı, kimden alındığı, kaç gündür durduğu yok.

**Yapılacak:** `ServiceTicket`'a teslim alma damgası + "bizde bekleyen cihazlar"
ekranı (kaç gündür bizde, kimde). Yeni tablo gerekmiyor.

**Neden bu ilk sırada:** üç şikâyetle destekli, küçük iş, ve şikâyetin cinsi
diğerlerinden farklı — bu bir gecikme değil **güven kaybı**. Satışta en sert
cümleyi buradan kurarsın.

### 2. Garanti alanı — YOK

**Mevcut:** şemada `warranty`/garanti alanı hiç yok. `Device.installedAt` var
(kurulum tarihi) ama garanti başlangıç/bitiş ayrı şey.

**Eksik:** iş emri açılırken "bu cihaz garanti kapsamında mı" görünmüyor.

**Yapılacak:** `Device`'a garanti başlangıç/bitiş + iş emri ekranında rozet.
6 şikâyetle en yüksek adetli somut boşluk.

### 3. Tekrar arıza uyarısı — veri var, uyarı yok

**Mevcut:** `FaultCategory` taksonomisi, `@@index([faultCategory, createdAt])`,
marka/model güvenilirlik raporu.

**Eksik:** "bu cihaza 30 gün içinde ikinci kez geliniyor" uyarısı yok. Veri
duruyor, kimse bakmıyor.

**Yapılacak:** iş emri açılırken aynı `deviceId` için son 30 günde kapanmış
kayıt varsa uyar. Tek sorgu.

### Ayrıca: cevaplanmayan talep için süre eşiği

`PortalRequest` + `/musteri-bildirimleri` bekleyen talebi **sayıyor**, ama süre
eşiği yok (`bekleyen` düz bir `count`). "2 gündür dönülmedi" uyarısı
`PortalRequest.createdAt` üzerine bir eşikle çıkar — yeni tablo gerekmiyor.

---

## Zaten karşılığı olanlar (satışta anlat, yeniden inşa etme)

| Şikâyet | servis-takip'teki karşılığı |
|---|---|
| Fatura / ücret anlaşmazlığı | `CounterReading` + `TicketPart` + `laborCost`; paylaşılabilir belge `/belge/fatura/[id]/[token]` |
| Bilgi vermiyor / unutuyor | Müşteri paneli `/m/[token]` + `AsamaCizelgesi` (aşama çizelgesi) |
| Parça yok / tedarik gecikti | `TicketStatus.WAITING_FOR_PART` + `PrinterStock` |
| Gelmedi / geç geldi | İş emri durumu + WhatsApp bildirimi |

---

## Satışta kullanım kuralı

**Yorumları yüzüne vurma.** "Sizin yorumlarınızı okudum" cümlesi kapıyı kapatır.
Doğrusu:

> *"Sizin gibi firmalarda en sık şu oluyor: müşteri cihazı bırakıyor, bir hafta
> sonra 'benim makine ne oldu' diye arıyor, kimse net cevap veremiyor. Sizde bu
> nasıl yürüyor?"*

Adam kendi yarasını zaten biliyor; senden duymak istemez, sorulmak ister.
CRM'de her firmanın kartında ve Arama Modu'nda o firmanın **konuşulacak konusu**
yazılı çıkıyor — açılış cümlesini ona göre kurarsın.

---

## Bilinçli olarak yapılmayanlar

| Yapılmadı | Neden |
|---|---|
| LLM ile sınıflama | Aynı yorum her çalıştırmada aynı temaya düşmeli; kelime listesi görünür ve elle düzeltilebilir |
| Yorum sahibinin adı | Bize şikâyet lazım, kişi değil — scraper toplamıyor |
| Sınıflanmayanı zorla temaya sokma | Yanlış etiket, boş kutudan zararlı |
| İşletme sahibinin cevabını saklama | Şikâyeti istiyoruz, savunmayı değil — metinden kesiliyor |
