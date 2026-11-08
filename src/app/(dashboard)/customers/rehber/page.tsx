'use client';

import Link from 'next/link';
import RehberdenEkle from '@/components/RehberdenEkle';
import { useT } from '@/lib/i18n/client';

/** Telefon rehberinden müşteri seçme (kaydı olmayan bayinin hızlı başlangıcı). */
export default function RehberdenMusteriSayfasi() {
  const t = useT();
  return (
    <div style={{ padding: '2rem', maxWidth: '720px' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <Link href="/customers" style={{ color: '#6b7280', fontSize: '0.875rem', textDecoration: 'none' }}>← {t.menu['/customers']}</Link>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 'bold', marginTop: '0.25rem' }}>{t.rehberEkle.baslik}</h1>
      </div>
      <RehberdenEkle />
    </div>
  );
}
