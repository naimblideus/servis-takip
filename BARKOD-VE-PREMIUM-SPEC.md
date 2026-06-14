# Barkod + Faturalar/Tahsilat Premium — Uygulama Spec'i

> Hedef: KOBİ'lere cihaz veren bir fotokopi/baskı işletmesinin günlük operasyonunu
> hızlandıran barkod akışı + yasal/finansal olarak eksiksiz, premium görünümlü
> faturalama & tahsilat. Donanım kararı: **2D imager, USB (HID keyboard-wedge)** —
> Zebra DS2208 standart. 2D olduğu için hem ürün EAN'ını hem cihaz QR'ını okur.

## FAZ 1 — Barkod çekirdeği (bu commit)
1. **Şema:** `Part.barcode String?` + `@@unique([tenantId, barcode])` + idempotent migration
   (`20260615000000_add_part_barcode`). Deploy'da apply-migrations.js otomatik uygular.
2. **Güvenlik (IDOR fix):** `POST/DELETE /api/tickets/[id]/parts` parça lookup'ı
   `findUnique({id})` → `findFirst({id, tenantId})`. (Barkod akışı bu endpoint'i tetikliyor.)
3. **Barkod ile parça ekleme:** aynı endpoint `body.barcode` kabul eder → tenant-scoped
   barcode lookup → fişe ekle. Yeni endpoint gerekmez.
4. **`useBarcodeWedge` hook:** global keydown buffer; HID okuyucu (hızlı tuş + Enter)
   ile insan yazımını ayırır; input/textarea odaktayken devre dışı (çakışma yok).
5. **`BarcodeScanner` bileşeni:** HID modu (görünmez dinleyici + "okutmaya hazır" rozeti).
   (Kamera modu @zxing FAZ 3'te — 2D imager varken gerek yok.)
6. **Stok kartında barkod:** StockTab formuna `barcode` alanı + /api/stock GET/POST/PATCH'e dahil.
   Stok arama barkodu da kapsar → okut→bul.

## FAZ 2 — Faturalar & Tahsilat premium (sonraki)
- Fatura **yazdır/PDF**: cari-ekstre ile aynı premium şablon (logo, KDV, vade, kalem tablosu, imza).
- Faturada **durum aksiyonları** (iptal, e-Arşiv kuyruğu rozeti), gecikme rozeti.
- Tahsilat: barkod/fiş no ile hızlı müşteri seçimi, makbuz yazdırma, kısmi mahsup önizleme cilası.
- Görsel: premium kart/tablo dili (cari-ekstre print sayfasındaki gradient başlık + rozet sistemi).

## FAZ 3 — Yasal/ölçek (ileri)
- e-Fatura/e-Arşiv entegratör (mevcut LogoSyncLog kuyruğunu işle).
- Çok-oranlı KDV + tevkifat. Kamera-tabanlı tarama (mobil/saha).

## Barkod akış noktaları
- **Servis fişi** (`TicketPartsPanel`): okut → parça otomatik fişe eklenir (stok düşer).
- **Stok** (`StockTab`): okut → kalem bulunur/düzenlenir; yeni kalemde barkod alanına yazılır.
- **Cihaz**: mevcut QR (`/qr/[code]`) — 2D imager okutunca cihaza gider. Ek iş yok.
- **Dispatch kuralı:** kod `DEV-…` ise cihaz QR; aksi halde parça barkodu.
