'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
    device: {
        id: string;
        brand: string;
        model: string;
        serialNo: string;
        location: string | null;
        isRental?: boolean;
        monthlyRent?: number;
        pricePerBlack?: number | null;
        pricePerColor?: number | null;
    };
}

export default function DeviceEditPanel({ device }: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        brand: device.brand,
        model: device.model,
        serialNo: device.serialNo,
        location: device.location || '',
        isRental: device.isRental || false,
        monthlyRent: String(device.monthlyRent || 0),
        pricePerBlack: device.pricePerBlack != null ? String(device.pricePerBlack) : '',
        pricePerColor: device.pricePerColor != null ? String(device.pricePerColor) : '',
    });

    const save = async () => {
        setSaving(true);
        const res = await fetch(`/api/devices/${device.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        if (res.ok) {
            router.refresh();
            setOpen(false);
        } else {
            const d = await res.json();
            alert('Hata: ' + d.error);
        }
        setSaving(false);
    };

    const deleteDevice = async () => {
        if (!confirm(`"${device.brand} ${device.model}" cihazını silmek isteriyor musunuz?`)) return;
        const res = await fetch(`/api/devices/${device.id}`, { method: 'DELETE' });
        if (res.ok) {
            router.push('/devices');
        } else {
            const d = await res.json();
            alert('Silinemedi: ' + d.error);
        }
    };

    const inp = {
        width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db',
        borderRadius: '0.5rem', fontSize: '0.875rem', boxSizing: 'border-box' as const,
    };
    const lbl = { fontSize: '0.8rem', fontWeight: '500' as const, color: '#6b7280', display: 'block' as const, marginBottom: '0.25rem' };

    return (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button onClick={() => setOpen(!open)} style={{
                padding: '0.5rem 1rem', backgroundColor: open ? '#f3f4f6' : 'white',
                border: '1px solid #d1d5db', borderRadius: '0.5rem',
                fontSize: '0.875rem', cursor: 'pointer', fontWeight: '500',
            }}>
                {open ? '✕ Kapat' : '✏️ Düzenle'}
            </button>
            <button onClick={deleteDevice} style={{
                padding: '0.5rem 0.875rem', backgroundColor: '#fee2e2', border: 'none',
                borderRadius: '0.5rem', fontSize: '0.875rem', cursor: 'pointer',
                color: '#b91c1c', fontWeight: '500',
            }}>🗑️</button>

            {open && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }} onClick={() => setOpen(false)}>
                    <div style={{
                        backgroundColor: 'white', borderRadius: '1rem', padding: '2rem',
                        width: '100%', maxWidth: '480px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                    }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ fontWeight: '700', fontSize: '1.25rem', marginBottom: '1.5rem' }}>Cihaz Düzenle</h2>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div>
                                <label style={lbl}>Marka *</label>
                                <input style={inp} value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} />
                            </div>
                            <div>
                                <label style={lbl}>Model *</label>
                                <input style={inp} value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
                            </div>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={lbl}>Seri No *</label>
                            <input style={inp} value={form.serialNo} onChange={e => setForm({ ...form, serialNo: e.target.value })} />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={lbl}>Konum</label>
                            <input style={inp} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Muhasebe, Ofis..." />
                        </div>

                        {/* Kiralık Cihaz */}
                        <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: form.isRental ? '#eff6ff' : '#f9fafb', borderRadius: '0.5rem', border: form.isRental ? '1px solid #bfdbfe' : '1px solid #e5e7eb' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', marginBottom: form.isRental ? '0.75rem' : 0 }}>
                                <input type="checkbox" checked={form.isRental} onChange={e => setForm({ ...form, isRental: e.target.checked })} />
                                <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>Kiralık Cihaz</span>
                            </label>
                            {form.isRental && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                                    <p style={{ fontSize: '0.7rem', color: '#6b7280', margin: 0 }}>💡 Boş bırakırsanız Ayarlar&apos;daki varsayılan fiyat kullanılır</p>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button onClick={save} disabled={saving} style={{
                                flex: 1, padding: '0.75rem', backgroundColor: '#3b82f6', color: 'white',
                                border: 'none', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer',
                                opacity: saving ? 0.7 : 1,
                            }}>
                                {saving ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                            <button onClick={() => setOpen(false)} style={{
                                padding: '0.75rem 1.5rem', border: '1px solid #d1d5db', backgroundColor: 'white',
                                borderRadius: '0.5rem', cursor: 'pointer', color: '#374151',
                            }}>İptal</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
