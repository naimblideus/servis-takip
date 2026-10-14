'use client';

/**
 * AİLE SEKMELERİ — aynı işin ekranları arasında sayfa üstü geçiş.
 *
 * Yan menüde her öğe bir aile (Sayaçlar, Faturalama, Kâr...). Ailenin
 * ekranları sayfanın üstünde sekme olarak durur: Sayaç Turu'ndan Eksik
 * Sayaçlar'a geçmek için menüye dönmek gerekmez.
 *
 * Kimin neyi göreceği yan menüyle AYNI kuraldan geliyor (menu-aileleri).
 * Ayrı karar verseydi, menüde gizli bir ekran burada görünürdü.
 *
 * Yalnız ailenin liste ekranlarında ve en az iki sekme varken çizilir;
 * tek sekmeli çubuk bilgi taşımaz, yalnız yer kaplar.
 */

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useT, useDil } from '@/lib/i18n/client';
import { useRozetler } from '@/lib/use-rozetler';
import { sekmeGosterilir, hrefRozeti } from '@/lib/menu-aileleri';

export default function AileSekmeleri({ modules = [], whatsappKurulu = true, bizimHesapKurulu = false }: { modules?: string[]; whatsappKurulu?: boolean; bizimHesapKurulu?: boolean }) {
  const yol = usePathname();
  const { data: session } = useSession();
  const rol = (session?.user as { role?: string } | undefined)?.role || '';
  const t = useT();
  const { ulke } = useDil();
  const rozet = useRozetler();
  const cubuk = useRef<HTMLElement>(null);

  // Oturum yüklenmeden rol bilinmez. Yanlış sekmeyi bir an gösterip geri
  // almaktansa çubuğu hiç çizmemek daha doğru.
  const s = rol ? sekmeGosterilir(yol, { rol, ulke, moduller: modules, whatsappKurulu, bizimHesapKurulu }) : null;
  const aktifHref = s?.aktif ?? null;

  // AKTİF SEKME GÖRÜNÜR OLSUN. Telefonda çubuk yana kayıyor; Toner Verimi,
  // Sayaç Tarayıcı gibi sondaki sekmeler ekranın dışında kalıyor, bayi hangi
  // ekranda olduğunu göremiyordu. Yalnız çubuğun KENDİ yatay kaydırması
  // değişir (scrollLeft): scrollIntoView sayfayı da dikey kaydırabilirdi.
  // Masaüstünde hepsi sığdığı için kaydırma 0'da kalır.
  useEffect(() => {
    const n = cubuk.current;
    const a = n?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!n || !a || n.scrollWidth <= n.clientWidth) return;
    const nk = n.getBoundingClientRect();
    const ak = a.getBoundingClientRect();
    n.scrollLeft += (ak.left - nk.left) - (nk.width - ak.width) / 2;
  }, [yol, aktifHref]);

  if (!s) return null;

  const ad = (href: string) => (t.menu as Record<string, string>)[href] ?? href;

  return (
    <nav
      ref={cubuk}
      aria-label={t.menuSekme.aria}
      className="print:hidden"
      style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '0 1rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}
    >
      <div style={{ display: 'flex', gap: '0.25rem', whiteSpace: 'nowrap' }}>
        {s.sekmeler.map((h) => {
          const aktif = h === s.aktif;
          const n = hrefRozeti(h, rozet);
          return (
            <Link
              key={h}
              href={h}
              aria-current={aktif ? 'page' : undefined}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.8rem 0.85rem 0.7rem', fontSize: '0.875rem',
                fontWeight: aktif ? 600 : 500,
                color: aktif ? '#0f2253' : '#6b7280',
                borderBottom: `2px solid ${aktif ? '#2563eb' : 'transparent'}`,
                textDecoration: 'none',
              }}
            >
              {ad(h)}
              {n > 0 && (
                <span style={{ background: '#dc2626', color: 'white', fontSize: '0.65rem', fontWeight: 700, borderRadius: 999, padding: '1px 7px', minWidth: 18, textAlign: 'center' }}>{n}</span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
