'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewTicketPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({
    deviceId: '',
    issueTemplate: '',
    issueText: '',
    actionText: '',
    notes: '',
    assignedUserId: '',
    totalCost: '',
    priority: 'NORMAL',
  });

  useEffect(() => {
    fetch('/api/devices').then(r => r.json()).then(setDevices);
    fetch('/api/users').then(r => r.json()).then(setUsers);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      router.push(`/tickets/${data.id}`);
    } else {
      alert('Hata: ' + (data.error || JSON.stringify(data)));
      setLoading(false);
    }
  };

  const input = {
    width: '100%', padding: '0.625rem 0.75rem', border: '1px solid #d1d5db',
    borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none',
    boxSizing: 'border-box' as const,
  };
  const label = { display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.375rem' };

  return (
    <div style={{ padding: '2rem', maxWidth: '700px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/tickets" style={{ color: '#6b7280', fontSize: '0.875rem', textDecoration: 'none' }}>← Fişler</Link>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginTop: '0.25rem' }}>Yeni Servis Fişi</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1rem' }}>
          <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Cihaz Bilgileri</h2>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={label}>Cihaz *</label>
            <select required style={input} value={form.deviceId} onChange={e => setForm({...form, deviceId: e.target.value})}>
              <option value="">Cihaz seçin...</option>
              {devices.map((d: any) => (
                <option key={d.id} value={d.id}>{d.customer.name} — {d.brand} {d.model} ({d.serialNo})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={label}>Öncelik</label>
              <select style={input} value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                <option value="LOW">Düşük</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">Yüksek</option>
                <option value="URGENT">Acil</option>
              </select>
            </div>
            <div>
              <label style={label}>Teknisyen</label>
              <select style={input} value={form.assignedUserId} onChange={e => setForm({...form, assignedUserId: e.target.value})}>
                <option value="">Atanmadı</option>
                {users.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1rem' }}>
          <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Arıza Bilgileri</h2>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={label}>Arıza Şablonu</label>
            <select style={input} value={form.issueTemplate} onChange={e => setForm({...form, issueTemplate: e.target.value, issueText: e.target.value})}>
              <option value="">Seçin veya manuel yazın...</option>
              {['Kağıt Sıkışması', 'Toner Sorunu', 'Baskı Kalitesi', 'Besleme Hatası', 'Ağ Bağlantısı', 'Diğer'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={label}>Arıza Açıklaması *</label>
            <textarea required rows={3} style={input} value={form.issueText}
              onChange={e => setForm({...form, issueText: e.target.value})}
              placeholder="Arızayı detaylı açıklayın..." />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={label}>Yapılan İşlem</label>
            <textarea rows={3} style={input} value={form.actionText}
              onChange={e => setForm({...form, actionText: e.target.value})}
              placeholder="Yapılan işlemi yazın..." />
          </div>

          <div>
            <label style={label}>Notlar</label>
            <textarea rows={2} style={input} value={form.notes}
              onChange={e => setForm({...form, notes: e.target.value})}
              placeholder="Ek notlar..." />
          </div>
        </div>

        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1rem' }}>
          <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Ücret</h2>
          <div>
            <label style={label}>Toplam Tutar (₺)</label>
            <input type="number" step="0.01" style={input} value={form.totalCost}
              onChange={e => setForm({...form, totalCost: e.target.value})}
              placeholder="0.00" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="submit" disabled={loading} style={{
            backgroundColor: '#3b82f6', color: 'white', padding: '0.75rem 2rem',
            borderRadius: '0.5rem', border: 'none', fontWeight: '600', cursor: 'pointer',
            fontSize: '0.95rem', opacity: loading ? 0.7 : 1
          }}>
            {loading ? 'Kaydediliyor...' : 'Fiş Oluştur'}
          </button>
          <Link href="/tickets" style={{
            padding: '0.75rem 2rem', borderRadius: '0.5rem', border: '1px solid #d1d5db',
            textDecoration: 'none', color: '#374151', fontWeight: '500'
          }}>İptal</Link>
        </div>
      </form>
    </div>
  );
}