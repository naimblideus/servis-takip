'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

// Mobil alt sekme çubuğu (yalnız telefon; md+ gizli). Günlük hızlı erişim.
// Ortadaki "+" = Hızlı İşlem sheet'i (tek aksiyona mahkum etmez; bayi en sık işini seçer).
// Tam menü Sidebar'ın üst-bar hamburgerinde.
const PATHS: Record<string, string> = {
  home: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10',
  file: 'M9 12h6m-6 4h6M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z',
  scan: 'M4 8V5a1 1 0 011-1h3M4 16v3a1 1 0 001 1h3M20 8V5a1 1 0 00-1-1h-3M20 16v3a1 1 0 01-1 1h-3M7 8v8M10 8v8M13 8v8M16 8v8',
  store: 'M4 7l1.2-3h13.6L20 7M5 7v11a1 1 0 001 1h12a1 1 0 001-1V7M4 7h16M9 19v-6h6v6',
  users: 'M17 20h5v-2a3 3 0 00-5.4-1.8M7 20H2v-2a3 3 0 015.4-1.8M7 20h10M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  calc: 'M9 7h6M9 11h.01M13 11h.01M9 15h.01M13 15h.01M8 3h8a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1z',
  box: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  plus: 'M12 5v14M5 12h14',
  chev: 'M9 6l6 6-6 6',
};

function Ic({ name, size = 23 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

const ACTIONS = [
  { href: '/tickets/new', label: 'Yeni Servis Fişi', icon: 'file', bg: '#EAF7F0', fg: '#0B6B4A' },
  { href: '/satis', label: 'Barkodla Satış', icon: 'scan', bg: '#E7F0FF', fg: '#1D5FA5' },
  { href: '/inventory/scan', label: 'Stok Giriş / Çıkış', icon: 'box', bg: '#FEF3E7', fg: '#8A5A08' },
];

export default function BottomNav({ modules = [] }: { modules?: string[] }) {
  const pathname = usePathname();
  const [badge, setBadge] = useState(0);
  const [sheet, setSheet] = useState(false);
  const hasMarket = modules.includes('MARKETPLACE');

  useEffect(() => {
    if (!hasMarket) return;
    let alive = true;
    const load = () => fetch('/api/market/notifications').then((r) => (r.ok ? r.json() : null)).then((d) => { if (alive && d) setBadge(d.actionable || 0); }).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [hasMarket]);

  // Sayfa değişince sheet'i kapat
  useEffect(() => { setSheet(false); }, [pathname]);

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
    <>
      {/* Hızlı işlem — backdrop */}
      <div onClick={() => setSheet(false)} aria-hidden={!sheet} className="md:hidden print:hidden"
        style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(11,21,51,.42)', opacity: sheet ? 1 : 0, pointerEvents: sheet ? 'auto' : 'none', transition: 'opacity .25s cubic-bezier(.32,.72,0,1)' }} />

      {/* Hızlı işlem — sheet */}
      <div role="dialog" aria-label="Hızlı işlem" className="md:hidden print:hidden"
        style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 51, background: '#fff', borderRadius: '22px 22px 0 0', padding: '10px 14px calc(16px + env(safe-area-inset-bottom))', boxShadow: '0 -18px 44px -20px rgba(11,21,51,.5)', transform: sheet ? 'translateY(0)' : 'translateY(115%)', transition: 'transform .32s cubic-bezier(.32,.72,0,1)' }}>
        <div style={{ width: 40, height: 5, borderRadius: 999, background: 'rgba(15,34,83,.15)', margin: '2px auto 12px' }} />
        <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700, color: '#98A1B5', margin: '0 4px 10px' }}>Hızlı işlem</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {ACTIONS.map((a) => (
            <Link key={a.href} href={a.href} onClick={() => setSheet(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 14, background: '#F5F7FB', textDecoration: 'none', color: '#0B1533' }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: a.bg, color: a.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Ic name={a.icon} size={22} /></span>
              <span style={{ fontWeight: 600, fontSize: 15, flex: 1 }}>{a.label}</span>
              <span style={{ color: '#B6BECF' }}><Ic name="chev" size={18} /></span>
            </Link>
          ))}
        </div>
      </div>

      {/* Alt sekme çubuğu */}
      <nav className="md:hidden print:hidden" aria-label="Alt menü"
        style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 45, background: '#fff', borderTop: '1px solid rgba(15,34,83,.08)', display: 'flex', alignItems: 'flex-end', padding: '0 6px', paddingBottom: 'env(safe-area-inset-bottom)', boxShadow: '0 -6px 20px -14px rgba(15,34,83,.3)' }}>
        {left.map((it) => <Item key={it.href} it={it} />)}
        {/* Hızlı İşlem FAB (+/×) */}
        <button onClick={() => setSheet((s) => !s)} aria-label="Hızlı işlem" aria-expanded={sheet}
          style={{ flex: 1, display: 'flex', justifyContent: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          <span style={{ width: 54, height: 54, borderRadius: 999, background: '#0F2253', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: -20, boxShadow: '0 12px 22px -8px rgba(15,34,83,.55)', border: '4px solid #fff', transform: sheet ? 'rotate(45deg)' : 'rotate(0)', transition: 'transform .3s cubic-bezier(.32,.72,0,1)' }}>
            <Ic name="plus" size={26} />
          </span>
        </button>
        {right.map((it) => <Item key={it.href} it={it} />)}
      </nav>
    </>
  );
}
