'use client';

import { useEffect, useState } from 'react';

/**
 * SERVICE WORKER KAYDI + YENİ SÜRÜM BİLDİRİMİ
 *
 * ── NEDEN ────────────────────────────────────────────────────────────────
 * Teknisyen sahada, müşterinin bodrum katındaki fotokopi odasında. Sinyal
 * yoksa uygulama hiç açılmıyordu (Chrome'un dinozoru). Artık kabuk
 * önbellekten açılıyor ve markalı bir "bağlantı yok" ekranı çıkıyor.
 *
 * ── NEDEN GÜNCELLEME BİLDİRİMİ ───────────────────────────────────────────
 * Service worker'ın klasik tuzağı: bayi eski sürümde kalır ve bunu bilmez.
 * Bu depo günde birkaç kez canlıya çıkıyor; para hesabı değiştiğinde
 * bayinin dünkü koda bakması kabul edilemez. Yeni sürüm hazır olunca
 * KÜÇÜK ve KAPATILABİLİR bir şerit çıkıyor — kendiliğinden yenilemiyoruz,
 * çünkü bayi tam o an bir fişi dolduruyor olabilir.
 *
 * ── GELİŞTİRMEDE KAPALI ──────────────────────────────────────────────────
 * Geliştirme sunucusunda service worker, HMR'ı ve tazelemeyi bozar.
 * Yalnız üretimde kaydedilir; geliştirmede varsa da kaldırılır.
 */
export default function ServiceWorkerKurulum() {
  const [yeniSurum, setYeniSurum] = useState<ServiceWorker | null>(null);
  const [gizlendi, setGizlendi] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // Geliştirmede kayıt YOK — üstelik daha önce kaydolmuşsa temizle,
    // yoksa yerelde eski kabuk sürekli geri gelir.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations()
        .then((hepsi) => hepsi.forEach((r) => r.unregister()))
        .catch(() => undefined);
      return;
    }

    let kayit: ServiceWorkerRegistration | undefined;

    const bekleyeniYakala = (r: ServiceWorkerRegistration) => {
      // Zaten bekleyen bir sürüm varsa (sekme yeniden açıldıysa) hemen göster.
      if (r.waiting) setYeniSurum(r.waiting);
      r.addEventListener('updatefound', () => {
        const gelen = r.installing;
        if (!gelen) return;
        gelen.addEventListener('statechange', () => {
          // controller varsa bu bir GÜNCELLEME; yoksa ilk kurulum (bildirme).
          if (gelen.state === 'installed' && navigator.serviceWorker.controller) {
            setYeniSurum(gelen);
          }
        });
      });
    };

    navigator.serviceWorker.register('/sw.js')
      .then((r) => { kayit = r; bekleyeniYakala(r); })
      // Hatayı YUTMA. İlk yazdığımda sessizce yutuyordum ve kaydın neden
      // olmadığını anlamak için ayrı bir hata ayıklama turu gerekti.
      // Kayıt başarısız olursa uygulama yine çalışır (yalnız çevrimdışı
      // desteği olmaz), ama sebebi konsolda görünsün.
      .catch((e) => console.warn('[sw] kayıt başarısız:', e?.message || e));

    // Yeni sürüm devralınca sayfayı bir kez tazele.
    let tazelendi = false;
    const devralindi = () => {
      if (tazelendi) return;
      tazelendi = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', devralindi);

    // Uygulama uzun süre açık kalabilir (bayi sekmeyi hiç kapatmıyor);
    // saatte bir güncelleme var mı diye bak.
    const saatlik = window.setInterval(() => { kayit?.update().catch(() => undefined); }, 60 * 60 * 1000);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', devralindi);
      window.clearInterval(saatlik);
    };
  }, []);

  if (!yeniSurum || gizlendi) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)',
        zIndex: 60, maxWidth: 'calc(100vw - 2rem)',
        display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
        background: '#0f2253', color: 'white',
        padding: '0.7rem 0.9rem', borderRadius: '0.7rem',
        boxShadow: '0 1px 2px rgba(15,23,42,.14), 0 8px 24px rgba(15,23,42,.18)',
        fontSize: '0.88rem',
      }}
    >
      <span>Yeni sürüm hazır.</span>
      <button
        type="button"
        onClick={() => yeniSurum.postMessage('HEMEN_GUNCELLE')}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '2.25rem', padding: '0 0.9rem',
          background: 'white', color: '#0f2253', border: 0,
          borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
        }}
      >
        Güncelle
      </button>
      <button
        type="button"
        onClick={() => setGizlendi(true)}
        aria-label="Bildirimi kapat"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '2.25rem', minWidth: '2.25rem',
          background: 'transparent', color: 'rgba(255,255,255,.75)',
          border: 0, borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem',
        }}
      >
        ✕
      </button>
    </div>
  );
}
