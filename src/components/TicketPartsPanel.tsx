'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Part {
    id: string;
    sku: string;
    name: string;
    sellPrice: number;
    stockQty: number;
}

interface TicketPart {
    id: string;
    quantity: number;
    unitPrice: number;
    part: { sku: string; name: string };
}

interface Props {
    ticketId: string;
}

export default function TicketPartsPanel({ ticketId }: Props) {
    const router = useRouter();
    const [ticketParts, setTicketParts] = useState<TicketPart[]>([]);
    const [allParts, setAllParts] = useState<Part[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedPartId, setSelectedPartId] = useState('');
    const [quantity, setQuantity] = useState('1');

    const load = async () => {
        const [tpRes, pRes] = await Promise.all([
            fetch(`/api/tickets/${ticketId}/parts`),
            fetch('/api/inventory'),
        ]);
        if (tpRes.ok) setTicketParts(await tpRes.json());
        if (pRes.ok) setAllParts(await pRes.json());
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const addPart = async () => {
        if (!selectedPartId) return;
        setSaving(true);
        const res = await fetch(`/api/tickets/${ticketId}/parts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ partId: selectedPartId, quantity: parseInt(quantity) }),
        });
        if (res.ok) {
            setSelectedPartId('');
            setQuantity('1');
            await load();
            router.refresh(); // Toplam tutarı güncelle
        } else {
            const d = await res.json();
            alert('Hata: ' + d.error);
        }
        setSaving(false);
    };

    const removePart = async (ticketPartId: string) => {
        if (!confirm('Bu parçayı fişten çıkarıp stoğa geri koymak isteniyor musunuz?')) return;
        await fetch(`/api/tickets/${ticketId}/parts?ticketPartId=${ticketPartId}`, {
            method: 'DELETE',
        });
        await load();
        router.refresh();
    };

    const total = ticketParts.reduce((s, tp) => s + Number(tp.unitPrice) * tp.quantity, 0);
    const inp = { padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem' };

    return (
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginTop: '1rem' }}>
            <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Kullanılan Parçalar</h2>

            {/* Parça Ekleme */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <select
                    style={{ ...inp, flex: '1', minWidth: '180px' }}
                    value={selectedPartId}
                    onChange={e => setSelectedPartId(e.target.value)}
                >
                    <option value="">Parça seçin...</option>
                    {allParts.map(p => (
                        <option key={p.id} value={p.id} disabled={p.stockQty <= 0}>
                            {p.name} (Stok: {p.stockQty}) — ₺{Number(p.sellPrice).toFixed(2)}
                        </option>
                    ))}
                </select>
                <input
                    type="number" min="1" style={{ ...inp, width: '70px' }}
                    value={quantity} onChange={e => setQuantity(e.target.value)}
                />
                <button onClick={addPart} disabled={!selectedPartId || saving} style={{
                    padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white',
                    border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '500',
                    opacity: (!selectedPartId || saving) ? 0.6 : 1, fontSize: '0.875rem',
                }}>
                    {saving ? '...' : '+ Ekle'}
                </button>
            </div>

            {/* Parça Listesi */}
            {loading ? (
                <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Yükleniyor...</p>
            ) : ticketParts.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>Henüz parça eklenmedi</p>
            ) : (
                <>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.75rem' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                {['SKU', 'Parça', 'Adet', 'Birim Fiyat', 'Toplam', ''].map(h => (
                                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {ticketParts.map(tp => (
                                <tr key={tp.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', fontFamily: 'monospace', color: '#6b7280' }}>{tp.part.sku}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>{tp.part.name}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>{tp.quantity}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>₺{Number(tp.unitPrice).toFixed(2)}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', fontWeight: '600' }}>₺{(Number(tp.unitPrice) * tp.quantity).toFixed(2)}</td>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                        <button onClick={() => removePart(tp.id)} style={{
                                            backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none',
                                            borderRadius: '0.375rem', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem',
                                        }}>Çıkar</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div style={{ textAlign: 'right', fontWeight: '700', fontSize: '1rem', color: '#059669' }}>
                        Parçalar Toplamı: ₺{total.toFixed(2)}
                    </div>
                </>
            )}
        </div>
    );
}
