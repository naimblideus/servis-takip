'use client';

import { useState, useEffect, useMemo } from 'react';

interface Transaction {
    id: string;
    type: 'INCOME' | 'EXPENSE';
    category: string;
    amount: number;
    method: string;
    description: string;
    date: string;
    customer?: { name: string } | null;
    ticket?: { ticketNumber: string } | null;
}

interface Stats {
    monthly: { income: number; expense: number; profit: number };
    categoryStats: { category: string; total: number; count: number }[];
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
    SERVICE_FEE: { label: 'Servis Ücreti', icon: '🔧' },
    COUNTER_FEE: { label: 'Sayaç Ücreti', icon: '📊' },
    RENTAL_FEE: { label: 'Kira Bedeli', icon: '🏢' },
    PART_PURCHASE: { label: 'Parça Alımı', icon: '📦' },
    PART_SALE: { label: 'Parça Satışı', icon: '🏷️' },
    GENERAL_EXPENSE: { label: 'Genel Gider', icon: '💸' },
    SALARY: { label: 'Maaş', icon: '👤' },
    RENT: { label: 'İşyeri Kirası', icon: '🏠' },
    UTILITY: { label: 'Fatura', icon: '⚡' },
    OTHER_INCOME: { label: 'Diğer Gelir', icon: '💚' },
    OTHER_EXPENSE: { label: 'Diğer Gider', icon: '💔' },
};

const METHOD_LABELS: Record<string, string> = {
    CASH: '💵 Nakit', CARD: '💳 Kart', TRANSFER: '🏦 Havale', OTHER: '📋 Diğer',
};

const INCOME_CATEGORIES = ['SERVICE_FEE', 'COUNTER_FEE', 'RENTAL_FEE', 'PART_SALE', 'OTHER_INCOME'];
const EXPENSE_CATEGORIES = ['PART_PURCHASE', 'GENERAL_EXPENSE', 'SALARY', 'RENT', 'UTILITY', 'OTHER_EXPENSE'];

