'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Reading {
    id: string;
    counterBlack: number;
    counterColor: number;
    deltaBlack: number;
    deltaColor: number;
    calculatedCost: number;
    monthlyRent: number;
    readingDate: string;
    ticket?: { ticketNumber: string } | null;
}

interface DeviceInfo {
    isRental: boolean;
    monthlyRent: number;
    pricePerBlack: number | null;
    pricePerColor: number | null;
}

interface Pricing {
    pricePerBlack: number;
    pricePerColor: number;
    isDeviceLevel: boolean;
}

export default function CounterReadingPanel({ deviceId }: { deviceId: string }) {
    const router = useRouter();
    const [readings, setReadings] = useState<Reading[]>([]);
    const [device, setDevice] = useState<DeviceInfo | null>(null);
    const [pricing, setPricing] = useState<Pricing | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ counterBlack: '', counterColor: '', includeMonthlyRent: true });
    const [lastResult, setLastResult] = useState<any>(null);

    const load = async () => {
        const res = await fetch(`/api/devices/${deviceId}/readings`);
        if (res.ok) {
            const data = await res.json();
            setReadings(data.readings);
            setDevice(data.device);
            setPricing(data.pricing);
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const save = async () => {
        if (!form.counterBlack || !form.counterColor) return;
        setSaving(true);
        setLastResult(null);
        const res = await fetch(`/api/devices/${deviceId}/readings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                counterBlack: parseInt(form.counterBlack),
                counterColor: parseInt(form.counterColor),
                includeMonthlyRent: form.includeMonthlyRent,
            }),
        });
        if (res.ok) {
            const data = await res.json();
            setLastResult(data.breakdown);
            setForm({ counterBlack: '', counterColor: '', includeMonthlyRent: true });
            await load();
            router.refresh();
        } else {
            const d = await res.json();
            alert('Hata: ' + d.error);
        }
        setSaving(false);
    };

    const inp = { padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', width: '140px' };

    return (
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontWeight: '600' }}>Sayaç Okuma</h2>
                {device?.isRental && (
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', backgroundColor: '#dbeafe', color: '#1e40af', padding: '0.2rem 0.75rem', borderRadius: '9999px' }}>
                        KİRALIK
                    </span>
                )}
            </div>

            {/* Birim Fiyat Bilgisi (kiralık cihazlarda) */}
            {device?.isRental && pricing && (
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#eff6ff', borderRadius: '0.5rem', border: '1px solid #bfdbfe', fontSize: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span>⚫ Siyah: <b>₺{pricing.pricePerBlack.toFixed(2)}</b>/adet</span>
                    <span>🟣 Renkli: <b>₺{pricing.pricePerColor.toFixed(2)}</b>/adet</span>
                    {device.monthlyRent > 0 && <span>📅 Aidat: <b>₺{device.monthlyRent.toFixed(2)}</b>/ay</span>}
                    {pricing.isDeviceLevel && (
                        <span style={{ fontSize: '0.7rem', backgroundColor: '#fef3c7', color: '#92400e', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>Özel fiyat</span>
                    )}
                </div>
            )}

            {/* Yeni Okuma */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1.25rem', flexWrap: 'wrap', padding: '1rem', backgroundColor: '#f0f9ff', borderRadius: '0.5rem', border: '1px solid #bae6fd' }}>
                <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#374151', marginBottom: '0.3rem' }}>Siyah Sayaç</label>
                    <input type="number" style={inp} placeholder="örn. 2000" value={form.counterBlack} onChange={e => setForm({ ...form, counterBlack: e.target.value })} />
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#374151', marginBottom: '0.3rem' }}>Renkli Sayaç</label>
                    <input type="number" style={inp} placeholder="örn. 3500" value={form.counterColor} onChange={e => setForm({ ...form, counterColor: e.target.value })} />
                </div>
                {device?.isRental && device.monthlyRent > 0 && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.includeMonthlyRent} onChange={e => setForm({ ...form, includeMonthlyRent: e.target.checked })} />
                        Aylık aidat dahil
                    </label>
                )}
                <button onClick={save} disabled={!form.counterBlack || !form.counterColor || saving} style={{
                    padding: '0.5rem 1.25rem', backgroundColor: '#0ea5e9', color: 'white',
                    border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600',
                    opacity: (!form.counterBlack || !form.counterColor || saving) ? 0.6 : 1, fontSize: '0.875rem',
                    height: '37px',
                }}>
                    {saving ? '...' : '📊 Ekle'}
                </button>
            </div>

            {/* Son Hesaplama Sonucu */}
            {lastResult && (
                <div style={{ padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '0.5rem', border: '1px solid #86efac', marginBottom: '1.25rem' }}>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#065f46' }}>💰 Ücret Hesabı</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                        <div>⚫ Siyah: {lastResult.deltaBlack} × ₺{lastResult.pricePerBlack.toFixed(2)}</div>
                        <div style={{ fontWeight: '600' }}>= ₺{lastResult.blackCost.toFixed(2)}</div>
                        <div>🟣 Renkli: {lastResult.deltaColor} × ₺{lastResult.pricePerColor.toFixed(2)}</div>
                        <div style={{ fontWeight: '600' }}>= ₺{lastResult.colorCost.toFixed(2)}</div>
                        {lastResult.monthlyRent > 0 && <>
                            <div>📅 Aylık Aidat</div>
                            <div style={{ fontWeight: '600' }}>= ₺{lastResult.monthlyRent.toFixed(2)}</div>
                        </>}
                    </div>
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #86efac', fontSize: '1.1rem', fontWeight: '700', color: '#065f46' }}>
                        TOPLAM: ₺{lastResult.total.toFixed(2)}
                    </div>
                </div>
            )}

            {/* Okuma Geçmişi */}
            {loading ? (
                <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Yükleniyor...</p>
            ) : readings.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>Henüz sayaç okuma yok</p>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                {['Tarih', 'S. Sayaç', '+Δ Siyah', 'R. Sayaç', '+Δ Renkli', ...(device?.isRental ? ['Ücret'] : []), 'Fiş'].map(h => (
                                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>{h.replace(' Siyah', '').replace(' Renkli', '')}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {readings.map(r => (
                                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#374151' }}>
                                        {new Date(r.readingDate).toLocaleDateString('tr-TR')}
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', fontWeight: '600' }}>{r.counterBlack.toLocaleString('tr-TR')}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: r.deltaBlack > 0 ? '#059669' : '#6b7280' }}>
                                        {r.deltaBlack > 0 ? `+${r.deltaBlack.toLocaleString('tr-TR')}` : '—'}
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#7c3aed' }}>{r.counterColor.toLocaleString('tr-TR')}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: r.deltaColor > 0 ? '#7c3aed' : '#6b7280' }}>
                                        {r.deltaColor > 0 ? `+${r.deltaColor.toLocaleString('tr-TR')}` : '—'}
                                    </td>
                                    {device?.isRental && (
                                        <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', fontWeight: '700', color: Number(r.calculatedCost) > 0 ? '#059669' : '#6b7280' }}>
                                            {Number(r.calculatedCost) > 0 ? `₺${Number(r.calculatedCost).toFixed(2)}` : '—'}
                                        </td>
                                    )}
                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', fontFamily: 'monospace', color: '#2563eb' }}>
                                        {r.ticket?.ticketNumber || '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
