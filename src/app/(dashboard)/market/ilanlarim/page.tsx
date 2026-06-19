'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Listing { id: string; kind: string; title: string; price: number; quantity: number; status: string; photos: string[]; city: string | null; }

const KINDS: Record<string, string> = { PART: '🔧', PRINTER: '🖨️', MACHINE: '🏭', OTHER: '📦' };
const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  ACTIVE: { label: 'Aktif', bg: '#dcfce7', color: '#15803d' },
  PAUSED: { label: 'Duraklatıldı', bg: '#fef3c7', color: '#92400e' },
  SOLD: { label: 'Satıldı', bg: '#e0e7ff', color: '#3730a3' },
};
const fmt = (n: number) => '₺' + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function IlanlarimPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/market/my').then((r) => r.json()).then((d) => { setListings(d.listings || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '1.5rem', maxWidth: 820, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Link href="/market" style={{ color: '#6b7280', fontSize: '0.85rem', textDecoration: 'none' }}>← Pazar</Link>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.25rem 0 0' }}>📋 İlanlarım</h1>
        </div>
        <Link href="/market/yeni" style={{ padding: '0.5rem 0.9rem', background: '#16a34a', color: 'white', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }}>＋ Yeni İlan</Link>
      </div>

      {loading ? <p style={{ color: '#9ca3af' }}>Yükleniyor…</p> : listings.length === 0 ? (
        <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 12, padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Henüz ilanın yok. <Link href="/market/yeni" style={{ color: '#2563eb' }}>＋ İlk ilanı ver</Link></div>
      ) : (
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {listings.map((l) => {
            const st = STATUS[l.status] || { label: l.status, bg: '#f3f4f6', color: '#374151' };
            return (
              <Link key={l.id} href={`/market/${l.id}`} style={{ textDecoration: 'none', color: 'inherit', background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '0.7rem 0.9rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 52, height: 52, borderRadius: 8, background: '#f3f4f6', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                  {l.photos[0] ? <img src={l.photos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (KINDS[l.kind] || '📦')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</div>
                  <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{fmt(l.price)} · {l.quantity} adet{l.city ? ` · ${l.city}` : ''}</div>
                </div>
                <span style={{ flexShrink: 0, fontSize: '0.72rem', fontWeight: 700, background: st.bg, color: st.color, padding: '0.2rem 0.6rem', borderRadius: 9999 }}>{st.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
