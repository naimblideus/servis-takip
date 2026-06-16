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

interface Customer { id: string; name: string; phone: string; address: string | null }
interface ActiveT { id: string; ticketNumber: string; status: string }

const LS_KEY = 'rota_selected_v1';

export default function RotaPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeByCust, setActiveByCust] = useState<Record<string, ActiveT[]>>({});
  const [selected, setSelected] = useState<string[]>([]); // sıralı müşteri id listesi
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/customers').then((r) => r.json()).catch(() => []),
      fetch('/api/tickets').then((r) => r.json()).catch(() => []),
    ]).then(([cs, ts]) => {
      setCustomers(Array.isArray(cs) ? cs : []);
      const map: Record<string, ActiveT[]> = {};
      (Array.isArray(ts) ? ts : []).filter((t: any) => ACTIVE.includes(t.status)).forEach((t: any) => {
        const cid = t.device?.customer?.id;
        if (!cid) return;
        (map[cid] ||= []).push({ id: t.id, ticketNumber: t.ticketNumber, status: t.status });
      });
      setActiveByCust(map);
      setLoading(false);
    });
  }, []);

  // Kayıtlı rota seçimini geri yükle (sayfa değişse de kaybolmasın)
  useEffect(() => {
    if (restored) return;
    try { const raw = localStorage.getItem(LS_KEY); if (raw) setSelected(JSON.parse(raw)); } catch { /* yoksay */ }
    setRestored(true);
  }, [restored]);
  useEffect(() => { if (restored) try { localStorage.setItem(LS_KEY, JSON.stringify(selected)); } catch { /* yoksay */ } }, [selected, restored]);

  const byId = useMemo(() => { const m = new Map<string, Customer>(); customers.forEach((c) => m.set(c.id, c)); return m; }, [customers]);
  const route = useMemo(() => selected.map((id) => byId.get(id)).filter(Boolean) as Customer[], [selected, byId]);

  const add = (id: string) => setSelected((s) => (s.includes(id) ? s : [...s, id]));
  const remove = (id: string) => setSelected((s) => s.filter((x) => x !== id));
  const move = (id: string, dir: -1 | 1) => setSelected((s) => {
    const i = s.indexOf(id); const j = i + dir;
    if (i < 0 || j < 0 || j >= s.length) return s;
    const n = [...s]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });
  const addAllActive = () => setSelected((s) => {
    const merged = [...s];
    Object.keys(activeByCust).forEach((id) => { if (!merged.includes(id)) merged.push(id); });
    return merged;
  });
  const clearRoute = () => setSelected([]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return customers.filter((c) =>
      c.name.toLowerCase().includes(q) || (c.address || '').toLowerCase().includes(q) || c.phone.includes(q)
    ).slice(0, 15);
  }, [customers, search]);

  const activeCustomers = useMemo(
    () => Object.keys(activeByCust).map((id) => byId.get(id)).filter(Boolean) as Customer[],
    [activeByCust, byId]
  );

  const withAddr = route.filter((s) => s.address && s.address.trim());
  const routeUrl = useMemo(() => {
    if (withAddr.length === 0) return null;
    if (withAddr.length === 1) return mapsUrl(withAddr[0].address);
    const enc = (a: string) => encodeURIComponent(a.trim());
    const list = withAddr.slice(0, 10); // Google Maps ~10 durak sınırı
    const dest = enc(list[list.length - 1].address!);
    const wp = list.slice(0, -1).map((s) => enc(s.address!)).join('|');
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}&waypoints=${wp}`;
  }, [withAddr]);

  return (
    <div style={{ padding: '1.5rem', maxWidth: 820, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>🗺️ Rota Planla</h1>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>Gideceğin müşterileri ara/seç, sırala, tek haritada yol tarifi al.</p>
        </div>
        {routeUrl && (
          <a href={routeUrl} target="_blank" rel="noreferrer" style={{ padding: '0.6rem 1.1rem', background: '#2563eb', color: 'white', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            🗺️ Haritada aç{withAddr.length > 10 ? ' (ilk 10)' : ''}
          </a>
        )}
      </div>

      {/* Müşteri ara → rotaya ekle */}
      <div style={{ position: 'relative', margin: '1rem 0 0.75rem' }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Müşteri ara (ad / adres / telefon) → rotaya ekle"
          style={{ width: '100%', padding: '0.7rem 0.9rem', border: '1px solid #d1d5db', borderRadius: 10, fontSize: '0.95rem', boxSizing: 'border-box' }} />
        {filtered.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #d1d5db', borderRadius: 10, maxHeight: 300, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', marginTop: 4 }}>
            {filtered.map((c) => {
              const inRoute = selected.includes(c.id);
              return (
                <div key={c.id} onClick={() => { if (!inRoute) { add(c.id); setSearch(''); } }}
                  style={{ padding: '0.55rem 0.8rem', cursor: inRoute ? 'default' : 'pointer', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, opacity: inRoute ? 0.55 : 1 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{c.name} {activeByCust[c.id] && <span style={{ fontSize: '0.66rem', color: '#1d4ed8' }}>● aktif fiş</span>}</div>
                    <div style={{ fontSize: '0.74rem', color: c.address ? '#9ca3af' : '#b91c1c' }}>{c.address ? c.address : '⚠ adres yok'}</div>
                  </div>
                  <span style={{ flexShrink: 0, fontSize: '0.78rem', fontWeight: 700, color: inRoute ? '#16a34a' : '#2563eb' }}>{inRoute ? '✓ ekli' : '+ ekle'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Aktif fişli müşteriler — hızlı ekle */}
      {activeCustomers.length > 0 && (
        <div style={{ background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e40af' }}>🔧 Aktif servis fişi olan {activeCustomers.length} müşteri</span>
            <button onClick={addAllActive} style={{ padding: '0.4rem 0.8rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>Hepsini rotaya ekle</button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {activeCustomers.filter((c) => !selected.includes(c.id)).map((c) => (
              <button key={c.id} onClick={() => add(c.id)} style={{ padding: '0.25rem 0.6rem', background: 'white', border: '1px solid #bfdbfe', borderRadius: 9999, fontSize: '0.76rem', fontWeight: 600, color: '#1e40af', cursor: 'pointer' }}>+ {c.name}</button>
            ))}
            {activeCustomers.every((c) => selected.includes(c.id)) && <span style={{ fontSize: '0.76rem', color: '#16a34a', fontWeight: 600 }}>✓ hepsi rotada</span>}
          </div>
        </div>
      )}

      {/* Rota durakları */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.5rem 0' }}>
        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Rotam ({route.length} durak{withAddr.length < route.length ? `, ${route.length - withAddr.length} adressiz` : ''})</span>
        {route.length > 0 && <button onClick={clearRoute} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Temizle</button>}
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af' }}>Yükleniyor…</p>
      ) : route.length === 0 ? (
        <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 12, padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
          Rotan boş. Yukarıdan müşteri ara-ekle ya da “Aktif fişli müşterileri ekle”yi kullan.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {route.map((s, i) => {
            const ts = activeByCust[s.id] || [];
            return (
              <div key={s.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '0.85rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: '#eff6ff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/customers/${s.id}`} style={{ fontWeight: 700, color: '#111827', textDecoration: 'none' }}>{s.name}</Link>
                    <div style={{ fontSize: '0.82rem', color: s.address ? '#6b7280' : '#b91c1c', marginTop: 2 }}>
                      {s.address && s.address.trim() ? `📍 ${s.address}` : '⚠ Adres yok — yol tarifi için ekleyin'}
                    </div>
                    {ts.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        {ts.map((t) => {
                          const st = ST[t.status] || { label: t.status, bg: '#f3f4f6', color: '#374151' };
                          return (
                            <Link key={t.id} href={`/tickets/${t.id}`} style={{ fontSize: '0.72rem', fontWeight: 700, background: st.bg, color: st.color, padding: '0.15rem 0.55rem', borderRadius: 9999, textDecoration: 'none' }}>
                              {t.ticketNumber} · {st.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                    <ContactActions phone={s.phone} address={s.address} />
                  </div>
                  {/* Sıra / çıkar kontrolleri */}
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button onClick={() => move(s.id, -1)} disabled={i === 0} title="Yukarı" style={{ width: 28, height: 24, border: '1px solid #e5e7eb', background: 'white', borderRadius: 6, cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.4 : 1 }}>▲</button>
                    <button onClick={() => move(s.id, 1)} disabled={i === route.length - 1} title="Aşağı" style={{ width: 28, height: 24, border: '1px solid #e5e7eb', background: 'white', borderRadius: 6, cursor: i === route.length - 1 ? 'default' : 'pointer', opacity: i === route.length - 1 ? 0.4 : 1 }}>▼</button>
                    <button onClick={() => remove(s.id)} title="Çıkar" style={{ width: 28, height: 24, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', borderRadius: 6, cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
