'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string | null;
}

interface Device {
  id: string;
  brand: string;
  model: string;
  serialNo: string;
  counterBlack: number | null;
  counterColor: number | null;
  location: string | null;
}

export default function NewTicketPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [nextTicketNumber, setNextTicketNumber] = useState('');

  const [form, setForm] = useState({
    customerId: '',
    deviceId: '',
    issueTemplate: '',
    issueText: '',
    actionText: '',
    notes: '',
    assignedUserId: '',
    totalCost: '',
    priority: 'NORMAL',
    counterBlack: '',
    counterColor: '',
  });

  // Seçili müşteri ve cihaz detayları
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Sonraki fiş numarasını yükle
  useEffect(() => {
    fetch('/api/tickets/next-ticket-number')
      .then(r => r.json())
      .then(d => setNextTicketNumber(d.ticketNumber || ''))
      .catch(() => { });
  }, []);

  // Kullanıcıları yükle
  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(setUsers);
  }, []);

  // Müşterileri yükle
  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then((data: any) => {
      const list = Array.isArray(data) ? data : data.customers || [];
      setCustomers(list);
    });
  }, []);

  // Müşteri seçilince cihazları yükle
  useEffect(() => {
    if (form.customerId) {
      fetch(`/api/customers/${form.customerId}/devices`)
        .then(r => r.json())
        .then(setDevices);
    } else {
      setDevices([]);
    }
    setForm(f => ({ ...f, deviceId: '' }));
    setSelectedDevice(null);
  }, [form.customerId]);

  // Cihaz seçilince detayları güncelle
  useEffect(() => {
    if (form.deviceId) {
      const dev = devices.find(d => d.id === form.deviceId);
      setSelectedDevice(dev || null);
      if (dev) {
        setForm(f => ({
          ...f,
          counterBlack: dev.counterBlack?.toString() || '',
          counterColor: dev.counterColor?.toString() || '',
        }));
      }
    } else {
      setSelectedDevice(null);
    }
  }, [form.deviceId, devices]);

  // Müşteri arama filtrele
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch)
  );

  const selectCustomer = useCallback((c: Customer) => {
    setSelectedCustomer(c);
    setCustomerSearch(c.name);
    setForm(f => ({ ...f, customerId: c.id }));
    setShowDropdown(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: form.deviceId,
        issueTemplate: form.issueTemplate || undefined,
        issueText: form.issueText,
        actionText: form.actionText || undefined,
        notes: form.notes || undefined,
        assignedUserId: form.assignedUserId || undefined,
        totalCost: form.totalCost || undefined,
        priority: form.priority,
        counterBlack: form.counterBlack || undefined,
        counterColor: form.counterColor || undefined,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      router.push(`/tickets/${data.id}`);
    } else {
      alert('Hata: ' + (data.error || JSON.stringify(data)));
      setLoading(false);
    }
  };

  const input: React.CSSProperties = {
    width: '100%', padding: '0.625rem 0.75rem', border: '1px solid #d1d5db',
    borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none',
    boxSizing: 'border-box',
  };
  const label: React.CSSProperties = { display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.375rem' };
  const readonlyInput: React.CSSProperties = { ...input, backgroundColor: '#f9fafb', color: '#6b7280', cursor: 'default' };

  return (
    <div style={{ padding: '2rem', maxWidth: '700px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/tickets" style={{ color: '#6b7280', fontSize: '0.875rem', textDecoration: 'none' }}>← Fişler</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Yeni Servis Fişi</h1>
          {nextTicketNumber && (
            <span style={{
              backgroundColor: '#dbeafe', color: '#1e40af', padding: '0.35rem 0.75rem',
              borderRadius: '0.5rem', fontWeight: '700', fontSize: '0.95rem', fontFamily: 'monospace',
            }}>
              {nextTicketNumber}
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ═══ 1. Müşteri Seçimi ═══ */}
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1rem' }}>
          <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>👤 Müşteri Bilgileri</h2>

          <div style={{ marginBottom: '1rem', position: 'relative' }}>
            <label style={label}>Müşteri Adı *</label>
            <input
              type="text"
              style={input}
              value={customerSearch}
              onChange={e => {
                setCustomerSearch(e.target.value);
                setShowDropdown(true);
                if (!e.target.value) {
                  setSelectedCustomer(null);
                  setForm(f => ({ ...f, customerId: '' }));
                }
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Müşteri adı yazarak arayın..."
              required={!form.customerId}
            />
            {showDropdown && customerSearch && filteredCustomers.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '0.5rem',
                maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}>
                {filteredCustomers.slice(0, 20).map(c => (
                  <div
                    key={c.id}
                    onClick={() => selectCustomer(c)}
                    style={{
                      padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.875rem',
                      borderBottom: '1px solid #f3f4f6',
                      backgroundColor: form.customerId === c.id ? '#eff6ff' : 'white',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = form.customerId === c.id ? '#eff6ff' : 'white')}
                  >
                    <div style={{ fontWeight: '500' }}>{c.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{c.phone} {c.address ? `• ${c.address}` : ''}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seçili müşteri adres bilgisi */}
          {selectedCustomer && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={label}>Telefon</label>
                <input style={readonlyInput} value={selectedCustomer.phone} readOnly />
              </div>
              <div>
                <label style={label}>Adres</label>
                <input style={readonlyInput} value={selectedCustomer.address || '-'} readOnly />
              </div>
            </div>
          )}
        </div>

        {/* ═══ 2. Cihaz Seçimi ═══ */}
        {form.customerId && (
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1rem' }}>
            <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>🖨️ Cihaz Bilgileri</h2>

            <div style={{ marginBottom: '1rem' }}>
              <label style={label}>Cihaz Seç *</label>
              {devices.length === 0 ? (
                <div>
                  <p style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Bu müşteriye ait cihaz bulunamadı</p>
                  <Link href={`/devices/new?customerId=${form.customerId}`} style={{
                    display: 'inline-block', padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white',
                    borderRadius: '0.5rem', textDecoration: 'none', fontSize: '0.875rem', fontWeight: '500',
                  }}>+ Yeni Cihaz Ekle</Link>
                </div>
              ) : (
                <select required style={input} value={form.deviceId} onChange={e => setForm({ ...form, deviceId: e.target.value })}>
                  <option value="">Cihaz seçin...</option>
                  {devices.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.brand} {d.model} — SN: {d.serialNo}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Seçili cihaz detayları + düzenlenebilir sayaçlar */}
            {selectedDevice && (
              <div style={{ backgroundColor: '#f0f9ff', borderRadius: '0.5rem', padding: '1rem', border: '1px solid #bae6fd' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ ...label, fontSize: '0.75rem', color: '#0369a1' }}>Marka</label>
                    <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>{selectedDevice.brand}</div>
                  </div>
                  <div>
                    <label style={{ ...label, fontSize: '0.75rem', color: '#0369a1' }}>Model</label>
                    <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>{selectedDevice.model}</div>
                  </div>
                  <div>
                    <label style={{ ...label, fontSize: '0.75rem', color: '#0369a1' }}>Seri No</label>
                    <div style={{ fontWeight: '600', fontSize: '0.875rem', fontFamily: 'monospace' }}>{selectedDevice.serialNo}</div>
                  </div>
                  <div>
                    <label style={{ ...label, fontSize: '0.75rem', color: '#0369a1' }}>Konum</label>
                    <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>{selectedDevice.location || '-'}</div>
                  </div>
                </div>

                {/* Düzenlenebilir sayaç alanları */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem', borderTop: '1px solid #bae6fd', paddingTop: '0.75rem' }}>
                  <div>
                    <label style={{ ...label, fontSize: '0.75rem', color: '#0369a1' }}>Sayaç (Siyah)</label>
                    <input
                      type="number" min="0"
                      style={{ ...input, backgroundColor: 'white', fontWeight: '600' }}
                      value={form.counterBlack}
                      onChange={e => setForm({ ...form, counterBlack: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label style={{ ...label, fontSize: '0.75rem', color: '#0369a1' }}>Sayaç (Renkli)</label>
                    <input
                      type="number" min="0"
                      style={{ ...input, backgroundColor: 'white', fontWeight: '600' }}
                      value={form.counterColor}
                      onChange={e => setForm({ ...form, counterColor: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Öncelik + Teknisyen */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={label}>Öncelik</label>
                <select style={input} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  <option value="LOW">Düşük</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">Yüksek</option>
                  <option value="URGENT">Acil</option>
                </select>
              </div>
              <div>
                <label style={label}>Teknisyen</label>
                <select style={input} value={form.assignedUserId} onChange={e => setForm({ ...form, assignedUserId: e.target.value })}>
                  <option value="">Atanmadı</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ═══ 3. Arıza Bilgileri ═══ */}
        {form.deviceId && (
          <>
            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1rem' }}>
              <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>🔧 Arıza Bilgileri</h2>

              <div style={{ marginBottom: '1rem' }}>
                <label style={label}>Arıza Şablonu</label>
                <select style={input} value={form.issueTemplate} onChange={e => setForm({ ...form, issueTemplate: e.target.value, issueText: e.target.value })}>
                  <option value="">Seçin veya manuel yazın...</option>
                  {['Kağıt Sıkışması', 'Toner Sorunu', 'Baskı Kalitesi', 'Besleme Hatası', 'Ağ Bağlantısı', 'Fırın Arızası', 'Drum Sorunu', 'Diğer'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={label}>Arıza Açıklaması *</label>
                <textarea required rows={3} style={input} value={form.issueText}
                  onChange={e => setForm({ ...form, issueText: e.target.value })}
                  placeholder="Arızayı detaylı açıklayın..." />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={label}>Yapılan İşlem</label>
                <textarea rows={3} style={input} value={form.actionText}
                  onChange={e => setForm({ ...form, actionText: e.target.value })}
                  placeholder="Yapılan işlemi yazın..." />
              </div>

              <div>
                <label style={label}>Notlar</label>
                <textarea rows={2} style={input} value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Ek notlar..." />
              </div>
            </div>

            {/* ═══ 4. Ücret ═══ */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1rem' }}>
              <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>💰 Ücret</h2>
              <div>
                <label style={label}>Toplam Tutar (₺)</label>
                <input type="number" step="0.01" style={input} value={form.totalCost}
                  onChange={e => setForm({ ...form, totalCost: e.target.value })}
                  placeholder="0.00" />
              </div>
            </div>

            {/* ═══ Submit ═══ */}
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
          </>
        )}
      </form>
    </div>
  );
}