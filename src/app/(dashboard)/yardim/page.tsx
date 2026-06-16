'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Section { id: string; icon: string; title: string; intro?: string; steps: string[]; tip?: string }

const SECTIONS: Section[] = [
  {
    id: 'mantik', icon: '🔗', title: 'Sistem nasıl çalışır? (önce bunu oku)',
    intro: 'Her şey basit bir zincir: Müşteri → Cihaz → Servis Fişi → Fatura → Tahsilat. Aşağıdaki sıra, sıfırdan başlayıp sistemi tam kullanmanı sağlar.',
    steps: [
      'Müşteri = hizmet verdiğin firma/kişi.',
      'Cihaz = müşterinin yazıcı/fotokopisi (kiralıksa sayaç + aylık kira buradan işler).',
      'Servis Fişi = arıza/bakım kaydı; parça + işçilik girilir.',
      'Fatura = sayaç + kira + servis tek faturada (ay sonu otomatik birleşir).',
      'Tahsilat = ödeme girilir, en eski açık faturadan otomatik düşülür (FIFO), makbuz çıkar.',
    ],
    tip: 'Aşağıdaki bölümleri sırayla yaparsan ilk gününde sistemi uçtan uca kullanmış olursun.',
  },
  {
    id: 'musteri', icon: '👤', title: '1) Müşteri ekleme',
    steps: [
      'Sol menü → Müşteriler → "＋ Yeni Müşteri".',
      'Ad ve telefon zorunlu. Adres alanına yazmaya başla → çıkan listeden seç (otomatik dolar); listede yoksa elle yaz, yine kaydedebilirsin.',
      'Kaydet. Müşteri detayında 📞 Ara · 💬 WhatsApp · 🗺️ Yol Tarifi butonları otomatik gelir.',
    ],
    tip: 'Adresi düzgün girersen "Yol Tarifi" tek dokunuşla navigasyon başlatır.',
  },
  {
    id: 'cihaz', icon: '🖨️', title: '2) Cihaz (makine) ekleme',
    steps: [
      'Müşteri detayı veya Cihazlar → "＋ Yeni Cihaz".',
      'Marka, model, seri no gir. Kiralıksa "Kiralık" işaretle → aylık kira + sayaç birim fiyatlarını gir.',
      'Kaydet. Cihaza otomatik bir QR kod üretilir (cihaz detayındaki "QR Kod").',
      'Cihaz detayından QR etiketini bas, makineye yapıştır → müşteri o QR ile arıza bildirebilir (bkz. bölüm 9).',
    ],
  },
  {
    id: 'stok', icon: '📦', title: '3) Stok & barkod (parça)',
    steps: [
      'Stok ekranından parça (toner, drum, yedek parça) ekle.',
      'Barkodu olan parçada "Barkod" alanına okuyucuyla okut/yaz → kaydet (artık okutunca bulunur).',
      'Barkodu yoksa: "🏷️ Etiket Yazdır" → Code 128 etiket bas, ürüne yapıştır (SKU kodlanır).',
      '"📦 Hızlı Giriş/Çıkış" → mal gelince Giriş(+), kullanınca Çıkış(−) modunda arka arkaya okut.',
    ],
    tip: 'USB barkod okuyucu (LS2208) bilgisayara takılır, klavye gibi çalışır — sürücü gerekmez.',
  },
  {
    id: 'fis', icon: '🧾', title: '4) Servis fişi açma',
    steps: [
      'Yeni Fiş → müşteri + cihaz seç (ya da makinenin barkodunu okut, müşteri+cihaz otomatik gelsin).',
      'Arızayı yaz. "Kullanılan Parçalar"da parçayı okut → otomatik eklenir, stoktan düşer.',
      'Durum butonları: Yeni → Serviste → Hazır → Teslim. Durumu değiştirince "📱 müşteriye WhatsApp ile bildir" önerisi çıkar.',
      'İşçilik/ücret gir, gerekiyorsa fişi yazdır.',
    ],
  },
  {
    id: 'sayac', icon: '🔢', title: '5) Sayaç okuma (kiralık cihaz)',
    steps: [
      'Cihaz detayı → "Sayaç Okuma" → siyah/renkli sayaç değerini gir.',
      'İstersen "📷 Çek/Yükle" ile sayaç ekranının fotoğrafını ekle (kanıt; geçmişte "📷 Foto" ile açılır).',
      'Ekle → sistem önceki okumaya göre farkı ve ücreti otomatik hesaplar.',
    ],
    tip: 'Düzenli sayaç oku; geç kalanları "🔔 Takip" ekranı gösterir (bkz. bölüm 8).',
  },
  {
    id: 'fatura', icon: '📄', title: '6) Faturalama',
    steps: [
      'Faturalar → "Bu Dönemi Faturala" → sayaç + kira + ödenmemiş servis tek faturada otomatik kesilir.',
      'Faturaya tıkla → "🖨 Yazdır / PDF" ile profesyonel belge; "📱 WhatsApp" ile müşteriye özet gönder.',
      'Açık/kalan tutar ve vade otomatik takip edilir.',
    ],
  },
  {
    id: 'tahsilat', icon: '💰', title: '7) Tahsilat',
    steps: [
      'Tahsilat → müşteri seç → tutar + yöntem gir → "Kaydet ve Otomatik Mahsup Et".',
      'En eski açık faturadan başlayarak otomatik düşülür (FIFO); artan tutar avans olur.',
      '"🧾 Makbuz Yazdır" ile makbuz; "📱 WhatsApp" ile "ödemeniz alındı" mesajı.',
    ],
    tip: 'Dashboard\'da borçlu müşteri kartında "📱 Hatırlat" → vadesi geçenlere tek tık WhatsApp.',
  },
  {
    id: 'takip', icon: '🗺️', title: '8) Takip & Rota (saha)',
    steps: [
      '🔔 Takip → sayacı geç okunan kiralık cihazlar (kaçan faturalama) → "Sayaç Oku"ya git.',
      '🗺️ Rota → aktif fişli müşteriler durak durak; "Tüm rotayı haritada aç" ile sıralı yol tarifi.',
      'Her durakta 📞 Ara · 💬 WhatsApp · 🗺️ Yol Tarifi.',
    ],
  },
  {
    id: 'qr', icon: '🔔', title: '9) QR ile müşteri arıza bildirimi',
    steps: [
      'Cihaz detayındaki QR kodu bas, makineye yapıştır.',
      'Müşteri telefonuyla QR\'ı okutur → giriş gerekmeden "Arıza Bildir" formu açılır.',
      'Müşteri sorunu yazıp gönderir → sistemde otomatik servis fişi açılır.',
    ],
    tip: 'Bu QR (telefonla okunur) ile masadaki Code 128 etiketi (LS2208 ile okunur) farklıdır; ikisi de işine yarar.',
  },
  {
    id: 'mobil', icon: '📱', title: '10) Telefon & barkod okuyucu ipuçları',
    steps: [
      'Telefonda: sol üstteki ☰ ile menü açılır; tüm ekranlar mobil uyumlu.',
      'Barkod okuyucu (LS2208): USB\'den tak, Not Defteri\'nde test et (okutunca yazıp Enter atmalı).',
      'İmleç bir yazı kutusunda değilken okut → sistem otomatik yakalar.',
    ],
  },
];

