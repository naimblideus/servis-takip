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

interface DebtorPayment {
    id: string;
    amount: number;
    method: string;
    paymentDate: string;
    notes: string | null;
}

interface DebtorTicket {
    id: string;
    ticketNumber: string;
    totalCost: number;
    paid: number;
    remaining: number;
    createdAt: string;
    daysOverdue: number;
    device: string;
    status: string;
    payments: DebtorPayment[];
}

interface Debtor {
    customer: { id: string; name: string; phone: string; address: string | null };
    totalDebt: number;
    totalCost: number;
    paidAmount: number;
    oldestOverdue: number;
    tickets: DebtorTicket[];
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
    SERVICE_FEE: { label: 'Servis Ücreti', icon: '🔧' },
    COUNTER_FEE: { label: 'Sayaç Ücreti', icon: '📊' },
    RENTAL_FEE: { label: 'Kira Bedeli', icon: '🏢' },
    PART_PURCHASE: { label: 'Parça Alımı', icon: '📦' },
    PART_SALE: { label: 'Parça Satışı', icon: '🏷️' },
    MACHINE_PURCHASE: { label: 'Makina Alımı', icon: '🖨️' },
    MACHINE_SALE: { label: 'Makina Satışı', icon: '💰' },
    GENERAL_EXPENSE: { label: 'Genel Gider', icon: '💸' },
    SALARY: { label: 'Maaş', icon: '👤' },
    RENT: { label: 'İşyeri Kirası', icon: '🏠' },
    UTILITY: { label: 'Fatura', icon: '⚡' },
    TAX: { label: 'Vergi', icon: '🏛️' },
    FOOD: { label: 'Yemek', icon: '🍽️' },
    INSURANCE: { label: 'Sigorta', icon: '🛡️' },
    FUEL: { label: 'Yakıt/Ulaşım', icon: '⛽' },
    MAINTENANCE: { label: 'Bakım/Tadilat', icon: '🔨' },
    OTHER_INCOME: { label: 'Diğer Gelir', icon: '💚' },
    OTHER_EXPENSE: { label: 'Diğer Gider', icon: '💔' },
};

const LOGO_HESAP_KODLARI: Record<string, { hesapKodu: string; hesapAdi: string }> = {
    SERVICE_FEE: { hesapKodu: '600.01', hesapAdi: 'Yurtiçi Satışlar - Servis Geliri' },
    COUNTER_FEE: { hesapKodu: '600.02', hesapAdi: 'Yurtiçi Satışlar - Sayaç Geliri' },
    RENTAL_FEE: { hesapKodu: '600.03', hesapAdi: 'Yurtiçi Satışlar - Kira Geliri' },
    PART_SALE: { hesapKodu: '600.04', hesapAdi: 'Yurtiçi Satışlar - Parça Satışı' },
    MACHINE_SALE: { hesapKodu: '600.05', hesapAdi: 'Yurtiçi Satışlar - Makina Satışı' },
    OTHER_INCOME: { hesapKodu: '649.01', hesapAdi: 'Diğer Olağan Gelir ve Kârlar' },
    PART_PURCHASE: { hesapKodu: '153.01', hesapAdi: 'Ticari Mallar - Parça Alımı' },
    MACHINE_PURCHASE: { hesapKodu: '153.02', hesapAdi: 'Ticari Mallar - Makina Alımı' },
    GENERAL_EXPENSE: { hesapKodu: '770.01', hesapAdi: 'Genel Yönetim Giderleri' },
    SALARY: { hesapKodu: '770.02', hesapAdi: 'Personel Giderleri - Maaş' },
    RENT: { hesapKodu: '770.03', hesapAdi: 'Kira Giderleri' },
    UTILITY: { hesapKodu: '770.04', hesapAdi: 'Enerji Giderleri' },
    TAX: { hesapKodu: '770.05', hesapAdi: 'Vergi, Resim ve Harçlar' },
    FOOD: { hesapKodu: '770.06', hesapAdi: 'Yemek Giderleri' },
    INSURANCE: { hesapKodu: '770.07', hesapAdi: 'Sigorta Giderleri' },
    FUEL: { hesapKodu: '770.08', hesapAdi: 'Ulaşım / Yakıt Giderleri' },
    MAINTENANCE: { hesapKodu: '770.09', hesapAdi: 'Bakım / Onarım Giderleri' },
    OTHER_EXPENSE: { hesapKodu: '689.01', hesapAdi: 'Diğer Olağan Gider ve Zararlar' },
};

const METHOD_LABELS: Record<string, string> = {
    CASH: '💵 Nakit', CARD: '💳 Kart', TRANSFER: '🏦 Havale', OTHER: '📋 Diğer',
};

const INCOME_CATEGORIES = ['SERVICE_FEE', 'COUNTER_FEE', 'RENTAL_FEE', 'PART_SALE', 'MACHINE_SALE', 'OTHER_INCOME'];
const EXPENSE_CATEGORIES = ['PART_PURCHASE', 'MACHINE_PURCHASE', 'GENERAL_EXPENSE', 'SALARY', 'RENT', 'UTILITY', 'TAX', 'FOOD', 'INSURANCE', 'FUEL', 'MAINTENANCE', 'OTHER_EXPENSE'];
const OWNER_EXPENSE_CATEGORIES = ['SALARY', 'RENT', 'UTILITY', 'TAX', 'FOOD', 'INSURANCE', 'FUEL', 'MAINTENANCE'];
const MACHINE_CATEGORIES = ['MACHINE_PURCHASE', 'MACHINE_SALE'];

