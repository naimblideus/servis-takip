'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ContactActions from '@/components/ContactActions';

interface Forecast {
  channel: string; yield: number; remaining: number | null; remainingPct: number | null;
  daysLeft: number | null; dailyRate: number | null; needsSetup: boolean;
}
interface Item {
  id: string; brand: string; model: string; serialNo: string; location: string | null;
  customer: { id: string; name: string; phone: string; address: string | null } | null;
  tonerChangedAt: string | null;
  black: Forecast | null; color: Forecast | null;
  soonestDaysLeft: number | null; needsSetup: boolean;
}

function sev(days: number | null): { border: string; bar: string; text: string } {
  if (days == null) return { border: '#e5e7eb', bar: '#94a3b8', text: '#6b7280' };
  if (days <= 7) return { border: '#fecaca', bar: '#dc2626', text: '#b91c1c' };
  if (days <= 14) return { border: '#fde68a', bar: '#d97706', text: '#92400e' };
  return { border: '#bbf7d0', bar: '#059669', text: '#15803d' };
}

function ChannelLine({ f, name }: { f: Forecast | null; name: string }) {
  if (!f) return null;
  let txt: string;
  if (f.needsSetup) txt = 'toner değişimi bekliyor';
  else if (f.daysLeft == null) txt = `≈%${f.remainingPct} kaldı · gün tahmini için en az 2 okuma gerek`;
  else txt = `~${f.daysLeft} gün sonra bitiyor · ≈%${f.remainingPct} kaldı (${(f.remaining ?? 0).toLocaleString('tr-TR')} sf)`;
  const s = sev(f.needsSetup ? null : f.daysLeft);
  return (
    <div style={{ fontSize: '0.83rem', color: s.text, fontWeight: 600, marginTop: 3 }}>
      {name}: {txt}
    </div>
  );
}

export default function SarfPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [tracked, setTracked] = useState(0);
  const [urgent, setUrgent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/toner').then((r) => r.json()).then((d) => {
      setItems(Array.isArray(d.items) ? d.items : []);
      setTracked(d.trackedCount || 0);
      setUrgent(d.urgent || 0);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '1.5rem', maxWidth: 880, margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>🧴 Sarf Takibi — Toner Tükenme Tahmini</h1>
        <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
          Sayaç hızından her cihaza ne zaman toner gerekeceğini tahmin eder. Acil olanları rota planına alıp tek çıkışta götür.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, margin: '1rem 0' }}>
        <div style={{ flex: 1, background: 'white', border: '1px solid #fecaca', borderRadius: 10, padding: '0.7rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 700 }}>YAKINDA BİTECEK (≤14 gün)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#b91c1c' }}>{urgent}</div>
        </div>
        <div style={{ flex: 1, background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.7rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 700 }}>TAKİPTEKİ CİHAZ</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{tracked}</div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af' }}>Yükleniyor…</p>
      ) : items.length === 0 ? (
        <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 12, padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: '#374151', fontWeight: 600, margin: '0 0 0.5rem' }}>Henüz toner takibi yapılan cihaz yok.</p>
          <p style={{ color: '#6b7280', fontSize: '0.88rem', margin: 0 }}>
            Bir cihaz detayında <b>🧴 Toner Takibi</b> kartından toner verimini girip “Toner Değişti”yi işaretleyin; tahmin burada görünür.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {items.map((i) => {
            const s = sev(i.needsSetup ? null : i.soonestDaysLeft);
            return (
              <div key={i.id} style={{ background: 'white', border: `1px solid ${s.border}`, borderLeft: `4px solid ${s.bar}`, borderRadius: 12, padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{i.brand} {i.model} <span style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 400 }}>· SN {i.serialNo}</span></div>
                    <div style={{ fontSize: '0.85rem', color: '#374151', marginTop: 2 }}>
                      👤 {i.customer ? <Link href={`/customers/${i.customer.id}`} style={{ color: '#1d4ed8', textDecoration: 'none' }}>{i.customer.name}</Link> : '—'}
                      {i.location ? ` · ${i.location}` : ''}
                    </div>
                    <ChannelLine f={i.black} name="⚫ Siyah" />
                    <ChannelLine f={i.color} name="🟣 Renkli" />
                  </div>
                  <Link href={`/devices/${i.id}`} style={{ flexShrink: 0, padding: '0.5rem 0.9rem', background: '#0ea5e9', color: 'white', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>Cihaz →</Link>
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
