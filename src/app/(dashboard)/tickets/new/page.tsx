'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useBarcodeWedge } from '@/hooks/useBarcodeWedge';
import FaultCategoryPicker from '@/components/FaultCategoryPicker';
import TicketProgress from '@/components/TicketProgress';
import FaultInsight, { type FaultHistory } from '@/components/FaultInsight';
import CihazUyarilari from '@/components/CihazUyarilari';
import SaveSuccess from '@/components/SaveSuccess';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

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
  // `sz` (sözlük): sayfanın alt kısmında `t` adı zamanlayıcıya ait.
  const sz = useT();
  const b = useBicim();
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
      alert(doldur(sz.fisler.hata, { n: data.error || JSON.stringify(data) }));
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
          <span style={{ fontWeight: '700', fontSize: '1rem' }}>{sz.cihazHizli.baslik}</span>
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
              <label style={lbl}>{sz.fisYeni.marka} *</label>
              <input required style={inp} value={dform.brand}
                onChange={e => setDform({ ...dform, brand: e.target.value })}
                placeholder={sz.cihazHizli.markaYer} />
            </div>
            <div>
              <label style={lbl}>{sz.fisYeni.model} *</label>
              <input required style={inp} value={dform.model}
                onChange={e => setDform({ ...dform, model: e.target.value })}
                placeholder={sz.cihazHizli.modelYer} />
            </div>
          </div>

          {/* Seri No */}
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={lbl}>{sz.fisDetay.seriNo} *</label>
            <input required style={inp} value={dform.serialNo}
              onChange={e => setDform({ ...dform, serialNo: e.target.value })}
              placeholder={sz.cihazHizli.seriYer} />
          </div>

          {/* Konum */}
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={lbl}>{sz.fisDetay.konum}</label>
            <input style={inp} value={dform.location}
              onChange={e => setDform({ ...dform, location: e.target.value })}
              placeholder={sz.cihazHizli.konumYer} />
          </div>

          {/* Sayaçlar */}
          <div style={g2}>
            <div>
              <label style={lbl}>{sz.fisDetay.siyahSayac}</label>
              <input type="number" min="0" style={inp} value={dform.counterBlack}
                onChange={e => setDform({ ...dform, counterBlack: e.target.value })}
                placeholder="0" />
            </div>
            <div>
              <label style={lbl}>{sz.fisDetay.renkliSayac}</label>
              <input type="number" min="0" style={inp} value={dform.counterColor}
                onChange={e => setDform({ ...dform, counterColor: e.target.value })}
                placeholder="0" />
            </div>
          </div>

          {/* Kiralık toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginBottom: dform.isRental ? '0.75rem' : '1rem' }}>
            <input type="checkbox" checked={dform.isRental} onChange={e => setDform({ ...dform, isRental: e.target.checked })} />
            <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>{sz.cihazHizli.kiralikCihaz}</span>
          </label>

          {dform.isRental && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={lbl}>{doldur(sz.cihazHizli.aylikKira, { birim: b.simge })}</label>
                <input type="number" min="0" style={inp} value={dform.monthlyRent}
                  onChange={e => setDform({ ...dform, monthlyRent: e.target.value })} placeholder="500" />
              </div>
              <div style={g2}>
                <div>
                  <label style={lbl}>{doldur(sz.cihazHizli.siyahBirim, { birim: b.simge })}</label>
                  <input type="number" step="0.01" style={inp} value={dform.pricePerBlack}
                    onChange={e => setDform({ ...dform, pricePerBlack: e.target.value })} placeholder={sz.cihazHizli.varsayilan} />
                </div>
                <div>
                  <label style={lbl}>{doldur(sz.cihazHizli.renkliBirim, { birim: b.simge })}</label>
                  <input type="number" step="0.01" style={inp} value={dform.pricePerColor}
                    onChange={e => setDform({ ...dform, pricePerColor: e.target.value })} placeholder={sz.cihazHizli.varsayilan} />
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
              {saving ? sz.cihazHizli.ekleniyor : sz.cihazHizli.ekleSec}
            </button>
            <button type="button" onClick={onClose} style={{
              padding: '0.65rem 1rem', border: '1px solid #d1d5db', backgroundColor: 'white',
              borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '500', fontSize: '0.875rem', color: '#374151',
            }}>{sz.genel.iptal}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function NewTicketPage() {
  const router = useRouter();
  // `sz` (sözlük): aşağıdaki zamanlayıcı efekti `t` adını kullanıyor.
  const sz = useT();
  const b = useBicim();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [nextTicketNumber, setNextTicketNumber] = useState('');
  // Cihazın 12 aylık arıza geçmişi (teşhis bilgisi için)
  const [faultHistory, setFaultHistory] = useState<FaultHistory | null>(null);
  // Kaydedildi ekranı — asıl tamamlanma anı
  const [saved, setSaved] = useState<{ ticketNumber?: string } | null>(null);

  const [form, setForm] = useState({
    customerId: '',
    deviceId: '',
    issueTemplate: '',
    faultCategory: '',
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
  const [deviceSearch, setDeviceSearch] = useState('');
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const [pendingDeviceId, setPendingDeviceId] = useState<string | null>(null);
  const [scanMsg, setScanMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const scanCustomerRef = useRef<string | null>(null); // okutmanın seçtiği müşteri (yanlış temizlemeyi önler)

  useEffect(() => {
    if (!scanMsg) return;
    const t = setTimeout(() => setScanMsg(null), 4000);
    return () => clearTimeout(t);
  }, [scanMsg]);

  // 📷 Cihaz barkodunu okut → müşteri + cihaz otomatik seçilsin (makine gelince fiş aç)
  useBarcodeWedge(async (code) => {
    setScanMsg({ text: doldur(sz.fisYeni.cihazAraniyor, { n: code }), ok: true });
    try {
      const r = await fetch(`/api/devices/lookup?code=${encodeURIComponent(code)}`);
      if (!r.ok) { const e = await r.json().catch(() => ({})); setScanMsg({ text: e.error || doldur(sz.fisYeni.cihazBulunamadi, { n: code }), ok: false }); return; }
      const d = await r.json();
      if (!d.customer) { setScanMsg({ text: sz.fisYeni.musteriBulunamadi, ok: false }); return; }
      scanCustomerRef.current = d.customer.id; // bu müşteri-değişimi okutmadan geldi
      setSelectedCustomer({ id: d.customer.id, name: d.customer.name, phone: d.customer.phone, address: null });
      setCustomerSearch(d.customer.name);
      setShowDropdown(false);
      setForm(f => ({ ...f, customerId: d.customer.id }));
      setPendingDeviceId(d.id); // cihazlar yüklenince seçilecek
      setScanMsg({ text: doldur(sz.fisYeni.secildi, { n: `${d.brand} ${d.model} (${d.customer.name})` }), ok: true });
    } catch { setScanMsg({ text: sz.genel.baglantiHatasi, ok: false }); }
  }, { enabled: !showAddDevice });

  // Cihazlar (müşteriye göre) yüklenince, okutulan cihazı seç
  useEffect(() => {
    if (!pendingDeviceId) return;
    const dev = devices.find(d => d.id === pendingDeviceId);
    if (dev) {
      setForm(f => ({ ...f, deviceId: dev.id, counterBlack: dev.counterBlack?.toString() || '', counterColor: dev.counterColor?.toString() || '' }));
      setSelectedDevice(dev);
      setDeviceSearch(`${dev.brand} ${dev.model} — SN: ${dev.serialNo}`);
      setPendingDeviceId(null);
    }
  }, [devices, pendingDeviceId]);

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
    setDeviceSearch('');
    // Müşteri ELLE değiştirildiyse bekleyen (okutulan) cihazı iptal et; okutmadan geldiyse koru
    if (scanCustomerRef.current !== form.customerId) setPendingDeviceId(null);
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
    setDeviceSearch(`${device.brand} ${device.model} — SN: ${device.serialNo}`);
    setShowDeviceDropdown(false);
    setShowAddDevice(false);
  };

  // Cihazın arıza geçmişi — cihaz seçilince BİR kez çekilir, kategori değişince
  // yeniden istek atılmaz. Böylece bilgi anında görünür, akış yavaşlamaz.
  useEffect(() => {
    if (!form.deviceId) { setFaultHistory(null); return; }
    let iptal = false;
    fetch(`/api/devices/${form.deviceId}/fault-history`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!iptal) setFaultHistory(d); })
      .catch(() => { if (!iptal) setFaultHistory(null); }); // geçmiş alınamazsa sessiz geç
    return () => { iptal = true; };
  }, [form.deviceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Kategori seçici native "required" taşımaz (input değil, buton listesi).
    // Tek dokunuşluk bir alan olduğu için engelliyoruz — ama tahmin ürettirmemek adına
    // otomatik varsayılan ATANMAZ; kullanıcı bilerek seçer.
    if (!form.faultCategory) {
      alert(sz.fisYeni.kategoriZorunlu);
      document.getElementById('ariza-kategorisi')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setLoading(true);
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: form.deviceId,
        issueTemplate: form.issueTemplate || undefined,
        faultCategory: form.faultCategory || undefined,
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
      // Sayaç kaydedilemediyse SESSİZ GEÇME — kullanıcı bunu bilmeli, yoksa
      // eski davranıştaki gibi veri sessizce kaybolur.
      if (data.counterError) {
        alert(doldur(sz.fisYeni.sayacKaydedilemedi, { n: data.counterError.message }));
      }
      // Asıl tamamlanma anı burası — kısa bir onay göster, sonra fişe geç.
      setSaved({ ticketNumber: data.ticketNumber });
      window.setTimeout(() => router.push(`/tickets/${data.id}`), 1100);
    } else {
      alert(doldur(sz.fisler.hata, { n: data.error || JSON.stringify(data) }));
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
        <Link href="/tickets" style={{ color: '#6b7280', fontSize: '0.875rem', textDecoration: 'none' }}>{sz.fisYeni.geri}</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>{sz.fisYeni.baslik}</h1>
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

      {/* 📷 Cihaz okutma ipucu + geri bildirim */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem',
        background: scanMsg ? (scanMsg.ok ? '#ecfdf5' : '#fef2f2') : '#ecfeff',
        border: `1px solid ${scanMsg ? (scanMsg.ok ? '#a7f3d0' : '#fecaca') : '#a5f3fc'}`,
        color: scanMsg ? (scanMsg.ok ? '#047857' : '#b91c1c') : '#0e7490',
        borderRadius: '0.5rem', padding: '0.6rem 0.9rem', fontSize: '0.85rem', fontWeight: 500,
      }}>
        <span style={{ fontSize: '1rem' }}>📷</span>
        {scanMsg ? scanMsg.text : sz.fisYeni.okutIpucu}
      </div>

      {saved && <SaveSuccess ticketNumber={saved.ticketNumber} />}

      <form onSubmit={handleSubmit}>
        <TicketProgress steps={[
          { label: sz.fisYeni.adimMusteri, done: !!form.customerId },
          { label: sz.fisYeni.adimCihaz, done: !!form.deviceId },
          { label: sz.fisYeni.adimKategori, done: !!form.faultCategory },
          { label: sz.fisYeni.adimAciklama, done: !!form.issueText.trim() },
        ]} />

        {/* ═══ 1. Müşteri Seçimi ═══ */}
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1rem' }}>
          <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>{sz.fisYeni.musteriBilgileri}</h2>

          <div style={{ marginBottom: '1rem', position: 'relative' }}>
            <label style={label}>{sz.fisYeni.musteriAdi}</label>
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
              placeholder={sz.fisYeni.musteriYer}
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
                <label style={label}>{sz.fisDetay.telefon}</label>
                <input style={readonlyInput} value={selectedCustomer.phone} readOnly />
              </div>
              <div>
                <label style={label}>{sz.fisYeni.adres}</label>
                <input style={readonlyInput} value={selectedCustomer.address || '-'} readOnly />
              </div>
            </div>
          )}
        </div>

        {/* ═══ 2. Cihaz Seçimi ═══ */}
        {form.customerId && (
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1rem' }}>
            <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>{sz.fisYeni.cihazBilgileri}</h2>

            <div style={{ marginBottom: '1rem' }}>
              <label style={label}>{sz.fisYeni.cihazSec}</label>
              {devices.length === 0 ? (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '0.5rem', padding: '1rem' }}>
                  <p style={{ color: '#92400e', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                    {sz.fisYeni.cihazYok}
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
                    {sz.fisYeni.hizliCihaz}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  {/* Aranabilir Cihaz Seçimi */}
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type="text"
                      style={input}
                      value={deviceSearch}
                      onChange={e => {
                        setDeviceSearch(e.target.value);
                        setShowDeviceDropdown(true);
                        if (!e.target.value) {
                          setForm(f => ({ ...f, deviceId: '' }));
                          setSelectedDevice(null);
                        }
                      }}
                      onFocus={() => setShowDeviceDropdown(true)}
                      placeholder={sz.fisYeni.cihazAraYer}
                    />
                    {showDeviceDropdown && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                        backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '0.5rem',
                        maxHeight: '260px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        marginTop: '2px',
                      }}>
                        {devices
                          .filter(d => {
                            const q = deviceSearch.toLowerCase();
                            return !q ||
                              d.brand.toLowerCase().includes(q) ||
                              d.model.toLowerCase().includes(q) ||
                              d.serialNo.toLowerCase().includes(q) ||
                              (d.location || '').toLowerCase().includes(q);
                          })
                          .map(d => (
                            <div
                              key={d.id}
                              onClick={() => {
                                setForm(f => ({
                                  ...f,
                                  deviceId: d.id,
                                  counterBlack: d.counterBlack?.toString() || '',
                                  counterColor: d.counterColor?.toString() || '',
                                }));
                                setSelectedDevice(d);
                                setDeviceSearch(`${d.brand} ${d.model} — SN: ${d.serialNo}`);
                                setShowDeviceDropdown(false);
                              }}
                              style={{
                                padding: '0.6rem 0.75rem', cursor: 'pointer', fontSize: '0.875rem',
                                borderBottom: '1px solid #f3f4f6',
                                backgroundColor: form.deviceId === d.id ? '#eff6ff' : 'white',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = form.deviceId === d.id ? '#eff6ff' : 'white')}
                            >
                              <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                                {d.brand} {d.model}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.1rem' }}>
                                SN: <span style={{ fontFamily: 'monospace' }}>{d.serialNo}</span>
                                {d.location && <span> • {d.location}</span>}
                                {d.counterBlack != null && <span style={{ marginLeft: '0.5rem' }}>⚫{b.sayi(d.counterBlack)}</span>}
                                {d.counterColor != null && <span style={{ marginLeft: '0.25rem' }}>🟣{b.sayi(d.counterColor)}</span>}
                              </div>
                            </div>
                          ))}
                        {devices.filter(d => {
                          const q = deviceSearch.toLowerCase();
                          return !q || d.brand.toLowerCase().includes(q) || d.model.toLowerCase().includes(q) || d.serialNo.toLowerCase().includes(q);
                        }).length === 0 && (
                          <div style={{ padding: '0.75rem', color: '#9ca3af', fontSize: '0.875rem' }}>{sz.fisYeni.sonucYok}</div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddDevice(true)}
                    title={sz.fisYeni.cihazEkleIpucu}
                    style={{
                      padding: '0.625rem 0.9rem', backgroundColor: '#f0f9ff', color: '#2563eb',
                      border: '1px solid #bfdbfe', borderRadius: '0.5rem', cursor: 'pointer',
                      fontWeight: '600', fontSize: '0.875rem', whiteSpace: 'nowrap',
                    }}
                  >
                    {sz.fisYeni.cihazEkle}
                  </button>
                </div>
              )}
            </div>

            {selectedDevice && (
              <div style={{ backgroundColor: '#f0f9ff', borderRadius: '0.5rem', padding: '1rem', border: '1px solid #bae6fd' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ ...label, fontSize: '0.75rem', color: '#0369a1' }}>{sz.fisYeni.marka}</label>
                    <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>{selectedDevice.brand}</div>
                  </div>
                  <div>
                    <label style={{ ...label, fontSize: '0.75rem', color: '#0369a1' }}>{sz.fisYeni.model}</label>
                    <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>{selectedDevice.model}</div>
                  </div>
                  <div>
                    <label style={{ ...label, fontSize: '0.75rem', color: '#0369a1' }}>{sz.fisDetay.seriNo}</label>
                    <div style={{ fontWeight: '600', fontSize: '0.875rem', fontFamily: 'monospace' }}>{selectedDevice.serialNo}</div>
                  </div>
                  <div>
                    <label style={{ ...label, fontSize: '0.75rem', color: '#0369a1' }}>{sz.fisDetay.konum}</label>
                    <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>{selectedDevice.location || '-'}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem', borderTop: '1px solid #bae6fd', paddingTop: '0.75rem' }}>
                  <div>
                    <label style={{ ...label, fontSize: '0.75rem', color: '#0369a1' }}>{sz.fisYeni.sayacSiyah}</label>
                    <input
                      type="number" min="0"
                      style={{ ...input, backgroundColor: 'white', fontWeight: '600' }}
                      value={form.counterBlack}
                      onChange={e => setForm({ ...form, counterBlack: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label style={{ ...label, fontSize: '0.75rem', color: '#0369a1' }}>{sz.fisYeni.sayacRenkli}</label>
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
                <label style={label}>{sz.fisYeni.oncelik}</label>
                <select style={input} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).map(o => (
                    <option key={o} value={o}>{sz.durum.oncelik[o]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={label}>{sz.fisDetay.teknisyen}</label>
                <select style={input} value={form.assignedUserId} onChange={e => setForm({ ...form, assignedUserId: e.target.value })}>
                  <option value="">{sz.fisPanel.atanmadi}</option>
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
            {/* Garanti ve tekrar arıza, arıza bilgilerinden ÖNCE: ikisi de
                "bu işi nasıl yapacağım" sorusunu değiştiriyor. Formu
                doldurduktan sonra görmek geç olur. */}
            <CihazUyarilari
              garanti={(faultHistory as any)?.garanti}
              tekrar={(faultHistory as any)?.tekrarAriza}
              deviceId={form.deviceId}
            />

            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1rem' }}>
              <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>{sz.fisYeni.arizaBilgileri}</h2>

              <div id="ariza-kategorisi" style={{ marginBottom: '1rem' }}>
                <label style={label}>{sz.fisDetay.arizaKategorisi} *</label>
                <FaultCategoryPicker
                  value={form.faultCategory}
                  onChange={(code, catLabel) => setForm(f => ({
                    ...f,
                    faultCategory: code,
                    issueTemplate: catLabel,
                    // Açıklama boşsa kategoriyle başlat; teknisyen yazdıysa ÜZERİNE YAZMA
                    issueText: f.issueText.trim() ? f.issueText : catLabel,
                  }))}
                />
                {/* Kategori seçilir seçilmez teşhis bilgisi — kategoriyi zorunluluktan
                    araca çevirir; doğru seçmek teknisyenin kendi işine yarar. */}
                <FaultInsight history={faultHistory} category={form.faultCategory} />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={label}>{sz.fisYeni.arizaAciklamasiZorunlu}</label>
                <textarea required rows={3} style={input} value={form.issueText}
                  onChange={e => setForm({ ...form, issueText: e.target.value })}
                  placeholder={sz.fisYeni.arizaYer} />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={label}>{sz.fisDetay.yapilanIslem}</label>
                <textarea rows={3} style={input} value={form.actionText}
                  onChange={e => setForm({ ...form, actionText: e.target.value })}
                  placeholder={sz.fisYeni.islemYer} />
              </div>

              <div>
                <label style={label}>{sz.fisDetay.notlar}</label>
                <textarea rows={2} style={input} value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder={sz.fisYeni.notYer} />
              </div>
            </div>

            {/* ═══ 4. Ücret ═══ */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1rem' }}>
              <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>{sz.fisYeni.ucret}</h2>
              <div>
                <label style={label}>{doldur(sz.fisPanel.toplamTutar, { birim: b.simge })}</label>
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
                {loading ? sz.genel.kaydediliyor : sz.fisYeni.olustur}
              </button>
              <Link href="/tickets" style={{
                padding: '0.75rem 2rem', borderRadius: '0.5rem', border: '1px solid #d1d5db',
                textDecoration: 'none', color: '#374151', fontWeight: '500',
              }}>{sz.genel.iptal}</Link>
            </div>
          </>
        )}
      </form>
    </div>
  );
}