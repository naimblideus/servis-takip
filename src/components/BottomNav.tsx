'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

// Mobil alt sekme çubuğu (yalnız telefon; md+ gizli). Günlük hızlı erişim.
// Tam menü Sidebar'ın üst-bar hamburgerinde. Ortadaki FAB = Barkodla Satış (sahanın en sık işi).
const PATHS: Record<string, string> = {
  home: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10',
  file: 'M9 12h6m-6 4h6M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z',
  scan: 'M4 8V5a1 1 0 011-1h3M4 16v3a1 1 0 001 1h3M20 8V5a1 1 0 00-1-1h-3M20 16v3a1 1 0 01-1 1h-3M7 8v8M10 8v8M13 8v8M16 8v8',
  store: 'M4 7l1.2-3h13.6L20 7M5 7v11a1 1 0 001 1h12a1 1 0 001-1V7M4 7h16M9 19v-6h6v6',
  users: 'M17 20h5v-2a3 3 0 00-5.4-1.8M7 20H2v-2a3 3 0 015.4-1.8M7 20h10M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  calc: 'M9 7h6M9 11h.01M13 11h.01M9 15h.01M13 15h.01M8 3h8a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1z',
};

function Ic({ name, size = 23 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

export default function BottomNav({ modules = [] }: { modules?: string[] }) {
  const pathname = usePathname();
  const [badge, setBadge] = useState(0);
  const hasMarket = modules.includes('MARKETPLACE');

  useEffect(() => {
    if (!hasMarket) return;
    let alive = true;
    const load = () => fetch('/api/market/notifications').then((r) => (r.ok ? r.json() : null)).then((d) => { if (alive && d) setBadge(d.actionable || 0); }).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [hasMarket]);

  const active = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const left = [
    { href: '/dashboard', label: 'Ana', icon: 'home' },
    { href: '/tickets', label: 'Fişler', icon: 'file' },
  ];
  const right = [
    hasMarket ? { href: '/market', label: 'Pazar', icon: 'store', badge: true } : { href: '/customers', label: 'Müşteri', icon: 'users', badge: false },
    { href: '/accounting', label: 'Muhasebe', icon: 'calc', badge: false },
  ];

  const Item = ({ it }: { it: { href: string; label: string; icon: string; badge?: boolean } }) => (
    <Link href={it.href}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textDecoration: 'none', color: active(it.href) ? '#0F2253' : '#98A1B5', padding: '7px 0 5px', position: 'relative', transition: 'color .2s cubic-bezier(.32,.72,0,1)' }}>
      <Ic name={it.icon} />
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '-.01em' }}>{it.label}</span>
      {it.badge && badge > 0 && (
        <span style={{ position: 'absolute', top: 3, right: 'calc(50% - 22px)', background: '#D64545', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 999, minWidth: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{badge}</span>
      )}
    </Link>
  );

  return (
    <nav className="md:hidden print:hidden" aria-label="Alt menü"
      style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 45, background: '#fff', borderTop: '1px solid rgba(15,34,83,.08)', display: 'flex', alignItems: 'flex-end', padding: '0 6px', paddingBottom: 'env(safe-area-inset-bottom)', boxShadow: '0 -6px 20px -14px rgba(15,34,83,.3)' }}>
      {left.map((it) => <Item key={it.href} it={it} />)}
      {/* Barkodla Satış FAB */}
      <Link href="/satis" aria-label="Barkodla Satış" style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <span style={{ width: 54, height: 54, borderRadius: 999, background: '#0E9F6E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: -20, boxShadow: '0 12px 22px -8px rgba(14,159,110,.6)', border: '4px solid #fff', transition: 'transform .2s cubic-bezier(.32,.72,0,1)' }}>
          <Ic name="scan" size={26} />
        </span>
      </Link>
      {right.map((it) => <Item key={it.href} it={it} />)}
    </nav>
  );
}
