'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  createdAt: string;
  devices: { id: string }[];
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const t = useT();
  const b = useBicim();

  useEffect(() => {
    fetch('/api/customers')
      .then(r => r.json())
      .then((data: any) => {
        const list = Array.isArray(data) ? data : data.customers || [];
        setCustomers(list);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.address?.toLowerCase().includes(q))
    );
  }, [customers, search]);

  const th: React.CSSProperties = {
    padding: '0.75rem 1rem', textAlign: 'left',
    fontSize: '0.875rem', fontWeight: '600', color: '#374151',
  };

  return (
    <div style={{ padding: '2rem' }}>
      {/* Başlık + Buton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>{t.musteriler.baslik}</h1>
          <p style={{ color: '#6b7280' }}>
            {loading ? t.genel.yukleniyor : doldur(t.musteriler.sayim, { n: filtered.length, toplam: customers.length })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {/* Liste ekranda kalırsa iş görmez: muhasebeciye gidecek,
            sigortaya verilecek, elle sayılacak. İndirme ekrandakiyle
            AYNI kaynaktan üretiliyor (api/disa-aktar). */}
        <a href="/api/disa-aktar?tur=musteri" title={t.musteriler.excelIpucu} style={{
          backgroundColor: '#0f2253', color: 'white', padding: '0.625rem 1rem',
          borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 500,
          fontSize: '0.875rem', whiteSpace: 'nowrap',
        }}>{t.genel.excelIndir}</a>
        <Link href="/customers/new" style={{
          backgroundColor: '#3b82f6', color: 'white', padding: '0.625rem 1.25rem',
          borderRadius: '0.5rem', textDecoration: 'none', fontWeight: '500',
        }}>{t.musteriler.yeni}</Link>
        </div>
      </div>

      {/* Arama Kutusu */}
      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <span style={{
          position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)',
          color: '#9ca3af', pointerEvents: 'none',
        }}>🔍</span>
        <input
          type="text"
          placeholder={t.musteriler.araYer}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '0.625rem 0.75rem 0.625rem 2.25rem',
            border: '1px solid #d1d5db', borderRadius: '0.5rem',
            fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
            backgroundColor: 'white',
          }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{
              position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1rem',
            }}
          >✕</button>
        )}
      </div>

      {/* Tablo */}
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '44rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {[t.musteriler.sutun.ad, t.musteriler.sutun.telefon, t.musteriler.sutun.adres, t.genel.cihaz, t.musteriler.sutun.kayit, ''].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>{t.genel.yukleniyor}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                {search ? doldur(t.musteriler.bulunamadi, { q: search }) : t.musteriler.yok}
              </td></tr>
            ) : filtered.map((c, i) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                <td style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>{c.name}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{c.phone}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{c.address || '—'}</td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                  <span style={{
                    backgroundColor: '#dbeafe', color: '#1d4ed8',
                    padding: '0.2rem 0.6rem', borderRadius: '9999px',
                    fontSize: '0.75rem', fontWeight: '600',
                  }}>
                    {doldur(t.musteriler.cihazSayisi, { n: c.devices.length })}
                  </span>
                </td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  {b.tarih(c.createdAt)}
                </td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <Link href={`/customers/${c.id}`} style={{ color: '#3b82f6', fontSize: '0.875rem', textDecoration: 'none' }}>
                    {t.genel.detayOk}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}