export default function AccountingPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [filter, setFilter] = useState<'all' | 'INCOME' | 'EXPENSE'>('all');
    const [search, setSearch] = useState('');
    const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);

    const [form, setForm] = useState({
        type: 'INCOME' as 'INCOME' | 'EXPENSE',
        category: 'SERVICE_FEE',
        amount: '',
        method: 'CASH',
        description: '',
        customerId: '',
        date: new Date().toISOString().split('T')[0],
    });

    const load = async () => {
        const res = await fetch('/api/accounting');
        if (res.ok) {
            const data = await res.json();
            setTransactions(data.transactions);
            setStats({ monthly: data.monthly, categoryStats: data.categoryStats });
        }
        setLoading(false);
    };

    useEffect(() => {
        load();
        fetch('/api/customers').then(r => r.json()).then(data => {
            if (Array.isArray(data)) setCustomers(data.map((c: any) => ({ id: c.id, name: c.name })));
        });
    }, []);

    const filtered = useMemo(() => {
        let list = [...transactions];
        if (filter !== 'all') list = list.filter(t => t.type === filter);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(t =>
                t.description.toLowerCase().includes(q) ||
                t.customer?.name?.toLowerCase().includes(q) ||
                t.ticket?.ticketNumber?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [transactions, filter, search]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const res = await fetch('/api/accounting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        if (res.ok) {
            setForm({ type: 'INCOME', category: 'SERVICE_FEE', amount: '', method: 'CASH', description: '', customerId: '', date: new Date().toISOString().split('T')[0] });
            setShowForm(false);
            load();
        } else {
            const d = await res.json();
            alert('Hata: ' + d.error);
        }
        setSaving(false);
    };

    const inp: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none' };
    const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' };

    if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Yükleniyor...</div>;

    return (
        <div style={{ padding: '2rem' }}>
            {/* Başlık */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Muhasebe</h1>
                    <p style={{ color: '#6b7280' }}>Gelir, gider ve kasa hareketleri</p>
                </div>
                <button onClick={() => setShowForm(!showForm)} style={{
                    backgroundColor: '#3b82f6', color: 'white', padding: '0.625rem 1.25rem',
                    borderRadius: '0.5rem', border: 'none', fontWeight: '500', cursor: 'pointer', fontSize: '0.875rem',
                }}>
                    {showForm ? '✕ İptal' : '+ Yeni İşlem'}
                </button>
            </div>

            {/* Aylık Özet Kartlar */}
            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                    {[
                        { label: 'Bu Ay Gelir', value: stats.monthly.income, color: '#10b981', icon: '📈', bg: '#ecfdf5' },
                        { label: 'Bu Ay Gider', value: stats.monthly.expense, color: '#ef4444', icon: '📉', bg: '#fef2f2' },
                        { label: 'Net Kâr/Zarar', value: stats.monthly.profit, color: stats.monthly.profit >= 0 ? '#10b981' : '#ef4444', icon: stats.monthly.profit >= 0 ? '💰' : '⚠️', bg: stats.monthly.profit >= 0 ? '#f0fdf4' : '#fef2f2' },
                        { label: 'İşlem Sayısı', value: transactions.length, color: '#6b7280', icon: '📋', bg: '#f9fafb', isCount: true },
                    ].map(c => (
                        <div key={c.label} style={{ backgroundColor: c.bg, borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '1.25rem' }}>{c.icon}</span>
                                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{c.label}</span>
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: c.color }}>
                                {(c as any).isCount ? c.value : `₺${Number(c.value).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Kategori Dağılımı */}
            {stats && stats.categoryStats.length > 0 && (
                <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.25rem', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontWeight: '600', marginBottom: '0.75rem', fontSize: '0.9rem' }}>Bu Ay Kategori Dağılımı</h3>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {stats.categoryStats.map(c => {
                            const cat = CATEGORY_LABELS[c.category] || { label: c.category, icon: '📌' };
                            const isIncome = INCOME_CATEGORIES.includes(c.category);
                            return (
                                <div key={c.category} style={{
                                    padding: '0.5rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.8rem',
                                    backgroundColor: isIncome ? '#ecfdf5' : '#fef2f2',
                                    color: isIncome ? '#065f46' : '#991b1b',
                                    border: `1px solid ${isIncome ? '#a7f3d0' : '#fecaca'}`,
                                }}>
                                    {cat.icon} {cat.label}: <b>₺{c.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</b> ({c.count})
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Yeni İşlem Formu */}
            {showForm && (
                <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Yeni İşlem Ekle</h2>
                    <form onSubmit={handleSubmit}>
                        {/* Gelir/Gider Toggle */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                            {(['INCOME', 'EXPENSE'] as const).map(t => (
                                <button key={t} type="button" onClick={() => {
                                    setForm({ ...form, type: t, category: t === 'INCOME' ? 'SERVICE_FEE' : 'GENERAL_EXPENSE' });
                                }} style={{
                                    flex: 1, padding: '0.75rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer',
                                    fontWeight: '600', fontSize: '0.9rem',
                                    backgroundColor: form.type === t ? (t === 'INCOME' ? '#10b981' : '#ef4444') : '#f3f4f6',
                                    color: form.type === t ? 'white' : '#374151',
                                }}>
                                    {t === 'INCOME' ? '📈 Gelir' : '📉 Gider'}
                                </button>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                            <div>
                                <label style={lbl}>Kategori *</label>
                                <select style={inp} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                                    {(form.type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => (
                                        <option key={c} value={c}>{CATEGORY_LABELS[c]?.icon} {CATEGORY_LABELS[c]?.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={lbl}>Tutar (₺) *</label>
                                <input required type="number" step="0.01" min="0" style={inp} value={form.amount}
                                    onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
                            </div>
                            <div>
                                <label style={lbl}>Ödeme Yöntemi</label>
                                <select style={inp} value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}>
                                    {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div>
                                <label style={lbl}>Açıklama *</label>
                                <input required style={inp} value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })} placeholder="İşlem açıklaması" />
                            </div>
                            <div>
                                <label style={lbl}>Müşteri</label>
                                <select style={inp} value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })}>
                                    <option value="">— Seçiniz —</option>
                                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={lbl}>Tarih</label>
                                <input type="date" style={inp} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                            </div>
                        </div>

                        <button type="submit" disabled={saving} style={{
                            backgroundColor: form.type === 'INCOME' ? '#10b981' : '#ef4444', color: 'white',
                            padding: '0.625rem 1.5rem', borderRadius: '0.5rem', border: 'none',
                            fontWeight: '600', cursor: 'pointer', opacity: saving ? 0.7 : 1,
                        }}>
                            {saving ? 'Kaydediliyor...' : (form.type === 'INCOME' ? '📈 Gelir Ekle' : '📉 Gider Ekle')}
                        </button>
                    </form>
                </div>
            )}

            {/* Arama + Filtre */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>🔍</span>
                    <input placeholder="Açıklama, müşteri veya fiş no ile ara..." value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ ...inp, paddingLeft: '2.25rem', backgroundColor: '#f9fafb' }} />
                </div>
                <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: '#f3f4f6', borderRadius: '0.5rem', padding: '0.25rem' }}>
                    {[
                        { key: 'all' as const, label: 'Tümü' },
                        { key: 'INCOME' as const, label: '📈 Gelir' },
                        { key: 'EXPENSE' as const, label: '📉 Gider' },
                    ].map(f => (
                        <button key={f.key} onClick={() => setFilter(f.key)} style={{
                            padding: '0.375rem 0.75rem', borderRadius: '0.375rem', border: 'none', cursor: 'pointer',
                            fontSize: '0.8rem', fontWeight: filter === f.key ? '600' : '400',
                            backgroundColor: filter === f.key ? 'white' : 'transparent',
                            color: filter === f.key ? '#374151' : '#6b7280',
                            boxShadow: filter === f.key ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                        }}>{f.label}</button>
                    ))}
                </div>
            </div>

            {/* İşlem Listesi */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                            {['Tarih', 'Tür', 'Kategori', 'Açıklama', 'Müşteri', 'Yöntem', 'Tutar'].map(h => (
                                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((t, i) => {
                            const cat = CATEGORY_LABELS[t.category] || { label: t.category, icon: '📌' };
                            const isIncome = t.type === 'INCOME';
                            return (
                                <tr key={t.id} style={{
                                    borderBottom: '1px solid #e5e7eb',
                                    backgroundColor: i % 2 === 0 ? 'white' : '#fafafa',
                                    borderLeft: `3px solid ${isIncome ? '#10b981' : '#ef4444'}`,
                                }}>
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#374151' }}>
                                        {new Date(t.date).toLocaleDateString('tr-TR')}
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <span style={{
                                            backgroundColor: isIncome ? '#d1fae5' : '#fee2e2',
                                            color: isIncome ? '#065f46' : '#991b1b',
                                            padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: '600',
                                        }}>
                                            {isIncome ? 'GELİR' : 'GİDER'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem' }}>
                                        {cat.icon} {cat.label}
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                                        {t.description}
                                        {t.ticket && <span style={{ fontSize: '0.7rem', color: '#2563eb', marginLeft: '0.5rem' }}>[{t.ticket.ticketNumber}]</span>}
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#6b7280' }}>
                                        {t.customer?.name || '—'}
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem' }}>
                                        {METHOD_LABELS[t.method] || t.method}
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '1rem', fontWeight: '700', color: isIncome ? '#10b981' : '#ef4444' }}>
                                        {isIncome ? '+' : '-'}₺{Number(t.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            );
                        })}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                                    {search ? `"${search}" ile eşleşen işlem bulunamadı` : 'Henüz işlem yok — + Yeni İşlem ile ekleyin'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
