'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

const money = (n: number) => '₺' + n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CihazKarlilikPage() {
  const [months, setMonths] = useState(6);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [onlyLosing, setOnlyLosing] = useState(false);

  const load = useCallback(async (m: number) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/reports/device-profit?months=${m}`);
      if (r.ok) setData(await r.json());
    } catch { /* yoksay */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(months); }, [months, load]);

  const rows = (data?.devices || []).filter((d: any) => !onlyLosing || d.net < 0);
  const t = data?.totals;

  return (
    <div style={{ padding: '1.5rem 1.25rem 3rem', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ fontSize: 10.5, letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700, color: '#8A93AB' }}>Rapor</div>
      <h1 style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-.022em', margin: '.3rem 0 .35rem', color: '#0B1533' }}>Cihaz Kârlılığı</h1>
      <p style={{ color: '#5B6479', fontSize: '.9rem', margin: '0 0 1.2rem', lineHeight: 1.55 }}>
        Kiralık cihaz başına <b>gelir − parça maliyeti</b>. Zarar edenler üstte — "bu makineyi çek, yenisini koy" kararı için.
      </p>

      {/* Dönem + filtre */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.1rem' }}>
        {[3, 6, 12].map((m) => (
          <button key={m} onClick={() => setMonths(m)}
            style={{
              padding: '.45rem 1rem', borderRadius: 999, cursor: 'pointer', fontWeight: 650, fontSize: '.83rem',
              border: `1px solid ${months === m ? '#0F2253' : '#e5e7eb'}`,
              background: months === m ? '#0F2253' : 'white', color: months === m ? 'white' : '#5B6479',
            }}>Son {m} ay</button>
        ))}
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginLeft: 'auto', fontSize: '.85rem', color: '#5B6479', cursor: 'pointer' }}>
          <input type="checkbox" checked={onlyLosing} onChange={(e) => setOnlyLosing(e.target.checked)} />
          Sadece zarar edenler
        </label>
      </div>

      {/* Veri kalitesi uyarısı — YANLIŞ SONUÇ ÜRETMESİN */}
      {data?.warnings?.zeroBuyPrice > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', borderRadius: 12, padding: '.75rem 1rem', fontSize: '.85rem', marginBottom: '1rem', lineHeight: 1.55 }}>
          ⚠️ <b>{data.warnings.zeroBuyPrice} parça kullanımında alış fiyatı girilmemiş</b> — o parçalar maliyete 0 olarak girdi,
          yani liste olduğundan <b>daha kârlı</b> görünüyor. Stok kartlarına alış fiyatı girersen rakam gerçeğe yaklaşır.
        </div>
      )}

      {loading ? (
        <p style={{ color: '#9AA3B8' }}>Hesaplanıyor…</p>
      ) : !data || data.devices.length === 0 ? (
        <div style={{ background: 'white', border: '1px dashed #cbd5e1', borderRadius: 14, padding: '2.5rem 1.5rem', textAlign: 'center', color: '#5B6479' }}>
          Kiralık cihaz bulunamadı.
        </div>
      ) : (
        <>
          {/* Özet */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: '1.1rem' }}>
            {[
              { l: 'Gelir', v: money(t.revenue), c: '#0B6B4A' },
              { l: 'Parça maliyeti', v: money(t.cost), c: '#B45309' },
              { l: 'Net', v: money(t.net), c: t.net >= 0 ? '#0B6B4A' : '#B91C1C' },
              { l: 'Zarar eden cihaz', v: String(t.losing), c: t.losing > 0 ? '#B91C1C' : '#5B6479' },
            ].map((x) => (
              <div key={x.l} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '.85rem 1rem' }}>
                <div style={{ fontSize: '.72rem', color: '#8A93AB', fontWeight: 600 }}>{x.l}</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: x.c, marginTop: 3 }}>{x.v}</div>
              </div>
            ))}
          </div>

          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
              <thead>
                <tr style={{ background: '#F7F9FC' }}>
                  {['Cihaz / Müşteri', 'Ziyaret', 'Gelir', 'Parça maliyeti', 'Net'].map((h, i) => (
                    <th key={h} style={{ textAlign: i > 0 ? 'right' : 'left', padding: '.6rem .8rem', fontSize: '.7rem', fontWeight: 800, color: '#5B6479', textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((d: any) => (
                  <tr key={d.id} style={{ borderTop: '1px solid #eef2f7', background: d.net < 0 ? '#FEF7F7' : 'white' }}>
                    <td style={{ padding: '.6rem .8rem' }}>
                      <div style={{ fontWeight: 700, color: '#0B1533' }}>{d.device}</div>
                      <div style={{ fontSize: '.75rem', color: '#8A93AB' }}>
                        {d.customerId
                          ? <Link href={`/customers/${d.customerId}`} style={{ color: '#5B6479', textDecoration: 'none' }}>{d.customerName}</Link>
                          : d.customerName}
                        {d.location ? ` · 📍 ${d.location}` : ''}
                      </div>
                    </td>
                    <td style={{ padding: '.6rem .8rem', textAlign: 'right', color: '#5B6479', fontFamily: 'monospace' }}>{d.visits}</td>
                    <td style={{ padding: '.6rem .8rem', textAlign: 'right', fontFamily: 'monospace', color: '#0B6B4A' }}>{money(d.revenue)}</td>
                    <td style={{ padding: '.6rem .8rem', textAlign: 'right', fontFamily: 'monospace', color: d.cost > 0 ? '#B45309' : '#9AA3B8' }}>{money(d.cost)}</td>
                    <td style={{ padding: '.6rem .8rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: d.net < 0 ? '#B91C1C' : '#0B6B4A' }}>
                      {money(d.net)}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#0B6B4A' }}>Zarar eden cihaz yok 👍</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: '.76rem', color: '#9AA3B8', marginTop: '.9rem', lineHeight: 1.6 }}>
            Gelir = bu cihaza kesilen kira + sayaç aşımı fatura satırları. Maliyet = cihaza açılan fişlerde kullanılan
            parçaların <b>alış</b> fiyatı. Ziyaret sayısı bilgi amaçlıdır, maliyete dahil edilmez.
          </p>
        </>
      )}
    </div>
  );
}
