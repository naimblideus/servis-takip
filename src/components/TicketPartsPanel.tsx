'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Part {
    id: string;
    sku: string;
    name: string;
    sellPrice: number;
    stockQty: number;
    group: string | null;
}

interface TicketPart {
    id: string;
    quantity: number;
    unitPrice: number;
    part: { sku: string; name: string; group: string | null };
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

    // Arama state
    const [searchText, setSearchText] = useState('');
    const [showResults, setShowResults] = useState(false);
    const [selectedPart, setSelectedPart] = useState<Part | null>(null);
    const [quantity, setQuantity] = useState('1');
    const searchRef = useRef<HTMLDivElement>(null);

    // Yeni parça ekleme formu
    const [showNewPartForm, setShowNewPartForm] = useState(false);
    const [newPart, setNewPart] = useState({
        name: '', group: '', sellPrice: '', stockQty: '1'
    });
    const [creatingPart, setCreatingPart] = useState(false);

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

    // Dış tıklama ile dropdown'ı kapat
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Arama filtresi
    const filteredParts = allParts.filter(p =>
        p.name.toLowerCase().includes(searchText.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchText.toLowerCase()) ||
        (p.group && p.group.toLowerCase().includes(searchText.toLowerCase()))
    );

    const selectPart = (p: Part) => {
        setSelectedPart(p);
        setSearchText(`${p.sku} — ${p.name}`);
        setShowResults(false);
    };