export default function YardimPage() {
  const [open, setOpen] = useState<string>('mantik');

  return (
    <div style={{ padding: '1.5rem', maxWidth: 820, margin: '0 auto' }}>
      <div style={{ background: 'linear-gradient(135deg,#0f2253,#2563eb)', color: 'white', borderRadius: '1rem', padding: '1.5rem 1.75rem', marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>📘 Nasıl Kullanılır?</h1>
        <p style={{ margin: '0.4rem 0 0', opacity: 0.9, fontSize: '0.95rem', lineHeight: 1.5 }}>
          Sıfırdan başlayan biri için adım adım rehber. Sırayla ilerle; sonunda sistemi uçtan uca kullanabilir hale gelirsin.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '0.6rem' }}>
        {SECTIONS.map((s) => {
          const isOpen = open === s.id;
          return (
            <div key={s.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
              <button
                onClick={() => setOpen(isOpen ? '' : s.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '0.9rem 1.1rem', background: isOpen ? '#f8fafc' : 'white', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ fontSize: '1.2rem' }}>{s.icon}</span>
                <span style={{ flex: 1, fontWeight: 700, fontSize: '0.98rem', color: '#111827' }}>{s.title}</span>
                <span style={{ color: '#9ca3af', fontSize: '1.1rem' }}>{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && (
                <div style={{ padding: '0 1.1rem 1.1rem', borderTop: '1px solid #f3f4f6' }}>
                  {s.intro && <p style={{ color: '#374151', fontSize: '0.9rem', lineHeight: 1.55, margin: '0.85rem 0 0.6rem' }}>{s.intro}</p>}
                  <ol style={{ margin: '0.6rem 0 0', paddingLeft: '1.2rem', display: 'grid', gap: '0.45rem' }}>
                    {s.steps.map((st, i) => (
                      <li key={i} style={{ color: '#1e293b', fontSize: '0.9rem', lineHeight: 1.5 }}>{st}</li>
                    ))}
                  </ol>
                  {s.tip && (
                    <div style={{ marginTop: '0.85rem', background: '#ecfeff', border: '1px solid #a5f3fc', color: '#0e7490', borderRadius: 8, padding: '0.6rem 0.8rem', fontSize: '0.85rem' }}>
                      💡 {s.tip}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <Link href="/customers/new" style={{ display: 'inline-block', padding: '0.7rem 1.4rem', background: 'linear-gradient(135deg,#059669,#10b981)', color: 'white', borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: '0.95rem' }}>
          Hadi başlayalım → İlk müşterini ekle
        </Link>
      </div>
    </div>
  );
}