type TabKey = 'dashboard' | 'transactions' | 'debtors' | 'machines' | 'expenses' | 'logo';

export default function AccountingPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [filter, setFilter] = useState<'all' | 'INCOME' | 'EXPENSE'>('all');
    const [search, setSearch] = useState('');
    const [customers, setCustomers] = useState<{ id: string; name: string; phone: string }[]>([]);
    const [activeTab, setActiveTab] = useState<TabKey>('dashboard');

    // Borçlular state
    const [debtors, setDebtors] = useState<Debtor[]>([]);
    const [debtorsSummary, setDebtorsSummary] = useState({ totalDebtors: 0, totalDebt: 0, totalTickets: 0, overdueDebt30: 0, overdueDebtors30: 0 });
    const [debtorsLoading, setDebtorsLoading] = useState(false);
    const [exportMonth, setExportMonth] = useState(new Date().toISOString().slice(0, 7));
    const [debtorSearch, setDebtorSearch] = useState('');
    const [debtorSort, setDebtorSort] = useState<'debt' | 'days' | 'name'>('debt');
    const [debtorMinDays, setDebtorMinDays] = useState(0);
    const [expandedDebtor, setExpandedDebtor] = useState<string | null>(null);
    const [payModal, setPayModal] = useState<{ ticketId: string; ticketNumber: string; remaining: number; amount: string; method: string; notes: string } | null>(null);
    const [paying, setPaying] = useState(false);
    const [historyModal, setHistoryModal] = useState<{ customerId: string; customerName: string; payments: any[]; total: number } | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

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

    const loadDebtors = async () => {
        setDebtorsLoading(true);
        const params = new URLSearchParams();
        if (debtorSearch.trim()) params.set('search', debtorSearch.trim());
        params.set('sort', debtorSort);
        if (debtorMinDays > 0) params.set('minDays', String(debtorMinDays));
        const res = await fetch(`/api/accounting/debtors?${params.toString()}`);
        if (res.ok) {
            const data = await res.json();
            setDebtors(data.debtors);
            setDebtorsSummary(data.summary);
        }
        setDebtorsLoading(false);
    };

    const handlePay = async () => {
        if (!payModal) return;
        setPaying(true);
        try {
            const res = await fetch('/api/accounting/debtors/pay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketId: payModal.ticketId,
                    amount: parseFloat(payModal.amount),
                    method: payModal.method,
                    notes: payModal.notes || null,
                }),
            });
            if (res.ok) {
                setPayModal(null);
                loadDebtors();
            } else {
                const d = await res.json();
                alert('Hata: ' + d.error);
            }
        } catch (e: any) {
            alert('Hata: ' + e.message);
        }
        setPaying(false);
    };

    const loadPaymentHistory = async (customerId: string, customerName: string) => {
        setHistoryLoading(true);
        setHistoryModal({ customerId, customerName, payments: [], total: 0 });
        const res = await fetch(`/api/accounting/debtors/payments?customerId=${customerId}`);
        if (res.ok) {
            const data = await res.json();
            setHistoryModal({ customerId, customerName, payments: data.payments, total: data.total });
        }
        setHistoryLoading(false);
    };

    const handleDeletePayment = async (paymentId: string) => {
        if (!confirm('Bu ödemeyi silmek istediğinize emin misiniz? Borç durumu geri güncellenecektir.')) return;
        setDeletingPaymentId(paymentId);
        try {
            const res = await fetch(`/api/accounting/debtors/payments?paymentId=${paymentId}`, { method: 'DELETE' });
            if (res.ok) {
                if (historyModal) loadPaymentHistory(historyModal.customerId, historyModal.customerName);
                loadDebtors();
            } else {
                const d = await res.json();
                alert('Hata: ' + d.error);
            }
        } catch (e: any) {
            alert('Hata: ' + e.message);
        }
        setDeletingPaymentId(null);
    };

    useEffect(() => {
        load();
        fetch('/api/customers').then(r => r.json()).then(data => {
            if (Array.isArray(data)) setCustomers(data.map((c: any) => ({ id: c.id, name: c.name, phone: c.phone || '' })));
        });
    }, []);

    useEffect(() => {
        if (activeTab === 'debtors') loadDebtors();
    }, [activeTab, debtorSort, debtorMinDays]);

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

    // Makina işlemleri
    const machineTransactions = useMemo(() =>
        transactions.filter(t => MACHINE_CATEGORIES.includes(t.category)),
        [transactions]
    );

    // İşyeri giderleri
    const ownerExpenses = useMemo(() =>
        transactions.filter(t => t.type === 'EXPENSE' && OWNER_EXPENSE_CATEGORIES.includes(t.category)),
        [transactions]
    );

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

    const sendWhatsAppDebt = (debtor: Debtor) => {
        let phone = debtor.customer.phone.replace(/[^0-9]/g, '');
        if (phone.startsWith('0')) phone = '90' + phone.substring(1);
        if (!phone.startsWith('90')) phone = '90' + phone;

        const ticketLines = debtor.tickets.map(t =>
            `• ${t.ticketNumber} - ${t.device}: ₺${t.remaining.toFixed(2)} (${t.daysOverdue} gün)`
        ).join('\n');

        const msg = `Sayın ${debtor.customer.name},\n\nAşağıdaki servis işlemlerinizin ödemesi beklemektedir:\n\n${ticketLines}\n\n*Toplam Borç: ₺${debtor.totalDebt.toFixed(2)}*\n\nÖdemenizi en kısa sürede yapmanızı rica ederiz.\n\nSaygılarımızla`;

        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    const inp: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none' };
    const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.25rem' };

    if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Yükleniyor...</div>;


    const TABS: { key: TabKey; label: string; icon: string }[] = [
        { key: 'dashboard', label: 'Genel Bakış', icon: '📊' },
        { key: 'transactions', label: 'İşlemler', icon: '📋' },
        { key: 'debtors', label: 'Borçlular', icon: '⚠️' },
        { key: 'machines', label: 'Makina Ticareti', icon: '🖨️' },
        { key: 'expenses', label: 'İşyeri Giderleri', icon: '🏠' },
        { key: 'logo', label: 'Logo Export', icon: '📤' },
    ];

    return (
        <div style={{ padding: '2rem' }}>
            {/* Başlık */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Muhasebe</h1>
                    <p style={{ color: '#6b7280' }}>Gelir, gider, borçlular, makina ticareti — Logo entegrasyonu</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button onClick={() => window.open(`/api/accounting/logo-export?format=csv&month=${exportMonth}`, '_blank')} style={{
                        backgroundColor: '#f0fdf4', color: '#16a34a', padding: '0.5rem 0.75rem',
                        borderRadius: '0.5rem', border: '1px solid #86efac', fontWeight: '500', cursor: 'pointer', fontSize: '0.8rem',
                    }}>
                        📤 CSV
                    </button>
                    <button onClick={() => window.open(`/api/accounting/logo-export?format=xml&month=${exportMonth}`, '_blank')} style={{
                        backgroundColor: '#eff6ff', color: '#2563eb', padding: '0.5rem 0.75rem',
                        borderRadius: '0.5rem', border: '1px solid #93c5fd', fontWeight: '500', cursor: 'pointer', fontSize: '0.8rem',
                    }}>
                        📤 XML
                    </button>
                    <button onClick={() => setShowForm(!showForm)} style={{
                        backgroundColor: '#3b82f6', color: 'white', padding: '0.625rem 1.25rem',
                        borderRadius: '0.5rem', border: 'none', fontWeight: '500', cursor: 'pointer', fontSize: '0.875rem',
                    }}>
                        {showForm ? '✕ İptal' : '+ Yeni İşlem'}
                    </button>
                </div>
            </div>

            {/* Sekme Navigasyonu */}
            <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', backgroundColor: '#f3f4f6', borderRadius: '0.5rem', padding: '0.25rem', overflowX: 'auto' }}>
                {TABS.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                        padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', cursor: 'pointer',
                        fontSize: '0.85rem', fontWeight: activeTab === tab.key ? '600' : '400',
                        backgroundColor: activeTab === tab.key ? 'white' : 'transparent',
                        color: activeTab === tab.key ? '#374151' : '#6b7280',
                        boxShadow: activeTab === tab.key ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                        whiteSpace: 'nowrap',
                    }}>
                        {tab.icon} {tab.label}
                        {tab.key === 'debtors' && debtorsSummary.totalDebtors > 0 && (
                            <span style={{ backgroundColor: '#ef4444', color: 'white', borderRadius: '9999px', padding: '0.1rem 0.4rem', fontSize: '0.65rem', marginLeft: '0.3rem', fontWeight: '700' }}>
                                {debtorsSummary.totalDebtors}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Yeni İşlem Formu (her sekmede görünür) */}
            {showForm && (
                <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Yeni İşlem Ekle</h2>
                    <form onSubmit={handleSubmit}>
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

            {/* ═══════════════ GENEL BAKIŞ ═══════════════ */}
            {activeTab === 'dashboard' && stats && (
                <>
                    {/* Aylık Özet Kartlar */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                        {[
                            { label: 'Bu Ay Gelir', value: stats.monthly.income, color: '#10b981', icon: '📈', bg: '#ecfdf5' },
                            { label: 'Bu Ay Gider', value: stats.monthly.expense, color: '#ef4444', icon: '📉', bg: '#fef2f2' },
                            { label: 'Net Kâr/Zarar', value: stats.monthly.profit, color: stats.monthly.profit >= 0 ? '#10b981' : '#ef4444', icon: stats.monthly.profit >= 0 ? '💰' : '⚠️', bg: stats.monthly.profit >= 0 ? '#f0fdf4' : '#fef2f2' },
                            { label: 'Toplam Borç', value: debtorsSummary.totalDebt, color: '#f59e0b', icon: '⚠️', bg: '#fffbeb' },
                        ].map(c => (
                            <div key={c.label} style={{ backgroundColor: c.bg, borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid rgba(0,0,0,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '1.25rem' }}>{c.icon}</span>
                                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{c.label}</span>
                                </div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: c.color }}>
                                    ₺{Number(c.value).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Kategori Dağılımı */}
                    {stats.categoryStats.length > 0 && (
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

                    {/* Makina Özeti */}
                    {machineTransactions.length > 0 && (
                        <div style={{ backgroundColor: '#f0f9ff', borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid #bae6fd', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#0369a1' }}>🖨️ Makina Ticareti Özeti</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Alım</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ef4444' }}>
                                        ₺{machineTransactions.filter(t => t.category === 'MACHINE_PURCHASE').reduce((s, t) => s + Number(t.amount), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Satış</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}>
                                        ₺{machineTransactions.filter(t => t.category === 'MACHINE_SALE').reduce((s, t) => s + Number(t.amount), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Kâr/Zarar</div>
                                    {(() => {
                                        const sale = machineTransactions.filter(t => t.category === 'MACHINE_SALE').reduce((s, t) => s + Number(t.amount), 0);
                                        const purchase = machineTransactions.filter(t => t.category === 'MACHINE_PURCHASE').reduce((s, t) => s + Number(t.amount), 0);
                                        const profit = sale - purchase;
                                        return <div style={{ fontSize: '1.25rem', fontWeight: '700', color: profit >= 0 ? '#10b981' : '#ef4444' }}>
                                            ₺{profit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                        </div>;
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ═══════════════ İŞLEMLER ═══════════════ */}
            {activeTab === 'transactions' && (
                <>
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
                </>
            )}

            {/* ═══════════════ BORÇLULAR ═══════════════ */}
            {activeTab === 'debtors' && (
                <>
                    {/* Özet Kartlar */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                        {[
                            { label: 'Toplam Borçlu', value: String(debtorsSummary.totalDebtors), color: '#ef4444', icon: '👥', bg: '#fef2f2', border: '#fecaca', isCurrency: false },
                            { label: 'Toplam Borç', value: debtorsSummary.totalDebt, color: '#f59e0b', icon: '💰', bg: '#fffbeb', border: '#fde68a', isCurrency: true },
                            { label: 'Ödenmemiş Fiş', value: String(debtorsSummary.totalTickets), color: '#0369a1', icon: '📋', bg: '#f0f9ff', border: '#bae6fd', isCurrency: false },
                            { label: '30+ Gün Gecikmiş', value: debtorsSummary.overdueDebt30, color: '#dc2626', icon: '🔴', bg: '#fef2f2', border: '#fca5a5', isCurrency: true },
                        ].map(c => (
                            <div key={c.label} style={{ backgroundColor: c.bg, borderRadius: '0.75rem', padding: '1.25rem', border: `1px solid ${c.border}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '1.25rem' }}>{c.icon}</span>
                                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{c.label}</span>
                                </div>
                                <div style={{ fontSize: '1.75rem', fontWeight: '700', color: c.color }}>
                                    {c.isCurrency ? `₺${Number(c.value).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : c.value}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Arama & Filtre Çubuğu */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                            <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>🔍</span>
                            <input placeholder="Müşteri adı, telefon veya fiş no ile ara..."
                                value={debtorSearch} onChange={e => setDebtorSearch(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') loadDebtors(); }}
                                style={{ ...inp, paddingLeft: '2.25rem', backgroundColor: '#f9fafb' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: '#f3f4f6', borderRadius: '0.5rem', padding: '0.25rem' }}>
                            {[{ v: 0, l: 'Tümü' }, { v: 30, l: '30+g' }, { v: 60, l: '60+g' }, { v: 90, l: '90+g' }].map(f => (
                                <button key={f.v} onClick={() => setDebtorMinDays(f.v)} style={{
                                    padding: '0.375rem 0.6rem', borderRadius: '0.375rem', border: 'none', cursor: 'pointer',
                                    fontSize: '0.8rem', fontWeight: debtorMinDays === f.v ? '600' : '400',
                                    backgroundColor: debtorMinDays === f.v ? 'white' : 'transparent',
                                    color: debtorMinDays === f.v ? '#374151' : '#6b7280',
                                    boxShadow: debtorMinDays === f.v ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                }}>{f.l}</button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: '#f3f4f6', borderRadius: '0.5rem', padding: '0.25rem' }}>
                            {([['debt', '💰 Borç'], ['days', '📅 Gün'], ['name', '🔤 Ad']] as const).map(([k, l]) => (
                                <button key={k} onClick={() => setDebtorSort(k as any)} style={{
                                    padding: '0.375rem 0.6rem', borderRadius: '0.375rem', border: 'none', cursor: 'pointer',
                                    fontSize: '0.8rem', fontWeight: debtorSort === k ? '600' : '400',
                                    backgroundColor: debtorSort === k ? 'white' : 'transparent',
                                    color: debtorSort === k ? '#374151' : '#6b7280',
                                    boxShadow: debtorSort === k ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                }}>{l}</button>
                            ))}
                        </div>
                        <button onClick={() => { debtors.forEach(d => sendWhatsAppDebt(d)); }} style={{
                            padding: '0.5rem 0.75rem', backgroundColor: '#25d366', color: 'white',
                            border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem',
                        }}>📱 Toplu WP Bildir</button>
                    </div>

                    {/* Borçlu Listesi */}
                    {debtorsLoading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Borçlular yükleniyor...</div>
                    ) : debtors.length === 0 ? (
                        <div style={{ backgroundColor: '#f0fdf4', borderRadius: '0.75rem', padding: '2rem', textAlign: 'center', color: '#065f46' }}>
                            ✅ {debtorMinDays > 0 ? `${debtorMinDays}+ gün gecikmiş` : ''} ödenmemiş borç bulunmuyor
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            {debtors.map(debtor => {
                                const isExpanded = expandedDebtor === debtor.customer.id;
                                return (
                                    <div key={debtor.customer.id} style={{
                                        backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                        borderLeft: `4px solid ${debtor.oldestOverdue >= 60 ? '#dc2626' : debtor.oldestOverdue >= 30 ? '#f59e0b' : '#3b82f6'}`,
                                        overflow: 'hidden',
                                    }}>
                                        {/* Header - Tıklanabilir */}
                                        <div onClick={() => setExpandedDebtor(isExpanded ? null : debtor.customer.id)} style={{
                                            padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            backgroundColor: isExpanded ? '#f9fafb' : 'white', transition: 'background 0.15s',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <span style={{ fontSize: '1.25rem', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                                                <div>
                                                    <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: 0 }}>{debtor.customer.name}</h3>
                                                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.15rem' }}>
                                                        📞 {debtor.customer.phone} • {debtor.tickets.length} fiş • En eski: {debtor.oldestOverdue}g
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                <div style={{ textAlign: 'right', marginRight: '0.5rem' }}>
                                                    <div style={{ fontSize: '1.35rem', fontWeight: '700', color: '#ef4444' }}>₺{debtor.totalDebt.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                                                    {debtor.paidAmount > 0 && <div style={{ fontSize: '0.65rem', color: '#10b981' }}>₺{debtor.paidAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ödenmiş</div>}
                                                </div>
                                                <button onClick={e => { e.stopPropagation(); loadPaymentHistory(debtor.customer.id, debtor.customer.name); }} style={{
                                                    padding: '0.4rem 0.6rem', backgroundColor: '#eff6ff', color: '#2563eb',
                                                    border: '1px solid #93c5fd', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600',
                                                }} title="Ödeme Geçmişi">📜 Geçmiş</button>
                                                <button onClick={e => { e.stopPropagation(); sendWhatsAppDebt(debtor); }} style={{
                                                    padding: '0.4rem 0.6rem', backgroundColor: '#25d366', color: 'white',
                                                    border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600',
                                                }} title="WhatsApp Bildir">📱 WP</button>
                                            </div>
                                        </div>

                                        {/* Accordion İçeriği — Fiş Listesi */}
                                        {isExpanded && (
                                            <div style={{ padding: '0 1.25rem 1rem', borderTop: '1px solid #e5e7eb' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                                                    <thead>
                                                        <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', color: '#6b7280', fontWeight: '500' }}>Fiş</th>
                                                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', color: '#6b7280', fontWeight: '500' }}>Cihaz</th>
                                                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: '#6b7280', fontWeight: '500' }}>Tutar</th>
                                                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: '#6b7280', fontWeight: '500' }}>Ödenen</th>
                                                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: '#6b7280', fontWeight: '500' }}>Kalan</th>
                                                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: '#6b7280', fontWeight: '500' }}>Gün</th>
                                                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center', color: '#6b7280', fontWeight: '500' }}>İşlem</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {debtor.tickets.map(t => (
                                                            <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                                <td style={{ padding: '0.5rem 0.5rem', fontFamily: 'monospace', color: '#2563eb', fontWeight: '500' }}>{t.ticketNumber}</td>
                                                                <td style={{ padding: '0.5rem 0.5rem' }}>{t.device}</td>
                                                                <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right' }}>₺{t.totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                                                <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', color: '#10b981' }}>₺{t.paid.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                                                <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', fontWeight: '600', color: '#ef4444' }}>₺{t.remaining.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                                                <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right' }}>
                                                                    <span style={{
                                                                        backgroundColor: t.daysOverdue >= 60 ? '#fef2f2' : t.daysOverdue >= 30 ? '#fffbeb' : '#eff6ff',
                                                                        color: t.daysOverdue >= 60 ? '#991b1b' : t.daysOverdue >= 30 ? '#92400e' : '#1e40af',
                                                                        padding: '0.15rem 0.45rem', borderRadius: '0.25rem', fontSize: '0.7rem', fontWeight: '600',
                                                                    }}>{t.daysOverdue}g</span>
                                                                </td>
                                                                <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center' }}>
                                                                    <button onClick={() => setPayModal({
                                                                        ticketId: t.id, ticketNumber: t.ticketNumber,
                                                                        remaining: t.remaining, amount: String(t.remaining),
                                                                        method: 'CASH', notes: '',
                                                                    })} style={{
                                                                        padding: '0.3rem 0.6rem', backgroundColor: '#10b981', color: 'white',
                                                                        border: 'none', borderRadius: '0.375rem', cursor: 'pointer',
                                                                        fontSize: '0.7rem', fontWeight: '600',
                                                                    }}>💵 Ödeme Al</button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ═══ ÖDEME MODAL ═══ */}
                    {payModal && (
                        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
                            onClick={() => setPayModal(null)}>
                            <div onClick={e => e.stopPropagation()} style={{
                                backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', width: '420px', maxWidth: '95vw',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 style={{ fontWeight: '700', fontSize: '1.1rem', margin: 0 }}>💵 Ödeme Al</h3>
                                    <button onClick={() => setPayModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
                                </div>
                                <div style={{ backgroundColor: '#f9fafb', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                                    <div>Fiş: <b style={{ color: '#2563eb', fontFamily: 'monospace' }}>{payModal.ticketNumber}</b></div>
                                    <div>Kalan Borç: <b style={{ color: '#ef4444' }}>₺{payModal.remaining.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</b></div>
                                </div>
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <label style={lbl}>Tutar (₺) *</label>
                                    <input type="number" step="0.01" min="0.01" max={payModal.remaining} value={payModal.amount}
                                        onChange={e => setPayModal({ ...payModal, amount: e.target.value })} style={inp} />
                                    {parseFloat(payModal.amount) < payModal.remaining && parseFloat(payModal.amount) > 0 && (
                                        <div style={{ fontSize: '0.7rem', color: '#f59e0b', marginTop: '0.25rem' }}>⚠️ Kısmi ödeme — kalan: ₺{(payModal.remaining - parseFloat(payModal.amount || '0')).toFixed(2)}</div>
                                    )}
                                </div>
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <label style={lbl}>Ödeme Yöntemi</label>
                                    <select value={payModal.method} onChange={e => setPayModal({ ...payModal, method: e.target.value })} style={inp}>
                                        {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={lbl}>Not (Opsiyonel)</label>
                                    <input value={payModal.notes} onChange={e => setPayModal({ ...payModal, notes: e.target.value })}
                                        placeholder="Ödeme notu..." style={inp} />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => setPayModal(null)} style={{
                                        flex: 1, padding: '0.625rem', backgroundColor: '#f3f4f6', color: '#374151',
                                        border: '1px solid #d1d5db', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '500',
                                    }}>İptal</button>
                                    <button onClick={handlePay} disabled={paying || !payModal.amount || parseFloat(payModal.amount) <= 0} style={{
                                        flex: 1, padding: '0.625rem', backgroundColor: '#10b981', color: 'white',
                                        border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600',
                                        opacity: paying ? 0.7 : 1,
                                    }}>{paying ? 'Kaydediliyor...' : '✓ Ödemeyi Kaydet'}</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═══ ÖDEME GEÇMİŞİ MODAL ═══ */}
                    {historyModal && (
                        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
                            onClick={() => setHistoryModal(null)}>
                            <div onClick={e => e.stopPropagation()} style={{
                                backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', width: '600px', maxWidth: '95vw', maxHeight: '80vh', overflowY: 'auto',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div>
                                        <h3 style={{ fontWeight: '700', fontSize: '1.1rem', margin: 0 }}>📜 Ödeme Geçmişi</h3>
                                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{historyModal.customerName}</div>
                                    </div>
                                    <button onClick={() => setHistoryModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
                                </div>
                                {historyLoading ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Yükleniyor...</div>
                                ) : historyModal.payments.length === 0 ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>Henüz ödeme kaydı yok</div>
                                ) : (
                                    <>
                                        <div style={{ backgroundColor: '#ecfdf5', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.85rem', color: '#065f46', fontWeight: '500' }}>Toplam Ödeme</span>
                                            <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}>₺{historyModal.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                                    <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600' }}>Tarih</th>
                                                    <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600' }}>Fiş</th>
                                                    <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600' }}>Yöntem</th>
                                                    <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '600' }}>Not</th>
                                                    <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>Tutar</th>
                                                    <th style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '600' }}>Sil</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {historyModal.payments.map((p: any) => (
                                                    <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                        <td style={{ padding: '0.5rem' }}>{new Date(p.paymentDate).toLocaleDateString('tr-TR')}</td>
                                                        <td style={{ padding: '0.5rem', fontFamily: 'monospace', color: '#2563eb' }}>{p.ticketNumber}</td>
                                                        <td style={{ padding: '0.5rem' }}>{METHOD_LABELS[p.method] || p.method}</td>
                                                        <td style={{ padding: '0.5rem', color: '#6b7280', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.notes || '—'}</td>
                                                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600', color: '#10b981' }}>₺{Number(p.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                            <button onClick={() => handleDeletePayment(p.id)} disabled={deletingPaymentId === p.id} style={{
                                                                padding: '0.2rem 0.5rem', backgroundColor: '#fef2f2', color: '#dc2626',
                                                                border: '1px solid #fca5a5', borderRadius: '0.25rem', cursor: 'pointer',
                                                                fontSize: '0.7rem', fontWeight: '500', opacity: deletingPaymentId === p.id ? 0.5 : 1,
                                                            }}>{deletingPaymentId === p.id ? '...' : '🗑️'}</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ═══════════════ MAKİNA TİCARETİ ═══════════════ */}
            {activeTab === 'machines' && (
                <>
                    {/* Makina Özet */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                        {(() => {
                            const purchases = machineTransactions.filter(t => t.category === 'MACHINE_PURCHASE');
                            const sales = machineTransactions.filter(t => t.category === 'MACHINE_SALE');
                            const totalPurchase = purchases.reduce((s, t) => s + Number(t.amount), 0);
                            const totalSale = sales.reduce((s, t) => s + Number(t.amount), 0);
                            const profit = totalSale - totalPurchase;
                            return [
                                { label: 'Toplam Alım', value: totalPurchase, color: '#ef4444', icon: '📦', bg: '#fef2f2', count: purchases.length },
                                { label: 'Toplam Satış', value: totalSale, color: '#10b981', icon: '💰', bg: '#ecfdf5', count: sales.length },
                                { label: 'Makina Kârı', value: profit, color: profit >= 0 ? '#10b981' : '#ef4444', icon: profit >= 0 ? '📈' : '📉', bg: profit >= 0 ? '#f0fdf4' : '#fef2f2', count: null },
                            ];
                        })().map(c => (
                            <div key={c.label} style={{ backgroundColor: c.bg, borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid rgba(0,0,0,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                    <span style={{ fontSize: '1.25rem' }}>{c.icon}</span>
                                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{c.label} {c.count !== null ? `(${c.count})` : ''}</span>
                                </div>
                                <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: c.color }}>
                                    ₺{c.value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Hızlı Ekleme */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                        <button onClick={() => { setForm({ ...form, type: 'EXPENSE', category: 'MACHINE_PURCHASE' }); setShowForm(true); }}
                            style={{ padding: '0.5rem 1rem', backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '500', fontSize: '0.85rem' }}>
                            🖨️ Makina Alımı Ekle
                        </button>
                        <button onClick={() => { setForm({ ...form, type: 'INCOME', category: 'MACHINE_SALE' }); setShowForm(true); }}
                            style={{ padding: '0.5rem 1rem', backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '500', fontSize: '0.85rem' }}>
                            💰 Makina Satışı Ekle
                        </button>
                    </div>

                    {/* Makina İşlem Listesi */}
                    <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                                    {['Tarih', 'İşlem', 'Açıklama', 'Müşteri', 'Yöntem', 'Tutar'].map(h => (
                                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {machineTransactions.length === 0 ? (
                                    <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>Henüz makina alım/satım kaydı yok</td></tr>
                                ) : machineTransactions.map((t, i) => (
                                    <tr key={t.id} style={{
                                        borderBottom: '1px solid #e5e7eb',
                                        backgroundColor: i % 2 === 0 ? 'white' : '#fafafa',
                                        borderLeft: `3px solid ${t.category === 'MACHINE_SALE' ? '#10b981' : '#ef4444'}`,
                                    }}>
                                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem' }}>{new Date(t.date).toLocaleDateString('tr-TR')}</td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <span style={{
                                                backgroundColor: t.category === 'MACHINE_SALE' ? '#d1fae5' : '#fee2e2',
                                                color: t.category === 'MACHINE_SALE' ? '#065f46' : '#991b1b',
                                                padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: '600',
                                            }}>
                                                {t.category === 'MACHINE_SALE' ? 'SATIŞ' : 'ALIM'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{t.description}</td>
                                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#6b7280' }}>{t.customer?.name || '—'}</td>
                                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem' }}>{METHOD_LABELS[t.method] || t.method}</td>
                                        <td style={{ padding: '0.75rem 1rem', fontSize: '1rem', fontWeight: '700', color: t.category === 'MACHINE_SALE' ? '#10b981' : '#ef4444' }}>
                                            {t.category === 'MACHINE_SALE' ? '+' : '-'}₺{Number(t.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* ═══════════════ İŞYERİ GİDERLERİ ═══════════════ */}
            {activeTab === 'expenses' && (
                <>
                    {/* Gider Özeti */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                        {OWNER_EXPENSE_CATEGORIES.map(cat => {
                            const c = CATEGORY_LABELS[cat];
                            const total = ownerExpenses.filter(t => t.category === cat).reduce((s, t) => s + Number(t.amount), 0);
                            const count = ownerExpenses.filter(t => t.category === cat).length;
                            return (
                                <div key={cat} style={{
                                    backgroundColor: 'white', borderRadius: '0.75rem', padding: '1rem',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.05)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                                        <span>{c.icon}</span>
                                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{c.label}</span>
                                    </div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: '700', color: total > 0 ? '#ef4444' : '#9ca3af' }}>
                                        ₺{total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{count} işlem</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Hızlı Ekleme */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        {OWNER_EXPENSE_CATEGORIES.map(cat => (
                            <button key={cat} onClick={() => { setForm({ ...form, type: 'EXPENSE', category: cat }); setShowForm(true); }}
                                style={{
                                    padding: '0.4rem 0.75rem', backgroundColor: '#f9fafb', color: '#374151',
                                    border: '1px solid #d1d5db', borderRadius: '0.5rem', cursor: 'pointer',
                                    fontSize: '0.8rem', fontWeight: '500',
                                }}>
                                {CATEGORY_LABELS[cat].icon} {CATEGORY_LABELS[cat].label} Ekle
                            </button>
                        ))}
                    </div>

                    {/* Toplam */}
                    <div style={{ backgroundColor: '#fef2f2', borderRadius: '0.75rem', padding: '1rem', border: '1px solid #fecaca', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '600', color: '#991b1b' }}>Bu Ay Toplam İşyeri Gideri</span>
                        <span style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ef4444' }}>
                            ₺{ownerExpenses.reduce((s, t) => s + Number(t.amount), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </span>
                    </div>

                    {/* Gider Listesi */}
                    <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                                    {['Tarih', 'Kategori', 'Açıklama', 'Yöntem', 'Tutar'].map(h => (
                                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {ownerExpenses.length === 0 ? (
                                    <tr><td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>Henüz işyeri gideri kaydı yok</td></tr>
                                ) : ownerExpenses.map((t, i) => {
                                    const cat = CATEGORY_LABELS[t.category] || { label: t.category, icon: '📌' };
                                    return (
                                        <tr key={t.id} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem' }}>{new Date(t.date).toLocaleDateString('tr-TR')}</td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem' }}>{cat.icon} {cat.label}</td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{t.description}</td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem' }}>{METHOD_LABELS[t.method] || t.method}</td>
                                            <td style={{ padding: '0.75rem 1rem', fontSize: '1rem', fontWeight: '700', color: '#ef4444' }}>
                                                -₺{Number(t.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* ═══════════════ LOGO EXPORT ═══════════════ */}
            {activeTab === 'logo' && (
                <>
                    {/* Logo Entegrasyon Bilgi */}
                    <div style={{ backgroundColor: '#eff6ff', borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid #93c5fd', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '1.5rem' }}>📤</span>
                            <h3 style={{ fontWeight: '700', color: '#1e40af', margin: 0 }}>Logo Muhasebe Entegrasyonu</h3>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#374151', marginBottom: '0.75rem' }}>
                            Tüm gelir/gider kayıtlarını Logo yazılımına aktarılabilir formatta (XML veya CSV) dışa aktarabilirsiniz.
                            Her kategori standart Tek Düzen Hesap Planı kodlarına eşlenmiştir.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div>
                                <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Dönem Seç</label>
                                <input type="month" value={exportMonth} onChange={e => setExportMonth(e.target.value)}
                                    style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.1rem' }}>
                                <button onClick={() => window.open(`/api/accounting/logo-export?format=csv&month=${exportMonth}`, '_blank')}
                                    style={{ padding: '0.625rem 1.25rem', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>
                                    📥 CSV İndir (Logo Import)
                                </button>
                                <button onClick={() => window.open(`/api/accounting/logo-export?format=xml&month=${exportMonth}`, '_blank')}
                                    style={{ padding: '0.625rem 1.25rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>
                                    📥 XML İndir (Logo Import)
                                </button>
                                <button onClick={() => window.open(`/api/accounting/logo-export?format=csv`, '_blank')}
                                    style={{ padding: '0.625rem 1.25rem', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '500', fontSize: '0.9rem' }}>
                                    Tüm Dönemler (CSV)
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Hesap Planı Eşleme Tablosu */}
                    <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1.5rem' }}>
                        <h3 style={{ fontWeight: '600', marginBottom: '1rem', fontSize: '1rem' }}>📋 Tek Düzen Hesap Planı Eşlemesi</h3>
                        <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>
                            Aşağıdaki tablo, her kategori için atanmış Logo hesap kodlarını göstermektedir. CSV/XML export bu kodları otomatik kullanır.
                        </p>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                                    <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Kategori</th>
                                    <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Hesap Kodu</th>
                                    <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Hesap Adı (Logo)</th>
                                    <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Tür</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(LOGO_HESAP_KODLARI).map(([cat, h]) => {
                                    const catLabel = CATEGORY_LABELS[cat] || { label: cat, icon: '📌' };
                                    const isIncome = INCOME_CATEGORIES.includes(cat);
                                    return (
                                        <tr key={cat} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '0.5rem 1rem' }}>{catLabel.icon} {catLabel.label}</td>
                                            <td style={{ padding: '0.5rem 1rem', fontFamily: 'monospace', fontWeight: '600', color: '#1e40af' }}>{h.hesapKodu}</td>
                                            <td style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', color: '#374151' }}>{h.hesapAdi}</td>
                                            <td style={{ padding: '0.5rem 1rem' }}>
                                                <span style={{
                                                    backgroundColor: isIncome ? '#d1fae5' : '#fee2e2',
                                                    color: isIncome ? '#065f46' : '#991b1b',
                                                    padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: '600',
                                                }}>{isIncome ? 'GELİR' : 'GİDER'}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Logo Kullanım Kılavuzu */}
                    <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
                        <h3 style={{ fontWeight: '600', marginBottom: '1rem', fontSize: '1rem' }}>📖 Logo'ya Aktarma Rehberi</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div>
                                <h4 style={{ fontWeight: '600', fontSize: '0.9rem', color: '#16a34a', marginBottom: '0.5rem' }}>CSV ile Aktarma</h4>
                                <ol style={{ fontSize: '0.8rem', color: '#374151', paddingLeft: '1.25rem', lineHeight: '1.8' }}>
                                    <li>Yukarıdan dönem seçin ve <b>CSV İndir</b>'e tıklayın</li>
                                    <li>Logo → Muhasebe → Veri Aktarımı → İçe Aktar</li>
                                    <li>CSV dosyasını seçin ve ayırıcıyı <b>; (noktalı virgül)</b> olarak belirleyin</li>
                                    <li>Sütun eşlemesini kontrol edin: Hesap Kodu, Borç, Alacak</li>
                                    <li>Aktarımı onaylayın</li>
                                </ol>
                            </div>
                            <div>
                                <h4 style={{ fontWeight: '600', fontSize: '0.9rem', color: '#2563eb', marginBottom: '0.5rem' }}>XML ile Aktarma</h4>
                                <ol style={{ fontSize: '0.8rem', color: '#374151', paddingLeft: '1.25rem', lineHeight: '1.8' }}>
                                    <li>Yukarıdan dönem seçin ve <b>XML İndir</b>'e tıklayın</li>
                                    <li>Logo → Dosya → Dışarıdan Veri Al → XML</li>
                                    <li>İndirdiğiniz XML dosyasını seçin</li>
                                    <li>Hesap planı eşlemesini doğrulayın</li>
                                    <li>Aktarımı başlatın</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
