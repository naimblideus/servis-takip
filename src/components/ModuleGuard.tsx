'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { moduleForHref, MODULES } from '@/lib/modules';
import { useT } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { turdaAcik, type HesapTuru } from '@/lib/menu-aileleri';

// Sayfa kapısı: geçerli yol kapalı bir modüle aitse içeriği gösterme, "paket dışı" ekranı göster.
// (Sidebar zaten linki gizler; bu, direkt URL erişimine karşı savunma.)
// Hesap türü de burada: baskı merkezinde bayi ekranı (cihaz, sayaç...), bayide
// baskı ekranı açılmaz. Verinin asıl kapısı sunucuda (lib/matbaa-kapi).
export default function ModuleGuard({ modules, tur = 'BAYI', children }: { modules: string[]; tur?: HesapTuru; children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname() || '';
  const mod = moduleForHref(pathname);

  if (!turdaAcik(pathname, tur)) {
    const ana = tur === 'MATBAA' ? '/matbaa' : '/dashboard';
    return (
      <div style={{ maxWidth: 540, margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0.6rem 0' }}>{tur === 'MATBAA' ? t.ortak.matbaadaYok : t.ortak.bayideYok}</h2>
        <Link href={ana} style={{ display: 'inline-block', marginTop: '1rem', padding: '0.65rem 1.3rem', background: '#0f2253', color: 'white', borderRadius: 8, textDecoration: 'none', fontWeight: 700 }}>{t.ortak.paneleDon}</Link>
      </div>
    );
  }

  if (mod && !modules.includes(mod)) {
    return (
      <div style={{ maxWidth: 540, margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.6rem' }}>🔒</div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0.6rem 0' }}>{doldur(t.ortak.modulYok, { ad: t.modul.ad[mod] })}</h2>
        <p style={{ color: '#6b7280', margin: '0 0 1.3rem', lineHeight: 1.5 }}>
          {t.ortak.modulYokAlt}
        </p>
        <Link href="/dashboard" style={{ display: 'inline-block', padding: '0.65rem 1.3rem', background: '#0f2253', color: 'white', borderRadius: 8, textDecoration: 'none', fontWeight: 700 }}>{t.ortak.paneleDon}</Link>
      </div>
    );
  }

  return <>{children}</>;
}
