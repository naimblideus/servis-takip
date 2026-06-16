'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ContactActions from '@/components/ContactActions';

interface Item {
  id: string; brand: string; model: string; serialNo: string; location: string | null;
  customer: { id: string; name: string; phone: string; address: string | null } | null;
  lastReadingAt: string | null; daysSince: number | null;
}

export default function TakipPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [rentalCount, setRentalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(30);

  useEffect(() => {
    fetch('/api/maintenance').then((r) => r.json()).then((d) => {
      setItems(Array.isArray(d.items) ? d.items : []);
      setRentalCount(d.rentalCount || 0);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Eşiği geçen (geç okunan) + hiç okunmamış olanlar
  const overdue = useMemo(
    () => items.filter((i) => i.daysSince === null || i.daysSince >= threshold),
    [items, threshold]
  );

  const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('tr-TR') : 'hiç okunmadı');

  return (
    <div style={{ padding: '1.5rem', maxWidth: 880, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>🔔 Takip — Sayacı Geç Okunanlar</h1>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
            Kiralık cihazlarda geç kalan sayaç okumaları = kaçan faturalama. Bunları okutmaya git.
          </p>
        </div>
        <label style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>
          Eşik:&nbsp;
          <select value={threshold} onChange={(e) => setThreshold(parseInt(e.target.value))} style={{ padding: '0.4rem 0.6rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.85rem' }}>
            {[15, 30, 45, 60].map((d) => <option key={d} value={d}>{d}+ gün</option>)}
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', gap: 10, margin: '1rem 0' }}>
        <div style={{ flex: 1, background: 'white', border: '1px solid #fecaca', borderRadius: 10, padding: '0.7rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 700 }}>GEÇ OKUNAN ({threshold}+ gün)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#b91c1c' }}>{overdue.length}</div>
        </div>
        <div style={{ flex: 1, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.7rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 700 }}>TOPLAM KİRALIK</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{rentalCount}</div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af' }}>Yükleniyor…</p>
      ) : overdue.length === 0 ? (
        <p style={{ color: '#16a34a', textAlign: 'center', padding: '2rem', fontWeight: 600 }}>✅ {threshold}+ gündür okunmayan kiralık cihaz yok. Her şey güncel!</p>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {overdue.map((i) => {
            const never = i.daysSince === null;
            const sev = never || (i.daysSince as number) >= 45;
            return (
              <div key={i.id} style={{ background: 'white', border: `1px solid ${sev ? '#fecaca' : '#fde68a'}`, borderLeft: `4px solid ${sev ? '#dc2626' : '#d97706'}`, borderRadius: 12, padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{i.brand} {i.model} <span style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 400 }}>· SN {i.serialNo}</span></div>
                    <div style={{ fontSize: '0.85rem', color: '#374151', marginTop: 2 }}>
                      👤 {i.customer ? <Link href={`/customers/${i.customer.id}`} style={{ color: '#1d4ed8', textDecoration: 'none' }}>{i.customer.name}</Link> : '—'}
                      {i.location ? ` · ${i.location}` : ''}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: sev ? '#b91c1c' : '#92400e', fontWeight: 600, marginTop: 4 }}>
                      ⏱️ {never ? 'Hiç sayaç okunmadı' : `${i.daysSince} gündür okunmadı`} <span style={{ color: '#9ca3af', fontWeight: 400 }}>(son: {fmtDate(i.lastReadingAt)})</span>
                    </div>
                  </div>
                  <Link href={`/devices/${i.id}`} style={{ flexShrink: 0, padding: '0.5rem 0.9rem', background: '#0ea5e9', color: 'white', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>📊 Sayaç Oku →</Link>
                </div>
                {i.customer && <ContactActions phone={i.customer.phone} address={i.customer.address} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
