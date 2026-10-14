'use client';

/**
 * DEMODA DIŞARIYA BAĞLANTI YOK — WhatsApp, arama ve SMS bağlantıları.
 *
 * Herkese açık demodaki müşteri telefonları gerçek biçimli (05xx). Ziyaretçi
 * "Müşteriye yaz"a basıp WhatsApp'ta Gönder'e dokunursa mesaj o numaranın
 * GERÇEK sahibine giderdi; toplantıda yüzlerce kişi aynı demoyu kullanıyor.
 * Sunucu tarafı gönderim zaten kapalı (demo-koruma); bu, tarayıcıdaki
 * bağlantılar için. Yalnız demo oturumunda bağlanır (layout).
 *
 * Engellemek yetmez, göstermek gerekir: bağlantıdaki hazır metin bir kartta
 * gösterilir — "kendi hesabınızda müşteriniz tam olarak bunu alır". Demonun
 * anlatmak istediği de zaten bu metin.
 */
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/client';

type Onizleme = { tur: 'wa' | 'tel'; metin: string };

function cozumle(adres: string): Onizleme | null {
  try {
    if (/^tel:|^sms:/i.test(adres)) return { tur: 'tel', metin: '' };
    const u = new URL(adres, window.location.href);
    if (/(^|\.)wa\.me$|(^|\.)api\.whatsapp\.com$|(^|\.)whatsapp\.com$/i.test(u.hostname)) {
      return { tur: 'wa', metin: u.searchParams.get('text') ?? '' };
    }
  } catch { /* bozuk adres: karışma */ }
  return null;
}

export default function DemoBaglantiKoruma() {
  const t = useT();
  const k = t.demoBaglanti;
  const [onizleme, setOnizleme] = useState<Onizleme | null>(null);

  useEffect(() => {
    const tikla = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      const o = cozumle(a.getAttribute('href') ?? '');
      if (!o) return;
      e.preventDefault();
      e.stopPropagation();
      setOnizleme(o);
    };
    document.addEventListener('click', tikla, true);
    // Bazı ekranlar (muhasebe hatırlatma) bağlantı yerine window.open kullanıyor.
    const asil = window.open;
    window.open = ((adres?: string | URL, ...geri: unknown[]) => {
      const o = adres ? cozumle(String(adres)) : null;
      if (o) { setOnizleme(o); return null; }
      return (asil as (...x: unknown[]) => Window | null).call(window, adres, ...geri);
    }) as typeof window.open;
    return () => {
      document.removeEventListener('click', tikla, true);
      window.open = asil;
    };
  }, []);

  if (!onizleme) return null;
  return (
    <div role="dialog" aria-modal="true" onClick={() => setOnizleme(null)}
      style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 16, padding: '1.25rem', boxShadow: '0 20px 50px -12px rgba(15,23,42,.45)' }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>{onizleme.tur === 'wa' ? k.waBaslik : k.telBaslik}</p>
        <p style={{ margin: '0.4rem 0 0', color: '#475569', fontSize: '0.92rem', lineHeight: 1.5 }}>{onizleme.tur === 'wa' ? k.waMetin : k.telMetin}</p>
        {onizleme.tur === 'wa' && onizleme.metin && (
          <div style={{ marginTop: '0.9rem', background: '#e7fbe9', border: '1px solid #bfeec6', borderRadius: '14px 14px 14px 4px', padding: '0.75rem 0.9rem', color: '#0f2e17', fontSize: '0.92rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {onizleme.metin}
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <a href="/kayit" style={{ flex: '1 1 auto', textAlign: 'center', background: '#0f766e', color: '#fff', borderRadius: 10, padding: '0.65rem 0.9rem', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none' }}>{k.hesapAc}</a>
          <button type="button" onClick={() => setOnizleme(null)}
            style={{ flex: '0 0 auto', background: '#f1f5f9', color: '#0f172a', border: 0, borderRadius: 10, padding: '0.65rem 0.9rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>{k.kapat}</button>
        </div>
      </div>
    </div>
  );
}
