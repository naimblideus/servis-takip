'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Listing { id: string; kind: string; title: string; price: number; quantity: number; status: string; photos: string[]; city: string | null; }

const KINDS: Record<string, string> = { PART: '🔧', PRINTER: '🖨️', MACHINE: '🏭', OTHER: '📦' };
const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  ACTIVE: { label: 'Aktif', bg: '#E7F6EF', color: '#0B6B4A' },
  PAUSED: { label: 'Duraklatıldı', bg: '#FEF6E7', color: '#8A5A08' },
  SOLD: { label: 'Satıldı', bg: '#EAEDFB', color: '#2E3A8C' },
};
const fmt = (n: number) => '₺' + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function IlanlarimPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/market/my').then((r) => r.json()).then((d) => { setListings(d.listings || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '1.5rem 1.25rem 2.5rem', maxWidth: 860, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.35rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Link href="/market" className="mk-back">← Pazar</Link>
          <div className="mk-eyebrow" style={{ marginTop: 10 }}>Satıcı</div>
          <h1 className="mk-h1">İlanlarım</h1>
        </div>
        <Link href="/market/yeni" className="mk-btn mk-btn-p"><span>Yeni İlan</span><span className="mk-ico">＋</span></Link>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: '.6rem' }}>
          {[0, 1, 2].map((i) => <div key={i} className="mk-sk" style={{ height: 78, borderRadius: 14 }} />)}
        </div>
      ) : listings.length === 0 ? (
        <div className="mk-shell">
          <div className="mk-core" style={{ padding: '2.75rem 1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.3rem', marginBottom: '.55rem' }}>📋</div>
            <div className="mk-eyebrow">Boş</div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--ink)', letterSpacing: '-.02em', margin: '.35rem 0 0' }}>Henüz ilanın yok</div>
            <p style={{ color: 'var(--ink2)', fontSize: '.9rem', margin: '.5rem auto 1.3rem', maxWidth: 380, lineHeight: 1.6 }}>
              Rafta bekleyen parçanı bir dakikada ilana çevir — ihtiyacı olan bayi bulsun.
            </p>
            <Link href="/market/yeni" className="mk-btn mk-btn-g" style={{ padding: '.7rem .8rem .7rem 1.25rem', fontWeight: 800 }}>
              <span>İlk ilanını ver</span><span className="mk-ico">＋</span>
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '.6rem' }}>
          {listings.map((l) => {
            const st = STATUS[l.status] || { label: l.status, bg: '#F2F4F8', color: '#5B6479' };
            return (
              <Link key={l.id} href={`/market/${l.id}`} className="mk-row">
                <div style={{ width: 54, height: 54, borderRadius: 12, background: '#F2F4F8', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem' }}>
                  {l.photos[0] ? <img src={l.photos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (KINDS[l.kind] || '📦')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '.93rem', color: 'var(--ink)', letterSpacing: '-.011em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</div>
                  <div style={{ fontSize: '.78rem', color: 'var(--ink2)', marginTop: 3 }}>
                    <span className="mk-price" style={{ fontSize: '.86rem' }}>{fmt(l.price)}</span>
                    <span style={{ color: 'var(--mut)' }}> · {l.quantity} adet{l.city ? ` · ${l.city}` : ''}</span>
                  </div>
                </div>
                <span className="mk-pill" style={{ flexShrink: 0, background: st.bg, color: st.color }}>{st.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
