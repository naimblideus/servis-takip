'use client';

import { useEffect } from 'react';
import Link from 'next/link';

// Sayfa düzeyi hata sınırı — beyaz ekran yerine zarif hata + tekrar dene.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Sunucu loglarına düşer (Coolify logs); ileride Sentry'ye de gönderilebilir.
    console.error('APP ERROR:', error?.message, error?.digest);
  }, [error]);

  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ maxWidth: 460, textAlign: 'center' }}>
        <div style={{ fontSize: '2.6rem' }}>⚠️</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0.5rem 0', color: '#0f172a' }}>Bir şeyler ters gitti</h2>
        <p style={{ color: '#64748b', lineHeight: 1.6, margin: '0 0 1.25rem' }}>
          Beklenmeyen bir hata oluştu. Tekrar deneyebilir ya da panele dönebilirsiniz. Sorun sürerse bizimle iletişime geçin.
        </p>
        {error?.digest && <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '1rem' }}>Hata kodu: {error.digest}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={() => reset()} style={{ padding: '0.6rem 1.2rem', background: '#0f2253', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Tekrar Dene</button>
          <Link href="/dashboard" style={{ padding: '0.6rem 1.2rem', background: 'white', color: '#0f2253', border: '1px solid #cbd5e1', borderRadius: 8, fontWeight: 700, textDecoration: 'none' }}>Panele Dön</Link>
        </div>
      </div>
    </div>
  );
}
