'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewDevicePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [form, setForm] = useState({
    customerId: '',
    brand: '',
    model: '',
    serialNo: '',
    location: '',
    counterBlack: '',
    counterColor: '',
    isRental: false,
    monthlyRent: '',
    pricePerBlack: '',
    pricePerColor: '',
  });

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(setCustomers);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      router.push(`/devices/${data.id}`);
    } else {
      alert('Hata: ' + (data.error || JSON.stringify(data)));
      setLoading(false);
    }
  };

  const inp = {
    width: '100%', padding: '0.625rem 0.75rem', border: '1px solid #d1d5db',
    borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none',
    boxSizing: 'border-box' as const,
  };
  const lbl = {
    display: 'block', fontSize: '0.875rem', fontWeight: '500',
    color: '#374151', marginBottom: '0.375rem',
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/devices" style={{ color: '#6b7280', fontSize: '0.875rem', textDecoration: 'none' }}>← Cihazlar</Link>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginTop: '0.25rem' }}>Yeni Cihaz</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1rem' }}>
          <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Cihaz Bilgileri</h2>

          <div style={{ marginBottom: '1rem' }}>
            <label style={lbl}>Müşteri *</label>
            <select required style={inp} value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Müşteri seçin...</option>
              {customers.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={lbl}>Marka *</label>
              <input required style={inp} value={form.brand}
                onChange={e => setForm({ ...form, brand: e.target.value })}
                placeholder="Canon, HP, Epson..." />
            </div>
            <div>
              <label style={lbl}>Model *</label>
              <input required style={inp} value={form.model}
                onChange={e => setForm({ ...form, model: e.target.value })}
                placeholder="imageRUNNER 2425..." />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={lbl}>Seri No *</label>
            <input required style={inp} value={form.serialNo}
              onChange={e => setForm({ ...form, serialNo: e.target.value })}
              placeholder="Örn: CNR987654" />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={lbl}>Konum</label>
            <input style={inp} value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })}
              placeholder="Muhasebe Odası, Zemin Kat..." />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={lbl}>⚫ Siyah Sayaç</label>
              <input type="number" min="0" style={inp} value={form.counterBlack}
                onChange={e => setForm({ ...form, counterBlack: e.target.value })}
                placeholder="örn. 7356" />
              {form.counterBlack && <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{Number(form.counterBlack).toLocaleString('tr-TR')}</span>}
            </div>
            <div>
              <label style={lbl}>🟣 Renkli Sayaç</label>
              <input type="number" min="0" style={inp} value={form.counterColor}
                onChange={e => setForm({ ...form, counterColor: e.target.value })}
                placeholder="örn. 345567" />
              {form.counterColor && <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{Number(form.counterColor).toLocaleString('tr-TR')}</span>}
            </div>
          </div>
        </div>

        {/* Kiralık Cihaz */}
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', marginBottom: form.isRental ? '1rem' : 0 }}>
            <input type="checkbox" checked={form.isRental} onChange={e => setForm({ ...form, isRental: e.target.checked })} />
            <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>🏷️ Kiralık Cihaz</span>
          </label>
          {form.isRental && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', backgroundColor: '#eff6ff', borderRadius: '0.5rem', border: '1px solid #bfdbfe' }}>
              <div>
                <label style={lbl}>Aylık Kira Bedeli (₺)</label>
                <input type="number" step="1" min="0" style={inp} value={form.monthlyRent}
                  onChange={e => setForm({ ...form, monthlyRent: e.target.value })} placeholder="örn. 500" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={lbl}>⚫ Siyah Birim Fiyat (₺)</label>
                  <input type="number" step="0.01" min="0" style={inp} value={form.pricePerBlack}
                    onChange={e => setForm({ ...form, pricePerBlack: e.target.value })} placeholder="Varsayılan" />
                </div>
                <div>
                  <label style={lbl}>🟣 Renkli Birim Fiyat (₺)</label>
                  <input type="number" step="0.01" min="0" style={inp} value={form.pricePerColor}
                    onChange={e => setForm({ ...form, pricePerColor: e.target.value })} placeholder="Varsayılan" />
                </div>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>💡 Boş bırakırsanız Ayarlar&apos;daki varsayılan fiyat kullanılır</p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="submit" disabled={loading} style={{
            backgroundColor: '#3b82f6', color: 'white', padding: '0.75rem 2rem',
            borderRadius: '0.5rem', border: 'none', fontWeight: '600',
            cursor: 'pointer', fontSize: '0.95rem', opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Kaydediliyor...' : 'Cihaz Oluştur'}
          </button>
          <Link href="/devices" style={{
            padding: '0.75rem 2rem', borderRadius: '0.5rem', border: '1px solid #d1d5db',
            textDecoration: 'none', color: '#374151', fontWeight: '500',
          }}>İptal</Link>
        </div>
      </form>
    </div>
  );
}
