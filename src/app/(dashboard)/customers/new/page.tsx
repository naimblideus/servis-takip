'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewCustomerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', address: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      router.push(`/customers/${data.id}`);
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
        <Link href="/customers" style={{ color: '#6b7280', fontSize: '0.875rem', textDecoration: 'none' }}>← Müşteriler</Link>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginTop: '0.25rem' }}>Yeni Müşteri</h1>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1rem' }}>
          <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Müşteri Bilgileri</h2>
          <div style={{ marginBottom: '1rem' }}>
            <label style={lbl}>Ad Soyad *</label>
            <input required style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Örn: Ayşe Kaya" />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={lbl}>Telefon *</label>
            <input required style={inp} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="05XX XXX XX XX" />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={lbl}>E-posta</label>
            <input type="email" style={inp} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="ornek@mail.com" />
          </div>
          <div>
            <label style={lbl}>Adres</label>
            <textarea rows={3} style={inp} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Mahalle, Cadde, No, İlçe/İl" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="submit" disabled={loading} style={{
            backgroundColor: '#3b82f6', color: 'white', padding: '0.75rem 2rem',
            borderRadius: '0.5rem', border: 'none', fontWeight: '600',
            cursor: 'pointer', fontSize: '0.95rem', opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Kaydediliyor...' : 'Müşteri Oluştur'}
          </button>
          <Link href="/customers" style={{
            padding: '0.75rem 2rem', borderRadius: '0.5rem', border: '1px solid #d1d5db',
            textDecoration: 'none', color: '#374151', fontWeight: '500',
          }}>İptal</Link>
        </div>
      </form>
    </div>
  );
}
