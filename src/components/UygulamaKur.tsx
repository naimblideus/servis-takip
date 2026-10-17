'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/client';

/**
 * TELEFONA KUR — uygulama mağazası olmadan tek dokunuşla.
 *
 * ── NEDEN ────────────────────────────────────────────────────────────────
 * Rakiplerin en somut üstünlüğü mağazadan indirilen uygulama. Bizim panel
 * zaten ana ekran uygulaması (tam ekran açılır, çevrimdışı kabuk var,
 * kendiliğinden güncellenir) ama bunu bilen yoktu: uygulama içinde kurma
 * yolu hiç gösterilmiyordu, teknisyen her gün tarayıcıya adres yazıyordu.
 *
 * Android / Chrome: tarayıcının kendi kurulum penceresi (beforeinstallprompt).
 * iPhone / iPad: Apple kurulum penceresine izin vermiyor; iki adımı
 * gösteriyoruz (Paylaş → Ana Ekrana Ekle).
 *
 * Zaten kuruluysa (standalone), kullanıcı kapattıysa (30 gün) ya da ekran
 * dokunmatik değilse görünmez: masaüstünde gürültü olurdu.
 */

type KurulumOlayi = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const KAPAT_ANAHTARI = 'nextus-uygulama-kur-kapat';
const KAPALI_GUN = 30;

function kapatildiMi(): boolean {
  try {
    const v = Number(localStorage.getItem(KAPAT_ANAHTARI) || 0);
    return v > 0 && Date.now() - v < KAPALI_GUN * 86_400_000;
  } catch {
    return false;
  }
}

export default function UygulamaKur() {
  const t = useT();
  const k = t.uygulamaKur;
  const [olay, setOlay] = useState<KurulumOlayi | null>(null);
  const [ios, setIos] = useState(false);
  const [goster, setGoster] = useState(false);
  const [iosAdim, setIosAdim] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const kurulu = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const dokunmatik = window.matchMedia('(pointer: coarse)').matches;
    if (kurulu || !dokunmatik || kapatildiMi()) return;

    const ua = navigator.userAgent;
    const iosCihaz = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (iosCihaz) {
      setIos(true);
      setGoster(true);
      return;
    }
    const yakala = (e: Event) => {
      e.preventDefault();
      setOlay(e as KurulumOlayi);
      setGoster(true);
    };
    const kuruldu = () => setGoster(false);
    window.addEventListener('beforeinstallprompt', yakala);
    window.addEventListener('appinstalled', kuruldu);
    return () => {
      window.removeEventListener('beforeinstallprompt', yakala);
      window.removeEventListener('appinstalled', kuruldu);
    };
  }, []);

  const kapat = () => {
    try { localStorage.setItem(KAPAT_ANAHTARI, String(Date.now())); } catch { /* özel sekme: yalnız bu oturumda gizli */ }
    setGoster(false);
    setIosAdim(false);
  };

  const kur = async () => {
    if (ios) { setIosAdim(true); return; }
    if (!olay) return;
    await olay.prompt();
    const secim = await olay.userChoice.catch(() => ({ outcome: 'dismissed' }));
    setOlay(null);
    if (secim.outcome === 'accepted') setGoster(false);
  };

  if (!goster) return null;

  return (
    <>
      <div className="md:hidden print:hidden" role="region" aria-label={k.baslik}
        style={{ margin: '0.75rem 1rem 0', background: '#0F2253', color: '#fff', borderRadius: 14, padding: '0.8rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: '0 8px 22px -14px rgba(15,34,83,.7)' }}>
        <span aria-hidden style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M12 7v7" /><path d="m9 11 3 3 3-3" /></svg>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{k.baslik}</div>
          <div style={{ fontSize: '0.78rem', opacity: 0.82, lineHeight: 1.35, marginTop: 2 }}>{k.alt}</div>
        </div>
        <button type="button" onClick={kur}
          style={{ minHeight: 40, padding: '0 0.95rem', borderRadius: 10, border: 'none', background: '#fff', color: '#0F2253', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', flexShrink: 0 }}>
          {k.kur}
        </button>
        <button type="button" onClick={kapat} aria-label={k.kapat}
          style={{ minWidth: 36, minHeight: 40, border: 'none', background: 'transparent', color: 'rgba(255,255,255,.75)', fontSize: '1.25rem', cursor: 'pointer', flexShrink: 0 }}>
          ×
        </button>
      </div>

      {iosAdim && (
        <div role="dialog" aria-modal="true" aria-label={k.iosBaslik} className="print:hidden"
          onClick={() => setIosAdim(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(11,21,51,.5)', display: 'flex', alignItems: 'flex-end', touchAction: 'none' }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', background: '#fff', borderRadius: '22px 22px 0 0', padding: '1.1rem 1.1rem calc(1.25rem + env(safe-area-inset-bottom))', color: '#0B1533' }}>
            <div style={{ width: 40, height: 5, borderRadius: 999, background: 'rgba(15,34,83,.15)', margin: '0 auto 0.9rem' }} />
            <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: '0.85rem' }}>{k.iosBaslik}</div>
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.7rem' }}>
              <li style={{ display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: '#EEF2FA', color: '#1D3E7E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 15V3" /><path d="m8 7 4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>
                </span>
                <span style={{ fontSize: '0.95rem' }}>{k.iosAdim1}</span>
              </li>
              <li style={{ display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: '#EEF2FA', color: '#1D3E7E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8" /><path d="M8 12h8" /></svg>
                </span>
                <span style={{ fontSize: '0.95rem' }}>{k.iosAdim2}</span>
              </li>
            </ol>
            {/* "Tamam" yalnız adımları kapatır; şeridi 30 gün gizleyen şeritteki ×. */}
            <button type="button" onClick={() => setIosAdim(false)}
              style={{ marginTop: '1.1rem', width: '100%', minHeight: 46, borderRadius: 12, border: 'none', background: '#0F2253', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
              {k.tamam}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
