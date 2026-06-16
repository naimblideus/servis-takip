'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface Item {
  id: string; brand: string; model: string; serialNo: string; location: string | null;
  customer: { id: string; name: string; phone: string; address: string | null } | null;
  counterAmount: number; billBlack: number; billColor: number; rentAmount: number; total: number;
}
interface Summary { counterTotal: number; rentTotal: number; grandTotal: number; deviceCount: number; customerCount: number; }

const fmt = (n: number) => '₺' + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function KacanGelirPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [summary, setSummary] = useState<Summary>({ counterTotal: 0, rentTotal: 0, grandTotal: 0, deviceCount: 0, customerCount: 0 });
  const [period, setPeriod] = useState('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/revenue-risk');
      const d = await r.json();
      setItems(Array.isArray(d.items) ? d.items : []);
      setSummary(d.summary || { counterTotal: 0, rentTotal: 0, grandTotal: 0, deviceCount: 0, customerCount: 0 });
      setPeriod(d.period || '');
    } catch { /* yoksay */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const runBilling = async () => {
    if (!confirm('Bu dönem için tüm müşterilere otomatik fatura kesilecek (sayaç aşımı + kira + ödenmemiş servis). Devam edilsin mi?')) return;
    setRunning(true); setMsg(null);
    try {
      const res = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await res.json();
      if (res.ok) { setMsg(`✓ ${d.created} fatura kesildi (toplam ${fmt(d.total)})${d.errors ? ` · ${d.errors} hata` : ''}`); load(); }
      else setMsg('❌ ' + (d.error || 'Hata'));
    } catch { setMsg('❌ Sunucuya bağlanılamadı'); }
    setRunning(false);
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: 880, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>💸 Kaçan Gelir — Bu Dönem</h1>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
            {period && <b>{period}</b>} döneminde <b>kazanılmış ama henüz faturalanmamış</b> tutar: okunmuş sayaç aşımı + kesilmemiş kira. Ay kapanmadan faturala, kaçırma.
          </p>
        </div>
        {summary.grandTotal > 0 && (
          <button onClick={runBilling} disabled={running}
            style={{ padding: '0.6rem 1.1rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', opacity: running ? 0.6 : 1, whiteSpace: 'nowrap' }}>
            {running ? 'Kesiliyor…' : '⚡ Bu Dönemi Faturala'}
          </button>
        )}
      </div>

      {msg && <div style={{ margin: '1rem 0 0', padding: '0.7rem 1rem', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '0.88rem', color: '#15803d' }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 10, margin: '1rem 0', flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: 200, background: 'linear-gradient(135deg,#7f1d1d,#dc2626)', color: 'white', borderRadius: 12, padding: '0.9rem 1.1rem' }}>
          <div style={{ fontSize: '0.72rem', opacity: 0.85, fontWeight: 700 }}>TOPLAM RİSKTEKİ GELİR (KDV hariç, tahmini)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{fmt(summary.grandTotal)}</div>
          <div style={{ fontSize: '0.74rem', opacity: 0.9, marginTop: 2 }}>{summary.deviceCount} cihaz · {summary.customerCount} müşteri</div>
        </div>
        <div style={{ flex: 1, minWidth: 130, background: 'white', border: '1px solid #fde68a', borderRadius: 12, padding: '0.9rem 1.1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 700 }}>SAYAÇ AŞIMI</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#b45309' }}>{fmt(summary.counterTotal)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 130, background: 'white', border: '1px solid #bfdbfe', borderRadius: 12, padding: '0.9rem 1.1rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 700 }}>KESİLMEMİŞ KİRA</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1d4ed8' }}>{fmt(summary.rentTotal)}</div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af' }}>Yükleniyor…</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#16a34a', textAlign: 'center', padding: '2rem', fontWeight: 600 }}>✅ Bu dönem için riskte (faturalanmamış kazanılmış) gelir yok. Her şey faturalanmış!</p>
      ) : (
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {items.map((i) => (
            <div key={i.id} style={{ background: 'white', border: '1px solid #fecaca', borderLeft: '4px solid #dc2626', borderRadius: 12, padding: '0.9rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{i.brand} {i.model} <span style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 400 }}>· SN {i.serialNo}</span></div>
                  <div style={{ fontSize: '0.85rem', color: '#374151', marginTop: 2 }}>
                    👤 {i.customer ? <Link href={`/customers/${i.customer.id}`} style={{ color: '#1d4ed8', textDecoration: 'none' }}>{i.customer.name}</Link> : '—'}
                    {i.location ? ` · ${i.location}` : ''}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {i.counterAmount > 0 && <span>📄 Sayaç aşımı: <b style={{ color: '#b45309' }}>{fmt(i.counterAmount)}</b> ({(i.billBlack).toLocaleString('tr-TR')} S/B{i.billColor > 0 ? ` · ${i.billColor.toLocaleString('tr-TR')} renkli` : ''})</span>}
                    {i.rentAmount > 0 && <span>🏷️ Kira: <b style={{ color: '#1d4ed8' }}>{fmt(i.rentAmount)}</b></span>}
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#b91c1c' }}>{fmt(i.total)}</div>
                  <Link href={`/devices/${i.id}`} style={{ fontSize: '0.78rem', color: '#0ea5e9', textDecoration: 'none', fontWeight: 600 }}>Cihaz →</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
