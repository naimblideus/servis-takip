'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { mapsUrl } from '@/lib/share';
import ContactActions from '@/components/ContactActions';

const ACTIVE = ['NEW', 'IN_SERVICE', 'WAITING_FOR_PART', 'READY'];
const ST: Record<string, { label: string; bg: string; color: string }> = {
  NEW: { label: 'Yeni', bg: '#fef3c7', color: '#92400e' },
  IN_SERVICE: { label: 'Serviste', bg: '#dbeafe', color: '#1e40af' },
  WAITING_FOR_PART: { label: 'Parça Bkl.', bg: '#fce7f3', color: '#9d174d' },
  READY: { label: 'Hazır', bg: '#d1fae5', color: '#065f46' },
};

interface Ticket { id: string; ticketNumber: string; status: string; device?: { brand: string; model: string; customer?: { id: string; name: string; phone: string; address: string | null } } }
interface Stop { id: string; name: string; phone: string; address: string | null; tickets: Ticket[] }

export default function RotaPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tickets').then((r) => r.json()).then((d) => {
      setTickets(Array.isArray(d) ? d : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const stops: Stop[] = useMemo(() => {
    const m = new Map<string, Stop>();
    for (const t of tickets.filter((x) => ACTIVE.includes(x.status))) {
      const c = t.device?.customer;
      if (!c) continue;
      if (!m.has(c.id)) m.set(c.id, { id: c.id, name: c.name, phone: c.phone, address: c.address, tickets: [] });
      m.get(c.id)!.tickets.push(t);
    }
    return Array.from(m.values());
  }, [tickets]);

  const withAddr = stops.filter((s) => s.address && s.address.trim());
  const noAddr = stops.filter((s) => !s.address || !s.address.trim());

  const routeUrl = useMemo(() => {
    if (withAddr.length === 0) return null;
    if (withAddr.length === 1) return mapsUrl(withAddr[0].address);
    const enc = (a: string) => encodeURIComponent(a.trim());
    const list = withAddr.slice(0, 10); // Google Maps URL ~10 durak sınırı
    const dest = enc(list[list.length - 1].address!);
    const wp = list.slice(0, -1).map((s) => enc(s.address!)).join('|');
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}&waypoints=${wp}`;
  }, [withAddr]);

  return (
    <div style={{ padding: '1.5rem', maxWidth: 820, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>🗺️ Bugünün Rotası</h1>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>Aktif servis fişleri olan müşteriler — sıralı git, tek haritada yol tarifi.</p>
        </div>
        {routeUrl && (
          <a href={routeUrl} target="_blank" rel="noreferrer" style={{ padding: '0.6rem 1.1rem', background: '#2563eb', color: 'white', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            🗺️ Tüm rotayı haritada aç{withAddr.length > 10 ? ' (ilk 10)' : ''}
          </a>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, margin: '1rem 0' }}>
        <div style={{ flex: 1, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.7rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 700 }}>DURAK (MÜŞTERİ)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{stops.length}</div>
        </div>
        <div style={{ flex: 1, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.7rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 700 }}>AKTİF FİŞ</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{stops.reduce((s, x) => s + x.tickets.length, 0)}</div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af' }}>Yükleniyor…</p>
      ) : stops.length === 0 ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>Aktif servis fişi olan müşteri yok. 🎉</p>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {[...withAddr, ...noAddr].map((s, i) => (
            <div key={s.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: '#eff6ff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/customers/${s.id}`} style={{ fontWeight: 700, color: '#111827', textDecoration: 'none' }}>{s.name}</Link>
                  <div style={{ fontSize: '0.82rem', color: s.address ? '#6b7280' : '#b91c1c', marginTop: 2 }}>
                    {s.address && s.address.trim() ? `📍 ${s.address}` : '⚠ Adres yok — yol tarifi için ekleyin'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {s.tickets.map((t) => {
                      const st = ST[t.status] || { label: t.status, bg: '#f3f4f6', color: '#374151' };
                      return (
                        <Link key={t.id} href={`/tickets/${t.id}`} style={{ fontSize: '0.72rem', fontWeight: 700, background: st.bg, color: st.color, padding: '0.15rem 0.55rem', borderRadius: 9999, textDecoration: 'none' }}>
                          {t.ticketNumber} · {st.label}
                        </Link>
                      );
                    })}
                  </div>
                  <ContactActions phone={s.phone} address={s.address} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
