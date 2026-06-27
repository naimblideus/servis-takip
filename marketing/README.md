# Servis Takip — Pazarlama Paketi

> Servis Takip ürününün pazarlama sistemi. **Tek odak: sadece servis takibini pazarlıyoruz**
> (rent-a-car / makine-takip bu kampanyada yok). Kurucu kişisel markası (Mehmet Naim) ile birlikte yürür.

## İçindekiler
| Dosya | Ne işe yarar |
|---|---|
| [00-MARKA-VE-ISIM.md](00-MARKA-VE-ISIM.md) | Marka kimliği: **"Servis Takip" kararı**, jenerik ismi çalıştırma (SEO/tescil), ton, renk, logo, domain checklist |
| [01-GTM-STRATEJI.md](01-GTM-STRATEJI.md) | ICP, konumlandırma, fiyat (₺299/599/1499), kanallar, huni, 90 günlük plan, metrikler |
| [02-ICERIK-KREATIF.md](02-ICERIK-KREATIF.md) | Reklam metni, WhatsApp/soğuk temas, 6-mail onboarding dizisi, sosyal takvim, **personal branding** |
| [03-CRM-OTOMASYON.md](03-CRM-OTOMASYON.md) | Araç yığını, pipeline, otomasyon akışları, ürün↔pazarlama köprüsü, ölçüm panosu |
| [landing/index.html](landing/index.html) | Tek dosya tanıtım sayfası (kaynak) — Kaçan Gelir hesaplayıcı + fiyat + kurucu + lead formu |
| [landing/build-landing.js](landing/build-landing.js) | index.html'i Next bileşenine (`src/app/_landing/Landing.tsx`) çeviren üreteç |

## Landing artık uygulamada
Halka açık landing **uygulamanın `/` rotasına gömüldü** (`src/app/page.tsx`): girişsiz ziyaretçi
landing'i görür, girişli kullanıcı doğrudan `/dashboard`'a gider. Landing'i değiştirmek için
`landing/index.html`'i düzenle, sonra `node marketing/landing/build-landing.js` çalıştır.

## YAPILDI ✅
- [x] Marka kararı: "Servis Takip" (00) + tüm paket bu isme çevrildi
- [x] Landing uygulamanın `/` rotasına gömüldü (dev:3002'de doğrulandı)
- [x] Notion CRM pipeline veritabanı + 6 örnek lead → https://app.notion.com/p/70d80e03498e40eaa43a851a549a85f4
- [x] Canva: acı-odaklı Instagram reklamı için 4 aday üretildi (seçim bekliyor)

## 🚨 CANLI ÖNCESİ ZORUNLU (launch-blocker — adversarial review buldu)
Bunlar olmadan yayınlama:
- [ ] **WhatsApp numarası:** `landing/index.html` içindeki `var STK_WHATSAPP='905551234567'` → GERÇEK numara (ülke kodu+numara, + ve 0 olmadan). Tüm WA butonları (form/kurucu/mobil) buradan beslenir. Sonra `node marketing/landing/build-landing.js` çalıştır.
- [ ] **Kurucu sosyal linkleri:** `.socials` içindeki LinkedIn/Instagram `href="#"` → gerçek profiller (yoksa o linki sil).
- [ ] **Giriş linki:** nav `Giriş Yap` `/login` — app içinde doğru; ayrı domaine taşırsan tam URL yaz.
> Not: review v2'de uydurma "31/50 bayi" sayacı, sahte "0xxx" telefon ve doğrulanamayan "WIN EURASIA" duyurusu **zaten kaldırıldı**. Hero'daki ₺12.000 gerçek Kütahya referansına dayanıyor ("bir bayide ilk ay" diye dürüst etiketlendi).

## Açık işler (sıradaki)
- [ ] **Deploy:** `src/app/page.tsx` + `src/app/_landing/` commit + push → Coolify Redeploy
- [ ] Canva adayını seç (hesaba ekle) + Story / poster / LinkedIn görselleri üret
- [ ] Lead formunu CRM'e bağla: `/api/leads` route (Notion'a yazar) veya Formspree
- [ ] İlk 200 firmalık outbound listesi (Notion CRM'e) + günde 10 dokunuş
- [ ] Personal branding postlarını yayınla (02, haftada 3); TÜRKPATENT logolu başvuru

## Landing'i değiştirme akışı
`landing/index.html` tek kaynak → düzenle → `node marketing/landing/build-landing.js` → `src/app/_landing/Landing.tsx` otomatik güncellenir (CSS/HTML `dangerouslySetInnerHTML`, JS `next/script` string; tsc/eslint denetlemez, `next build` kırılmaz).
