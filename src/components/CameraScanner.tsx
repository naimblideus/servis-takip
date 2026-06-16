'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Telefonun KAMERASIYLA barkod/QR okuma (USB okuyucu olmayan sahada).
 * Tarayıcının yerel BarcodeDetector API'sini kullanır (Android Chrome'da çalışır; sıfır bağımlılık).
 * Desteklenmiyorsa kibarca bilgilendirir — kullanıcı USB okuyucuyla veya elle devam eder.
 */
export default function CameraScanner({ onDetect }: { onDetect: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastHit = useRef<{ code: string; t: number }>({ code: '', t: 0 });

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => () => stop(), []);

  const start = async () => {
    setErr(null); setLast(null); setOpen(true);
    const w = window as any;
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
      setSupported(false);
      return;
    }
    setSupported(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play().catch(() => {});
      }
      let detector: any;
      try {
        detector = new w.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code', 'itf'] });
      } catch {
        detector = new w.BarcodeDetector(); // formatları desteklemiyorsa hepsini dene
      }
      const tick = async () => {
        const v = videoRef.current;
        if (!v || v.readyState < 2) { rafRef.current = requestAnimationFrame(tick); return; }
        try {
          const codes = await detector.detect(v);
          if (codes && codes.length) {
            const raw = (codes[0].rawValue || '').trim();
            const now = Date.now();
            if (raw && (raw !== lastHit.current.code || now - lastHit.current.t > 1500)) {
              lastHit.current = { code: raw, t: now };
              setLast(raw);
              if (navigator.vibrate) navigator.vibrate(60);
              onDetect(raw);
            }
          }
        } catch { /* tek kare hatası — yoksay */ }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e: any) {
      setErr('Kameraya erişilemedi (' + (e?.name || 'izin reddedildi') + '). Tarayıcı kamera iznini ve HTTPS gerekir.');
    }
  };

  const close = () => { stop(); setOpen(false); };

  return (
    <>
      <button type="button" onClick={start}
        style={{ padding: '0.55rem 1rem', background: '#0f2253', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        📷 Kamerayla Tara
      </button>

      {open && (
        <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: '#0b1220', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1rem', color: 'white' }}>
              <span style={{ fontWeight: 700 }}>📷 Barkod / QR Tara</span>
              <button type="button" onClick={close} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: '1rem' }}>✕</button>
            </div>

            {!supported ? (
              <div style={{ padding: '1.5rem', color: '#e5e7eb', fontSize: '0.9rem', lineHeight: 1.6 }}>
                Bu cihaz/tarayıcı kamerayla okumayı desteklemiyor. <b>USB barkod okuyucu (LS2208)</b> kullanın ya da kodu elle yazıp Enter&apos;a basın.
                <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
                  <button type="button" onClick={close} style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Tamam</button>
                </div>
              </div>
            ) : err ? (
              <div style={{ padding: '1.5rem', color: '#fca5a5', fontSize: '0.9rem', lineHeight: 1.6 }}>{err}</div>
            ) : (
              <div style={{ position: 'relative', background: 'black' }}>
                <video ref={videoRef} muted autoPlay playsInline style={{ width: '100%', maxHeight: '60vh', objectFit: 'cover', display: 'block' }} />
                {/* Tarama çerçevesi */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ width: '78%', height: 110, border: '3px solid #34d399', borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,0.25)' }} />
                </div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0.6rem 1rem', background: 'linear-gradient(transparent,rgba(0,0,0,0.7))', color: 'white', fontSize: '0.82rem', textAlign: 'center' }}>
                  {last ? <span style={{ color: '#34d399', fontWeight: 700 }}>✓ Okundu: {last}</span> : 'Barkodu yeşil çerçeveye getirin'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
