# CRM & Pazarlama Otomasyonu — Servora

> Amaç: Tek kişi (sen) varken bile hiçbir lead düşmesin, deneme→ödeme akışı kendi yürüsün.
> Felsefe: **Önce ucuz/bedava araçla başla, gelir gelince yükselt.** Aşırı mühendislik yapma.

---

## 1. Araç yığını (stack) — bütçeye göre

### Aşama 0 — İlk 20 müşteri (≈₺0/ay)
| İhtiyaç | Araç | Not |
|---|---|---|
| Lead/pipeline | **Notion** (bu oturumda bağlı) veya Google Sheets | Basit kanban: Yeni→İletişim→Demo→Deneme→Ödeyen→Kayıp |
| Lead yakalama | Landing form → **Notion API / Google Forms / Formspree** | Landing'de form hazır (aşağıda bağlama) |
| E-posta | **Zoho Mail (bedava)** + elle/şablon | İlk dizileri yarı-otomatik gönder |
| Takvim/demo | **Cal.com (bedava)** veya Calendly | Demo randevusu self-servis |
| WhatsApp | WhatsApp Business (bedava) + hazır yanıtlar | Outbound'un kalbi |
| Takip görevleri | Notion/Google Calendar hatırlatma | "3 gün sonra 2. dokunuş" |

### Aşama 1 — 20–60 müşteri (≈₺0–500/ay)
| İhtiyaç | Araç |
|---|---|
| CRM + otomasyon | **HubSpot Free** (CRM bedava) veya **Brevo (Sendinblue)** — TR'de ucuz, e-posta+otomasyon birlikte |
| E-posta dizisi | Brevo/HubSpot workflows (02-ICERIK'teki diziler) |
| Analytics | **Plausible** (gizlilik dostu) veya GA4 (bedava) |
| Web sohbet | Crisp/Tawk.to (bedava) |

> **Tavsiye:** Aşama 0'da **Notion (CRM) + Brevo (e-posta otomasyonu) + Cal.com (demo)** üçlüsü
> en iyi maliyet/fayda. Bu oturumda Notion bağlı → istersen CRM tablosunu şimdi kurabilirim.

---

## 2. Pipeline (satış hattı) tanımı

**Aşamalar ve çıkış kuralı (her aşamada "ne olursa bir sonrakine geçer"):**
1. **Yeni Lead** — listeye eklendi (outbound/inbound). → ilk dokunuş yapılınca:
2. **İletişimde** — WhatsApp/telefon ulaşıldı. → demo kabul edilince:
3. **Demo Planlandı** — Cal.com randevusu var. → demo yapılınca:
4. **Deneme** — hesap açıldı (demo tenant / trial). → ilk fatura kesilince:
5. **Aktif Deneme** ⭐ (kuzey yıldızı). → ödeme alınınca:
6. **Ödeyen** — abone. → 30 gün sorunsuz:
7. **Sadık/Referans** — vaka çalışması + referans iste.
- **Kayıp** (her aşamadan): sebep etiketle (fiyat / zaman / Excel yeter / rakip / yanıtsız) → 90 gün sonra yeniden ısıt.

**Her lead'de tutulacak alanlar:** Firma, Yetkili, Telefon, Şehir, Cihaz sayısı (≈), Kaynak,
Aşama, Plan ilgisi, Son temas, Sonraki aksiyon+tarih, Kayıp sebebi, Not.

---

## 3. Otomasyon akışları (kim → ne tetikler → ne olur)

### Akış 1 — Landing lead yakalama (en kritik)
```
Landing formu doldu
  → CRM'e "Yeni Lead" kaydı (otomatik)
  → Sana anında bildirim (e-posta/WhatsApp)
  → Lead'e otomatik "Hoş geldin + demo linki" maili
  → 24 saat içinde temas etmezsen hatırlatma görevi
```

### Akış 2 — Deneme onboarding (02-ICERIK Mail 1–6 dizisi)
```
Trial başladı → 6 mail'lik dizi zamanlı gider (0/1/3/7/11/14. gün)
  → "İlk fatura kesildi" olayı gelirse → dizi durur, "tebrikler + plan seç" maili
  → 14. günde ödeme yoksa → "yardım ister misin" + Cal.com linki
```
> Teknik kanca: Üründe trial/aktivasyon olaylarını CRM'e webhook ile gönder (basit:
> `POST /api/webhooks/crm` → Brevo/HubSpot event). İlk aşamada elle de tetiklenebilir.

### Akış 3 — Demo no-show / yanıtsız
```
Demo randevusu kaçtıysa → otomatik "tekrar planlayalım" maili + yeni Cal.com linki
2. dokunuş yanıtsız → 3 gün sonra WhatsApp hatırlatma görevi
```

### Akış 4 — Ödeyen müşteri yaşam döngüsü
```
Ödeme alındı → "kurulum tamam mı" kontrol maili (3. gün)
Aylık → "kazanç özeti" maili (fatura/tahsilat/yakalanan kaçan gelir)
Kullanım düştü → uyarı + birebir arama görevi
90 gün sadık → vaka çalışması + referans isteği + yıllık plan teklifi
```

---

## 4. Ürün ↔ pazarlama köprüsü (önemli, ihmal etme)

Landing ve CRM'i ürünle bağlayan minimum teknik iş:
1. **Landing → Deneme:** "Ücretsiz Dene" butonu, ürünün kayıt/onboarding akışına gitsin (şu an süper-admin elle tenant açıyor → ileride self-serve trial sayfası; ilk aşamada form→sen elle aç).
2. **Lead webhook:** Landing formu CRM'e yazsın (Formspree/Notion API ile koda dokunmadan başlanabilir).
3. **Aktivasyon olayı:** "İlk fatura kesildi" anını yakala (ürün zaten fatura kesiyor) → CRM'e event → onboarding dizisini akıllı yönet.
4. **UTM takibi:** Tüm reklam/post linklerine `?utm_source=...&utm_campaign=...` ekle → hangi kanal müşteri getiriyor gör. (Landing JS'i UTM'i forma gizli alan olarak taşıyacak şekilde hazır.)

---

## 5. Ölçüm panosu (haftalık doldur)
| Metrik | Kaynak | Hedef |
|---|---|---|
| Yeni lead / hafta | CRM | ≥ 30 |
| Lead→Demo % | CRM | ≥ 20 |
| Demo→Deneme % | CRM | ≥ 60 |
| Deneme→Aktivasyon % | Ürün event | ≥ 40 |
| Aktivasyon→Ödeyen % | CRM | ≥ 50 |
| MRR / Net yeni MRR | CRM/elle | büyüyen |
| Kanal başına CAC | UTM + CRM | < 1 ay abonelik |
| Aylık churn % | CRM | < %3 |

---

## 6. Şimdi yapılabilecek ilk 5 somut adım
1. **Notion CRM tablosu** kur (pipeline aşamaları + alanlar). → *bu oturumda kurabilirim.*
2. **Landing form** bağla (Formspree/Notion) → lead'ler bir yere düşsün.
3. **Cal.com** demo takvimi aç, linki landing + WhatsApp şablonlarına koy.
4. **Brevo** hesabı + onboarding 6-mail dizisini gir (metinler 02-ICERIK'te hazır).
5. **200 firmalık outbound listesi** (Notion'a) → günde 10 dokunuş ritmi başlat.

> İstersen 1 ve 5'i hemen yapayım: Notion'da CRM veritabanını oluşturup pipeline'ı ve örnek
> kayıtları kurayım. Onaylarsan başlıyorum.
