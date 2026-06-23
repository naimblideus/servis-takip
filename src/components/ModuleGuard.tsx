'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { moduleForHref, MODULES } from '@/lib/modules';

// Sayfa kapısı: geçerli yol kapalı bir modüle aitse içeriği gösterme, "paket dışı" ekranı göster.
// (Sidebar zaten linki gizler; bu, direkt URL erişimine karşı savunma.)
export default function ModuleGuard({ modules, children }: { modules: string[]; children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const mod = moduleForHref(pathname);

  if (mod && !modules.includes(mod)) {
    return (
      <div style={{ maxWidth: 540, margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.6rem' }}>🔒</div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0.6rem 0' }}>{MODULES[mod].label} — paketinizde yok</h2>
        <p style={{ color: '#6b7280', margin: '0 0 1.3rem', lineHeight: 1.5 }}>
          Bu özellik mevcut paketinize dahil değil. Açtırmak için bizimle iletişime geçin.
        </p>
        <Link href="/dashboard" style={{ display: 'inline-block', padding: '0.65rem 1.3rem', background: '#0f2253', color: 'white', borderRadius: 8, textDecoration: 'none', fontWeight: 700 }}>← Panele dön</Link>
      </div>
    );
  }

  return <>{children}</>;
}
