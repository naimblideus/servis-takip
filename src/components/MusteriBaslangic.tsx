'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useT } from '@/lib/i18n/client';

/**
 * MÜŞTERİ LİSTESİ BOŞKEN — nasıl başlanır?
 *
 * Eskiden boş liste tek bir cümle gösteriyordu, ilk adım da Excel aktarımına
 * gidiyordu. Hiç kaydı olmayan bayinin Excel'i yok; ona "önce liste hazırla"
 * demek işe hiç başlamamak demek. Burada liste istemeyen yol başta durur:
 * müşteri, ilk çağrıda fiş ekranında açılır.
 */
export default function MusteriBaslangic({ ek }: { ek?: ReactNode }) {
  const t = useT();
  const k = t.musteriler.baslangic;
  const kapi: React.CSSProperties = {
    display: 'block', padding: '1rem 1.1rem', borderRadius: '0.75rem',
    border: '1px solid #e5e7eb', background: 'white', textDecoration: 'none', color: '#111827',
  };
  const baslik: React.CSSProperties = { fontWeight: 700, fontSize: '0.95rem' };
  const alt: React.CSSProperties = { fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem', lineHeight: 1.45 };
  return (
    <section aria-labelledby="musteri-baslangic" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.9rem', padding: '1.25rem' }}>
      <h2 id="musteri-baslangic" style={{ fontSize: '1.05rem', fontWeight: 700 }}>{k.baslik}</h2>
      <p style={{ fontSize: '0.875rem', color: '#475569', marginTop: '0.25rem', marginBottom: '1rem' }}>{k.alt}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        <Link href="/tickets/new" style={{ ...kapi, borderColor: '#bbf7d0', background: '#f0fdf4' }}>
          <div style={baslik}>{k.fis}</div>
          <div style={alt}>{k.fisAlt}</div>
        </Link>
        {ek}
        <Link href="/import" style={kapi}>
          <div style={baslik}>{k.excel}</div>
          <div style={alt}>{k.excelAlt}</div>
        </Link>
        <Link href="/customers/new" style={kapi}>
          <div style={baslik}>{k.tek}</div>
          <div style={alt}>{k.tekAlt}</div>
        </Link>
      </div>
    </section>
  );
}
