'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Customer { id: string; name: string; phone: string; address: string | null; }
interface Device {
  id: string; brand: string; model: string; serialNo: string;
  counterBlack: number | null; counterColor: number | null; location: string | null;
}

// ─── Inline Cihaz Ekleme Modalı ───────────────────────────────────────────────
function QuickAddDeviceModal({
  customerId,
  onClose,
  onCreated,
}: {
  customerId: string;
  onClose: () => void;
  onCreated: (device: Device) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [dform, setDform] = useState({
    brand: '', model: '', serialNo: '', location: '',
    counterBlack: '', counterColor: '',
    isRental: false, monthlyRent: '', pricePerBlack: '', pricePerColor: '',
  });

  const inp: React.CSSProperties = {
    width: '100%', padding: '0.55rem 0.7rem', border: '1px solid #d1d5db',
    borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '0.8rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem',
  };
  const g2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...dform, customerId }),
    });
    const data = await res.json();
    if (res.ok) {
      onCreated(data);
    } else {
      alert('Hata: ' + (data.error || JSON.stringify(data)));
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '1rem',
        width: '100%', maxWidth: '520px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Modal Başlık */}
        <div style={{
          background: 'linear-gradient(135deg, #1e3a5f, #2563eb)',
          color: 'white', padding: '1rem 1.25rem',
          borderRadius: '1rem 1rem 0 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontWeight: '700', fontSize: '1rem' }}>🖨️ Hızlı Cihaz Ekle</span>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.2)', color: 'white',
            border: 'none', borderRadius: '50%', width: '28px', height: '28px',
            cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        <form onSubmit={submit} style={{ padding: '1.25rem' }}>
          {/* Marka & Model */}
          <div style={g2}>
            <div>
              <label style={lbl}>Marka *</label>
              <input required style={inp} value={dform.brand}
                onChange={e => setDform({ ...dform, brand: e.target.value })}
                placeholder="Canon, HP, Xerox..." />
            </div>
            <div>
              <label style={lbl}>Model *</label>
              <input required style={inp} value={dform.model}
                onChange={e => setDform({ ...dform, model: e.target.value })}
                placeholder="iR2425, LaserJet..." />
            </div>
          </div>

          {/* Seri No */}
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={lbl}>Seri No *</label>
            <input required style={inp} value={dform.serialNo}
              onChange={e => setDform({ ...dform, serialNo: e.target.value })}
              placeholder="Örn: CNR987654" />
          </div>

          {/* Konum */}
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={lbl}>Konum</label>
            <input style={inp} value={dform.location}
              onChange={e => setDform({ ...dform, location: e.target.value })}
              placeholder="Muhasebe, Ofis..." />
          </div>

          {/* Sayaçlar */}
          <div style={g2}>
            <div>
              <label style={lbl}>⚫ Siyah Sayaç</label>
              <input type="number" min="0" style={inp} value={dform.counterBlack}
                onChange={e => setDform({ ...dform, counterBlack: e.target.value })}
                placeholder="0" />
            </div>
            <div>
              <label style={lbl}>🟣 Renkli Sayaç</label>
              <input type="number" min="0" style={inp} value={dform.counterColor}
                onChange={e => setDform({ ...dform, counterColor: e.target.value })}
                placeholder="0" />
            </div>
          </div>

          {/* Kiralık toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginBottom: dform.isRental ? '0.75rem' : '1rem' }}>
            <input type="checkbox" checked={dform.isRental} onChange={e => setDform({ ...dform, isRental: e.target.checked })} />
            <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>🏷️ Kiralık Cihaz</span>
          </label>

          {dform.isRental && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={lbl}>Aylık Kira (₺)</label>
                <input type="number" min="0" style={inp} value={dform.monthlyRent}
                  onChange={e => setDform({ ...dform, monthlyRent: e.target.value })} placeholder="500" />
              </div>
              <div style={g2}>
                <div>
                  <label style={lbl}>⚫ Siyah Birim (₺)</label>
                  <input type="number" step="0.01" style={inp} value={dform.pricePerBlack}
                    onChange={e => setDform({ ...dform, pricePerBlack: e.target.value })} placeholder="Varsayılan" />
                </div>
                <div>
                  <label style={lbl}>🟣 Renkli Birim (₺)</label>
                  <input type="number" step="0.01" style={inp} value={dform.pricePerColor}
                    onChange={e => setDform({ ...dform, pricePerColor: e.target.value })} placeholder="Varsayılan" />
                </div>
              </div>
            </div>
          )}

          {/* Butonlar */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" disabled={saving} style={{
              flex: 1, padding: '0.65rem', backgroundColor: '#2563eb', color: 'white',
              border: 'none', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer',
              fontSize: '0.875rem', opacity: saving ? 0.7 : 1,
            }}>
              {saving ? 'Ekleniyor...' : '✅ Cihazı Ekle & Seç'}
            </button>
            <button type="button" onClick={onClose} style={{
              padding: '0.65rem 1rem', border: '1px solid #d1d5db', backgroundColor: 'white',
              borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '500', fontSize: '0.875rem', color: '#374151',
            }}>İptal</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function NewTicketPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAddDevice, setShowAddDevice] = useState(false);
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

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  useEffect(() => {
    fetch('/api/tickets/next-ticket-number')
      .then(r => r.json())
      .then(d => setNextTicketNumber(d.ticketNumber || ''))
      .catch(() => { });
  }, []);

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(setUsers);
  }, []);

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then((data: any) => {
      const list = Array.isArray(data) ? data : data.customers || [];
      setCustomers(list);
    });
  }, []);

  const loadDevices = useCallback((customerId: string) => {
    if (customerId) {
      fetch(`/api/customers/${customerId}/devices`)
        .then(r => r.json())
        .then(setDevices);
    } else {
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    loadDevices(form.customerId);
    setForm(f => ({ ...f, deviceId: '' }));
    setSelectedDevice(null);
  }, [form.customerId, loadDevices]);

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

  // Hızlı cihaz ekleme tamamlandı → listeye ekle + seç
  const handleDeviceCreated = (device: Device) => {
    setDevices(prev => [...prev, device]);
    setForm(f => ({
      ...f,
      deviceId: device.id,
      counterBlack: device.counterBlack?.toString() || '',
      counterColor: device.counterColor?.toString() || '',
    }));
    setSelectedDevice(device);
    setShowAddDevice(false);
  };

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
      {showAddDevice && form.customerId && (
        <QuickAddDeviceModal
          customerId={form.customerId}
          onClose={() => setShowAddDevice(false)}
          onCreated={handleDeviceCreated}
        />
      )}

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
                maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '0.5rem', padding: '1rem' }}>
                  <p style={{ color: '#92400e', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                    Bu müşteriye ait cihaz bulunamadı.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddDevice(true)}
                    style={{
                      padding: '0.5rem 1.25rem', backgroundColor: '#2563eb', color: 'white',
                      border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
                      fontWeight: '600', fontSize: '0.875rem',
                    }}
                  >
                    + Hızlı Cihaz Ekle
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <select required style={{ ...input, flex: 1 }} value={form.deviceId} onChange={e => setForm({ ...form, deviceId: e.target.value })}>
                    <option value="">Cihaz seçin...</option>
                    {devices.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.brand} {d.model} — SN: {d.serialNo}
                      </option>
                    ))}
                  </select>
                  {/* Var olan cihazlar olsa bile yeni ekleyebilmek için buton */}
                  <button
                    type="button"
                    onClick={() => setShowAddDevice(true)}
                    title="Yeni cihaz ekle"
                    style={{
                      padding: '0.5rem 0.9rem', backgroundColor: '#f0f9ff', color: '#2563eb',
                      border: '1px solid #bfdbfe', borderRadius: '0.5rem', cursor: 'pointer',
                      fontWeight: '600', fontSize: '0.875rem', whiteSpace: 'nowrap',
                    }}
                  >
                    + Cihaz Ekle
                  </button>
                </div>
              )}
            </div>

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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem', borderTop: '1px solid #bae6fd', paddingTop: '0.75rem' }}>
                  <div>
                    <label style={{ ...label, fontSize: '0.75rem', color: '#0369a1' }}>⚫ Sayaç (Siyah)</label>
                    <input
                      type="number" min="0"
                      style={{ ...input, backgroundColor: 'white', fontWeight: '600' }}
                      value={form.counterBlack}
                      onChange={e => setForm({ ...form, counterBlack: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label style={{ ...label, fontSize: '0.75rem', color: '#0369a1' }}>🟣 Sayaç (Renkli)</label>
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
                fontSize: '0.95rem', opacity: loading ? 0.7 : 1,
              }}>
                {loading ? 'Kaydediliyor...' : 'Fiş Oluştur'}
              </button>
              <Link href="/tickets" style={{
                padding: '0.75rem 2rem', borderRadius: '0.5rem', border: '1px solid #d1d5db',
                textDecoration: 'none', color: '#374151', fontWeight: '500',
              }}>İptal</Link>
            </div>
          </>
        )}
      </form>
    </div>
  );
}