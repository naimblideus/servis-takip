import Link from 'next/link';
import type { MagazaSiparisMetni } from '@/lib/magaza-siparis-metin';

export type MagazaSekmesi = 'bugun' | 'siparisler' | 'urunler' | 'site';

/**
 * Mağazanın dört bölümü — Servis içinden yönetim: bugünkü işler, siparişler,
 * ürün ve fiyat, site ayarları. Mağaza paneline gitmeden.
 */
export function MagazaSekmeleri({ aktif, sm }: { aktif: MagazaSekmesi; sm: MagazaSiparisMetni }) {
  const sekmeler: { k: MagazaSekmesi; href: string; ad: string }[] = [
    { k: 'bugun', href: '/magaza', ad: sm.sekmeBugun },
    { k: 'siparisler', href: '/magaza/siparisler', ad: sm.sekmeSiparisler },
    { k: 'urunler', href: '/magaza/urunler', ad: sm.sekmeUrunler },
    { k: 'site', href: '/magaza/ayarlar', ad: sm.sekmeSite },
  ];
  return (
    <nav aria-label={sm.sekmeEtiketi} style={{ display: 'flex', gap: 4, overflowX: 'auto', borderBottom: '1px solid #e5e7eb', marginTop: 14 }}>
      {sekmeler.map((x) => (
        <Link
          key={x.k}
          href={x.href}
          aria-current={x.k === aktif ? 'page' : undefined}
          style={{
            padding: '0.6rem 0.9rem', whiteSpace: 'nowrap', textDecoration: 'none', fontSize: '0.9rem',
            fontWeight: x.k === aktif ? 800 : 600, color: x.k === aktif ? '#1d4ed8' : '#4b5563',
            borderBottom: `2px solid ${x.k === aktif ? '#1d4ed8' : 'transparent'}`, marginBottom: -1,
          }}
        >
          {x.ad}
        </Link>
      ))}
    </nav>
  );
}
