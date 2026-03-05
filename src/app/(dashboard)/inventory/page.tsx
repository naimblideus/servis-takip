'use client';

import { useState, useEffect, useMemo } from 'react';

interface Part {
    id: string;
    sku: string;
    name: string;
    buyPrice: number;
    sellPrice: number;
    stockQty: number;
    minStock: number;
    group: string | null;
}

const PART_GROUPS = ['Fırın Grubu', 'Paten', 'İşçilik', 'Dişli Grubu', 'Yedek Parça', 'Toner', 'Tamirat'];

type SortField = 'name' | 'sku' | 'stockQty' | 'sellPrice' | 'buyPrice' | 'group';
type StockFilter = 'all' | 'critical' | 'ok';

export default function InventoryPage() {
    const [parts, setParts] = useState<Part[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [stockFilter, setStockFilter] = useState<StockFilter>('all');
    const [sortField, setSortField] = useState<SortField>('stockQty');
    const [sortAsc, setSortAsc] = useState(true);
    const [form, setForm] = useState({
        sku: '', name: '', buyPrice: '', sellPrice: '', stockQty: '', minStock: '5', group: '',
    });
    // Satır düzenlemesi
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editRow, setEditRow] = useState({ name: '', buyPrice: '', sellPrice: '', stockQty: '', minStock: '', group: '' });
    // Sadece stok sayısını inline düzenle
    const [editStockId, setEditStockId] = useState<string | null>(null);
    const [editStockVal, setEditStockVal] = useState('');

    const load = () => {
        fetch('/api/inventory').then(r => r.json()).then(data => {
            setParts(data);
            setLoading(false);
        });
    };

    useEffect(() => { load(); }, []);

    // Arama + filtre + sıralama (kritik stoklar her zaman üstte)
    const filtered = useMemo(() => {
        let list = [...parts];

        // Metin araması (SKU, ad)
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.sku.toLowerCase().includes(q)
            );
        }

        // Durum filtresi
        if (stockFilter === 'critical') list = list.filter(p => p.stockQty <= p.minStock);
        if (stockFilter === 'ok') list = list.filter(p => p.stockQty > p.minStock);

        // Sıralama: kritik stoklar HER ZAMAN önce, sonrasına özel sıralama
        list.sort((a, b) => {
            const aCritical = a.stockQty <= a.minStock ? 0 : 1;
            const bCritical = b.stockQty <= b.minStock ? 0 : 1;
            if (aCritical !== bCritical) return aCritical - bCritical;

            // İkincil sıralama
            let cmp = 0;
            if (sortField === 'name') cmp = a.name.localeCompare(b.name, 'tr');
            else if (sortField === 'sku') cmp = a.sku.localeCompare(b.sku, 'tr');
            else if (sortField === 'stockQty') cmp = a.stockQty - b.stockQty;
            else if (sortField === 'sellPrice') cmp = Number(a.sellPrice) - Number(b.sellPrice);
            else if (sortField === 'buyPrice') cmp = Number(a.buyPrice) - Number(b.buyPrice);
            else if (sortField === 'group') cmp = (a.group || '').localeCompare(b.group || '', 'tr');
            return sortAsc ? cmp : -cmp;
        });

        return list;
    }, [parts, search, stockFilter, sortField, sortAsc]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const res = await fetch('/api/inventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        if (res.ok) {
            setForm({ sku: '', name: '', buyPrice: '', sellPrice: '', stockQty: '', minStock: '5', group: '' });
            setShowForm(false);
            load();
        } else {
            const d = await res.json();
            alert('Hata: ' + d.error);
        }
        setSaving(false);
    };

    const adjustStock = async (id: string, delta: number) => {
        await fetch(`/api/inventory/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adjustQty: delta }),
        });
        load();
    };

    // Stok sayısını doğrudan set et
    const setStockDirect = async (id: string, value: string) => {
        const qty = parseInt(value);
        if (isNaN(qty) || qty < 0) { setEditStockId(null); return; }
        await fetch(`/api/inventory/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stockQty: qty }),
        });
        setEditStockId(null);
        load();
    };

    // Tüm satırı güncelle
    const updatePart = async (id: string) => {
        await fetch(`/api/inventory/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: editRow.name,
                buyPrice: editRow.buyPrice,
                sellPrice: editRow.sellPrice,
                stockQty: editRow.stockQty,
                minStock: editRow.minStock,
            }),
        });
        setEditingId(null);
        load();
    };

    const deletePart = async (id: string, name: string) => {
        if (!confirm(`"${name}" silinsin mi? Bu işlem geri alınamaz.`)) return;
        const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const d = await res.json();
            if (d.error?.includes('Foreign key') || d.error?.includes('constraint')) {
                alert(`"${name}" silinemedi: Bu parça bir veya daha fazla servis fişine bağlı. Önce fişlerdeki kullanımını kaldırın.`);
            } else {
                alert('Silme hatası: ' + d.error);
            }
            return;
        }
        load();
    };

    const toggleSort = (field: SortField) => {
        if (sortField === field) setSortAsc(!sortAsc);
        else { setSortField(field); setSortAsc(true); }
    };

    const inp: React.CSSProperties = {
        width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db',
        borderRadius: '0.5rem', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none',
    };
    const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' };

    const lowStock = parts.filter(p => p.stockQty <= p.minStock);
    const totalValue = parts.reduce((s, p) => s + p.stockQty * Number(p.buyPrice), 0);

    if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Yükleniyor...</div>;

    const SortIcon = ({ field }: { field: SortField }) => (
        <span style={{ marginLeft: '0.25rem', opacity: sortField === field ? 1 : 0.3, fontSize: '0.7rem' }}>
            {sortField === field ? (sortAsc ? '▲' : '▼') : '⇅'}
        </span>
    );

    return (
        <div style={{ padding: '2rem' }}>
            {/* Başlık */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Stok Yönetimi</h1>
                    <p style={{ color: '#6b7280' }}>Toplam {parts.length} kalem • {filtered.length} gösteriliyor</p>
                </div>
                <button onClick={() => setShowForm(!showForm)} style={{
                    backgroundColor: '#3b82f6', color: 'white', padding: '0.625rem 1.25rem',
                    borderRadius: '0.5rem', border: 'none', fontWeight: '500', cursor: 'pointer', fontSize: '0.875rem',
                }}>
                    {showForm ? '✕ İptal' : '+ Yeni Parça'}
                </button>
            </div>

            {/* Özet Kartlar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                    { label: 'Toplam Kalem', value: parts.length, color: '#6b7280', icon: '📦', onClick: () => setStockFilter('all') },
                    { label: 'Kritik Stok', value: lowStock.length, color: lowStock.length > 0 ? '#ef4444' : '#10b981', icon: '⚠️', onClick: () => setStockFilter('critical') },
                    { label: 'Stok Değeri', value: `₺${totalValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`, color: '#10b981', icon: '💰', onClick: () => setStockFilter('all') },
                ].map(c => (
                    <div key={c.label} onClick={c.onClick} style={{
                        backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer',
                        border: (c.label === 'Kritik Stok' && stockFilter === 'critical') ? '2px solid #ef4444' : '2px solid transparent',
                        transition: 'border-color 0.2s',
                    }}>
                        <div style={{ fontSize: '2rem' }}>{c.icon}</div>
                        <div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: c.color }}>{c.value}</div>
                            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{c.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Arama + Filtre Çubuğu */}
            <div style={{
                backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                padding: '1rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap',
            }}>
                {/* Arama */}
                <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
                    <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>🔍</span>
                    <input
                        type="text"
                        placeholder="SKU veya parça adı ile ara..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            ...inp,
                            paddingLeft: '2.25rem',
                            backgroundColor: '#f9fafb',
                        }}
                    />
                    {search && (
                        <button onClick={() => setSearch('')} style={{
                            position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1rem',
                        }}>✕</button>
                    )}
                </div>

                {/* Durum Filtresi */}
                <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: '#f3f4f6', borderRadius: '0.5rem', padding: '0.25rem' }}>
                    {([
                        { key: 'all' as StockFilter, label: 'Tümü' },
                        { key: 'critical' as StockFilter, label: `⚠ Kritik (${lowStock.length})` },
                        { key: 'ok' as StockFilter, label: '✓ Yeterli' },
                    ]).map(f => (
                        <button key={f.key} onClick={() => setStockFilter(f.key)} style={{
                            padding: '0.375rem 0.75rem', borderRadius: '0.375rem', border: 'none', cursor: 'pointer',
                            fontSize: '0.8rem', fontWeight: stockFilter === f.key ? '600' : '400',
                            backgroundColor: stockFilter === f.key ? 'white' : 'transparent',
                            color: stockFilter === f.key ? (f.key === 'critical' ? '#ef4444' : '#374151') : '#6b7280',
                            boxShadow: stockFilter === f.key ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                        }}>
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Sonuç sayısı */}
                {search && (
                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                        {filtered.length} sonuç
                    </span>
                )}
            </div>

            {/* Yeni Parça Formu */}
            {showForm && (
                <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1rem' }}>
                    <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Yeni Parça Ekle</h2>
                    <form onSubmit={handleSubmit}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div>
                                <label style={lbl}>SKU / Kod</label>
                                <input style={inp} value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="Otomatik" />
                                <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Boş bırakırsanız otomatik üretilir</span>
                            </div>
                            <div>
                                <label style={lbl}>Parça Adı *</label>
                                <input required style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Canon 2525 Toner" />
                            </div>
                            <div>
                                <label style={lbl}>Ürün Grubu</label>
                                <select style={inp} value={form.group} onChange={e => setForm({ ...form, group: e.target.value })}>
                                    <option value="">Grup seçin...</option>
                                    {PART_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                            <div>
                                <label style={lbl}>Alış Fiyatı (₺)</label>
                                <input type="number" step="0.01" style={inp} value={form.buyPrice} onChange={e => setForm({ ...form, buyPrice: e.target.value })} placeholder="0" />
                            </div>
                            <div>
                                <label style={lbl}>Satış Fiyatı (₺)</label>
                                <input type="number" step="0.01" style={inp} value={form.sellPrice} onChange={e => setForm({ ...form, sellPrice: e.target.value })} placeholder="0" />
                            </div>
                            <div>
                                <label style={lbl}>Stok Miktarı</label>
                                <input type="number" style={inp} value={form.stockQty} onChange={e => setForm({ ...form, stockQty: e.target.value })} placeholder="0" />
                            </div>
                            <div>
                                <label style={lbl}>Min. Stok</label>
                                <input type="number" style={inp} value={form.minStock} onChange={e => setForm({ ...form, minStock: e.target.value })} placeholder="5" />
                            </div>
                        </div>
                        <button type="submit" disabled={saving} style={{
                            backgroundColor: '#3b82f6', color: 'white', padding: '0.625rem 1.5rem',
                            borderRadius: '0.5rem', border: 'none', fontWeight: '600', cursor: 'pointer',
                            opacity: saving ? 0.7 : 1,
                        }}>
                            {saving ? 'Kaydediliyor...' : 'Parça Ekle'}
                        </button>
                    </form>
                </div>
            )}

            {/* Tablo */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                            <th onClick={() => toggleSort('sku')} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
                                SKU <SortIcon field="sku" />
                            </th>
                            <th onClick={() => toggleSort('name')} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
                                Parça Adı <SortIcon field="name" />
                            </th>
                            <th onClick={() => toggleSort('buyPrice')} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
                                Alış <SortIcon field="buyPrice" />
                            </th>
                            <th onClick={() => toggleSort('sellPrice')} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
                                Satış <SortIcon field="sellPrice" />
                            </th>
                            <th onClick={() => toggleSort('stockQty')} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
                                Stok <SortIcon field="stockQty" />
                            </th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>Durum</th>
                            <th onClick={() => toggleSort('group')} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
                                Grup <SortIcon field="group" />
                            </th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>İşlem</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((p, i) => {
                            const isLow = p.stockQty <= p.minStock;
                            const isZero = p.stockQty === 0;
                            const isEditing = editingId === p.id;

                            if (isEditing) {
                                // ─── D\u00fczen modu ───
                                return (
                                    <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#fffbeb' }}>
                                        <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', fontFamily: 'monospace', color: '#6b7280' }}>{p.sku}</td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>
                                            <input
                                                style={{ ...inp, width: '100%', padding: '0.35rem 0.5rem' }}
                                                value={editRow.name}
                                                onChange={e => setEditRow({ ...editRow, name: e.target.value })}
                                            />
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>
                                            <input type="number" step="0.01"
                                                style={{ ...inp, width: '80px', padding: '0.35rem 0.5rem' }}
                                                value={editRow.buyPrice}
                                                onChange={e => setEditRow({ ...editRow, buyPrice: e.target.value })}
                                            />
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>
                                            <input type="number" step="0.01"
                                                style={{ ...inp, width: '80px', padding: '0.35rem 0.5rem' }}
                                                value={editRow.sellPrice}
                                                onChange={e => setEditRow({ ...editRow, sellPrice: e.target.value })}
                                            />
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>
                                            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                                <input type="number" min="0"
                                                    style={{ ...inp, width: '70px', padding: '0.35rem 0.5rem', fontWeight: '700' }}
                                                    value={editRow.stockQty}
                                                    onChange={e => setEditRow({ ...editRow, stockQty: e.target.value })}
                                                />
                                                <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>/ min:</span>
                                                <input type="number" min="0"
                                                    style={{ ...inp, width: '55px', padding: '0.35rem 0.5rem' }}
                                                    value={editRow.minStock}
                                                    onChange={e => setEditRow({ ...editRow, minStock: e.target.value })}
                                                />
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>—</td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>
                                            <select style={{ ...inp, padding: '0.35rem 0.5rem' }}
                                                value={editRow.group}
                                                onChange={e => setEditRow({ ...editRow, group: e.target.value })}>
                                                <option value="">—</option>
                                                {PART_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                                            </select>
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>
                                            <div style={{ display: 'flex', gap: '0.375rem' }}>
                                                <button onClick={() => updatePart(p.id)} style={{
                                                    padding: '0.3rem 0.75rem', backgroundColor: '#059669', color: 'white',
                                                    border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600',
                                                }}>✓ Kaydet</button>
                                                <button onClick={() => setEditingId(null)} style={{
                                                    padding: '0.3rem 0.5rem', backgroundColor: 'white', color: '#374151',
                                                    border: '1px solid #d1d5db', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem',
                                                }}>İptal</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }

                            // ─── Normal g\u00f6r\u00fcn\u00fcm ───
                            return (
                                <tr key={p.id} style={{
                                    borderBottom: '1px solid #e5e7eb',
                                    backgroundColor: isZero ? '#fef2f2' : isLow ? '#fffbeb' : (i % 2 === 0 ? 'white' : '#fafafa'),
                                    borderLeft: isLow ? '3px solid' : 'none',
                                    borderLeftColor: isZero ? '#ef4444' : isLow ? '#f59e0b' : 'transparent',
                                }}>
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: '600', color: '#6b7280' }}>{p.sku}</td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <div style={{ fontSize: '0.875rem', fontWeight: '500' }}>
                                            {search ? highlightMatch(p.name, search) : p.name}
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>₺{Number(p.buyPrice).toFixed(2)}</td>
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: '600', color: '#059669' }}>₺{Number(p.sellPrice).toFixed(2)}</td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        {/* Stoka t\u0131klay\u0131nca inline input a\u00e7\u0131l\u0131r */}
                                        {editStockId === p.id ? (
                                            <input
                                                type="number" min="0" autoFocus
                                                style={{ ...inp, width: '75px', padding: '0.35rem 0.5rem', fontWeight: '700', fontSize: '1rem' }}
                                                value={editStockVal}
                                                onChange={e => setEditStockVal(e.target.value)}
                                                onBlur={() => setStockDirect(p.id, editStockVal)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') setStockDirect(p.id, editStockVal);
                                                    if (e.key === 'Escape') setEditStockId(null);
                                                }}
                                            />
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span
                                                    title="T\u0131klay\u0131p d\u00fczenleyin"
                                                    onClick={() => { setEditStockId(p.id); setEditStockVal(String(p.stockQty)); setEditingId(null); }}
                                                    style={{
                                                        fontSize: '1rem', fontWeight: 'bold', color: isLow ? '#ef4444' : '#111827',
                                                        cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: '3px',
                                                    }}
                                                >{p.stockQty}</span>
                                                <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>/ {p.minStock}</span>
                                            </div>
                                        )}
                                        {/* Stok \u00e7ubu\u011fu */}
                                        <div style={{ width: '60px', height: '4px', backgroundColor: '#e5e7eb', borderRadius: '2px', marginTop: '0.25rem' }}>
                                            <div style={{
                                                width: `${Math.min(100, (p.stockQty / Math.max(p.minStock * 2, 1)) * 100)}%`,
                                                height: '100%', borderRadius: '2px',
                                                backgroundColor: isZero ? '#ef4444' : isLow ? '#f59e0b' : '#10b981',
                                            }} />
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <span style={{
                                            backgroundColor: isZero ? '#fee2e2' : isLow ? '#fef3c7' : '#d1fae5',
                                            color: isZero ? '#b91c1c' : isLow ? '#92400e' : '#065f46',
                                            padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600',
                                        }}>
                                            {isZero ? '🔴 Tükendi' : isLow ? '🟡 Kritik' : '🟢 Yeterli'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        {p.group ? (
                                            <span style={{
                                                backgroundColor: '#f3f4f6', color: '#374151',
                                                padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.7rem', fontWeight: '500',
                                            }}>{p.group}</span>
                                        ) : (
                                            <span style={{ fontSize: '0.75rem', color: '#d1d5db' }}>—</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                                            <button onClick={() => adjustStock(p.id, -1)} title="Azalt"
                                                style={{ width: '26px', height: '26px', borderRadius: '0.375rem', border: '1px solid #e5e7eb', backgroundColor: 'white', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                                            <button onClick={() => adjustStock(p.id, 1)} title="Artır"
                                                style={{ width: '26px', height: '26px', borderRadius: '0.375rem', border: '1px solid #e5e7eb', backgroundColor: '#f0fdf4', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                                            <button
                                                title="Düzenle"
                                                onClick={() => {
                                                    setEditingId(p.id);
                                                    setEditStockId(null);
                                                    setEditRow({
                                                        name: p.name,
                                                        buyPrice: String(p.buyPrice),
                                                        sellPrice: String(p.sellPrice),
                                                        stockQty: String(p.stockQty),
                                                        minStock: String(p.minStock),
                                                        group: p.group || '',
                                                    });
                                                }}
                                                style={{ width: '26px', height: '26px', borderRadius: '0.375rem', border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✏</button>
                                            <button onClick={() => deletePart(p.id, p.name)} title="Sil"
                                                style={{ width: '26px', height: '26px', borderRadius: '0.375rem', border: 'none', backgroundColor: '#fee2e2', color: '#b91c1c', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                                    {search ? `"${search}" ile eşleşen parça bulunamadı` : 'Henüz parça yok — + Yeni Parça ile ekleyin'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// Arama terimiyle eşleşen kısmı vurgula
function highlightMatch(text: string, query: string) {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
        <>
            {text.slice(0, idx)}
            <mark style={{ backgroundColor: '#fef08a', padding: '0 0.1rem', borderRadius: '2px' }}>
                {text.slice(idx, idx + query.length)}
            </mark>
            {text.slice(idx + query.length)}
        </>
    );
}