    const addPart = async () => {
        if (!selectedPart) return;
        setSaving(true);
        const res = await fetch(`/api/tickets/${ticketId}/parts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ partId: selectedPart.id, quantity: parseInt(quantity) }),
        });
        if (res.ok) {
            setSelectedPart(null);
            setSearchText('');
            setQuantity('1');
            await load();
            router.refresh();
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

    // Inline fiyat/adet güncelleme
    const updateTicketPart = async (tpId: string, field: 'unitPrice' | 'quantity', value: string) => {
        const numVal = parseFloat(value);
        if (isNaN(numVal) || numVal < 0) return;
        await fetch(`/api/parts/ticket-parts/${tpId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: numVal }),
        });
        await load();
        router.refresh();
    };

    // Yeni parça oluştur (stoktan)
    const createNewPart = async () => {
        if (!newPart.name.trim()) return;
        setCreatingPart(true);
        try {
            const res = await fetch('/api/inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newPart.name,
                    group: newPart.group || null,
                    sellPrice: newPart.sellPrice || '0',
                    buyPrice: '0',
                    stockQty: newPart.stockQty || '1',
                    minStock: '1',
                }),
            });
            if (res.ok) {
                const createdPart = await res.json();
                // Listeyi güncelle ve yeni parçayı seç
                await load();
                setSelectedPart(createdPart);
                setSearchText(`${createdPart.sku} — ${createdPart.name}`);
                setShowNewPartForm(false);
                setNewPart({ name: '', group: '', sellPrice: '', stockQty: '1' });
            } else {
                const d = await res.json();
                alert('Hata: ' + d.error);
            }
        } catch (e) {
            alert('Ürün oluşturulurken hata oluştu');
        }
        setCreatingPart(false);
    };

    const total = ticketParts.reduce((s, tp) => s + Number(tp.unitPrice) * tp.quantity, 0);
    const inp: React.CSSProperties = { padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', boxSizing: 'border-box' };
    const editInp: React.CSSProperties = {
        padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem',
        fontSize: '0.875rem', width: '80px', textAlign: 'right' as const,
    };

    return (
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginTop: '1rem' }}>
            <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Kullanılan Parçalar</h2>

            {/* ═══ Parça Arama (Autocomplete) ═══ */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div ref={searchRef} style={{ flex: '1', minWidth: '200px', position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' }}>
                        Parça Ara (Ad, SKU veya Grup)
                    </label>
                    <input
                        type="text"
                        style={{ ...inp, width: '100%' }}
                        value={searchText}
                        onChange={e => {
                            setSearchText(e.target.value);
                            setShowResults(true);
                            if (!e.target.value) setSelectedPart(null);
                        }}
                        onFocus={() => setShowResults(true)}
                        placeholder="🔍 Parça adı veya kodu yazın..."
                    />
                    {showResults && searchText && filteredParts.length > 0 && (
                        <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                            backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '0.5rem',
                            maxHeight: '250px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        }}>
                            {filteredParts.slice(0, 30).map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => selectPart(p)}
                                    style={{
                                        padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.875rem',
                                        borderBottom: '1px solid #f3f4f6',
                                        backgroundColor: selectedPart?.id === p.id ? '#eff6ff' : 'white',
                                        opacity: p.stockQty <= 0 ? 0.5 : 1,
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = selectedPart?.id === p.id ? '#eff6ff' : 'white')}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#6b7280', marginRight: '0.5rem' }}>{p.sku}</span>
                                            <span style={{ fontWeight: '500' }}>{p.name}</span>
                                        </div>
                                        <span style={{ fontWeight: '600', color: '#059669', fontSize: '0.8rem' }}>₺{Number(p.sellPrice).toFixed(2)}</span>
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.15rem' }}>
                                        Stok: {p.stockQty} {p.group ? `• ${p.group}` : ''}
                                        {p.stockQty <= 0 && <span style={{ color: '#ef4444', marginLeft: '0.5rem' }}>Stok yok</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {showResults && searchText && filteredParts.length === 0 && (
                        <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                            backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '0.5rem',
                            padding: '0.75rem', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        }}>
                            <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: 0 }}>Sonuç bulunamadı</p>
                            <button
                                onClick={() => { setShowNewPartForm(true); setShowResults(false); setNewPart(p => ({ ...p, name: searchText })); }}
                                style={{
                                    marginTop: '0.5rem', padding: '0.375rem 0.75rem', backgroundColor: '#10b981',
                                    color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer',
                                    fontSize: '0.8rem', fontWeight: '500',
                                }}
                            >+ Yeni Ürün Oluştur</button>
                        </div>
                    )}
                </div>

                <input
                    type="number" min="1" style={{ ...inp, width: '70px' }}
                    value={quantity} onChange={e => setQuantity(e.target.value)}
                />
                <button onClick={addPart} disabled={!selectedPart || saving} style={{
                    padding: '0.5rem 1rem', backgroundColor: '#3b82f6', color: 'white',
                    border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '500',
                    opacity: (!selectedPart || saving) ? 0.6 : 1, fontSize: '0.875rem',
                }}>
                    {saving ? '...' : '+ Ekle'}
                </button>
                <button onClick={() => setShowNewPartForm(!showNewPartForm)} style={{
                    padding: '0.5rem 0.75rem', backgroundColor: '#f0fdf4', color: '#16a34a',
                    border: '1px solid #86efac', borderRadius: '0.5rem', cursor: 'pointer',
                    fontSize: '0.8rem', fontWeight: '500',
                }}>
                    Yeni Ürün
                </button>
            </div>

            {/* ═══ Yeni Parça Oluşturma Formu ═══ */}
            {showNewPartForm && (
                <div style={{
                    backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '0.5rem',
                    padding: '1rem', marginBottom: '1rem',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#16a34a', margin: 0 }}>Yeni Ürün Oluştur</h3>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Ürün kodu otomatik verilecek</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Ürün Adı *</label>
                            <input
                                type="text" style={{ ...inp, width: '100%' }}
                                value={newPart.name}
                                onChange={e => setNewPart({ ...newPart, name: e.target.value })}
                                placeholder="Ürün adı girin..."
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Ürün Grubu</label>
                            <select
                                style={{ ...inp, width: '100%' }}
                                value={newPart.group}
                                onChange={e => setNewPart({ ...newPart, group: e.target.value })}
                            >
                                <option value="">Grup seçin...</option>
                                {['FIRIN GURUBU', 'PATEN', 'İŞÇİLİK', 'DİŞLİ GURUBU', 'YEDEK PARÇA', 'TONER', 'TAMIRAT'].map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Satış Fiyatı (₺)</label>
                            <input
                                type="number" step="0.01" min="0" style={{ ...inp, width: '100%' }}
                                value={newPart.sellPrice}
                                onChange={e => setNewPart({ ...newPart, sellPrice: e.target.value })}
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#374151', marginBottom: '0.25rem' }}>Stok Adedi</label>
                            <input
                                type="number" min="0" style={{ ...inp, width: '100%' }}
                                value={newPart.stockQty}
                                onChange={e => setNewPart({ ...newPart, stockQty: e.target.value })}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <button onClick={createNewPart} disabled={creatingPart || !newPart.name.trim()} style={{
                            padding: '0.5rem 1rem', backgroundColor: '#16a34a', color: 'white',
                            border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '500',
                            fontSize: '0.85rem', opacity: (creatingPart || !newPart.name.trim()) ? 0.6 : 1,
                        }}>
                            {creatingPart ? 'Kaydediliyor...' : '✓ Oluştur ve Seç'}
                        </button>
                        <button onClick={() => setShowNewPartForm(false)} style={{
                            padding: '0.5rem 1rem', backgroundColor: 'white', color: '#374151',
                            border: '1px solid #d1d5db', borderRadius: '0.5rem', cursor: 'pointer',
                            fontSize: '0.85rem',
                        }}>İptal</button>
                    </div>
                </div>
            )}

            {/* ═══ Parça Listesi ═══ */}
            {loading ? (
                <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Yükleniyor...</p>
            ) : ticketParts.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>Henüz parça eklenmedi</p>
            ) : (
                <>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.75rem' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                {['SKU', 'Parça', 'Grup', 'Adet', 'Birim Fiyat', 'Toplam', ''].map(h => (
                                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {ticketParts.map(tp => (
                                <tr key={tp.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', fontFamily: 'monospace', color: '#6b7280' }}>{tp.part.sku}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>{tp.part.name}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>
                                        {tp.part.group ? (
                                            <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: '500' }}>
                                                {tp.part.group}
                                            </span>
                                        ) : (
                                            <span style={{ color: '#9ca3af' }}>—</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                        <input
                                            type="number" min="1" style={editInp}
                                            defaultValue={tp.quantity}
                                            onBlur={e => updateTicketPart(tp.id, 'quantity', e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                        />
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                        <input
                                            type="number" step="0.01" min="0" style={editInp}
                                            defaultValue={Number(tp.unitPrice).toFixed(2)}
                                            onBlur={e => updateTicketPart(tp.id, 'unitPrice', e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                        />
                                    </td>
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
