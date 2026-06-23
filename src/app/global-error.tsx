'use client';

import { useEffect } from 'react';

// Kök hata sınırı (layout'ın kendisi patlarsa). Kendi <html>/<body>'sini içerir.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('GLOBAL ERROR:', error?.message, error?.digest); }, [error]);

  return (
    <html lang="tr">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0f172a', color: 'white' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ maxWidth: 440 }}>
            <div style={{ fontSize: '2.6rem' }}>⚠️</div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0.5rem 0' }}>Sistem hatası</h2>
            <p style={{ color: '#94a3b8', lineHeight: 1.6, margin: '0 0 1.25rem' }}>Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.</p>
            <button onClick={() => reset()} style={{ padding: '0.6rem 1.3rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Tekrar Dene</button>
          </div>
        </div>
      </body>
    </html>
  );
}
