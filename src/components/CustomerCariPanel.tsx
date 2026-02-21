'use client';

import { useState, useEffect } from 'react';

interface Transaction {
    id: string;
    type: 'INCOME' | 'EXPENSE';
    category: string;
    amount: number;
    method: string;
    description: string;
    date: string;
    ticket?: { ticketNumber: string } | null;
}

interface CariData {
    customer: { id: string; name: string; phone: string };
    transactions: Transaction[];
    balance: { totalIncome: number; totalExpense: number; unpaidTotal: number; net: number };
    unpaidTickets: { id: string; ticketNumber: string; totalCost: number; paymentStatus: string; createdAt: string }[];
}

const CATEGORY_LABELS: Record<string, string> = {
    SERVICE_FEE: '🔧 Servis', COUNTER_FEE: '📊 Sayaç', RENTAL_FEE: '🏢 Kira',
    PART_PURCHASE: '📦 Parça', PART_SALE: '🏷️ Parça Satış', GENERAL_EXPENSE: '💸 Gider',
    OTHER_INCOME: '💚 Diğer', OTHER_EXPENSE: '💔 Diğer',
};

export default function CustomerCariPanel({ customerId }: { customerId: string }) {
    const [data, setData] = useState<CariData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/accounting/customer/${customerId}`).then(r => r.json()).then(d => {
            setData(d);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [customerId]);

    if (loading) return <div style={{ padding: '1rem', color: '#9ca3af', fontSize: '0.875rem' }}>Cari yükleniyor...</div>;
    if (!data) return null;

    const { balance, transactions, unpaidTickets } = data;

    return (
        <div style={{ marginTop: '1rem' }}>
            {/* Bakiye Özeti */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.25rem', marginBottom: '1rem' }}>
                <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>Cari Hesap</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                    <div style={{ backgroundColor: '#ecfdf5', borderRadius: '0.5rem', padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: '#065f46' }}>Toplam Gelir</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}>₺{balance.totalIncome.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div style={{ backgroundColor: '#fef2f2', borderRadius: '0.5rem', padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: '#991b1b' }}>Ödenmemiş</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ef4444' }}>₺{balance.unpaidTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div style={{ backgroundColor: balance.net >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: '0.5rem', padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: '#374151' }}>Net Bakiye</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: balance.net >= 0 ? '#10b981' : '#ef4444' }}>₺{balance.net.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                    </div>
                </div>
            </div>

            {/* Ödenmemiş Fişler */}
            {unpaidTickets.length > 0 && (
                <div style={{ backgroundColor: '#fffbeb', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem', border: '1px solid #fde68a' }}>
                    <h3 style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#92400e' }}>⚠️ Ödenmemiş Fişler ({unpaidTickets.length})</h3>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {unpaidTickets.map(t => (
                            <a key={t.id} href={`/tickets/${t.id}`} style={{
                                padding: '0.375rem 0.75rem', backgroundColor: 'white', border: '1px solid #fde68a',
                                borderRadius: '0.5rem', fontSize: '0.8rem', textDecoration: 'none', color: '#92400e',
                            }}>
                                {t.ticketNumber} — ₺{Number(t.totalCost).toFixed(2)}
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* İşlem Geçmişi */}
            {transactions.length > 0 && (
                <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    <h3 style={{ fontWeight: '600', fontSize: '0.9rem', padding: '1rem 1rem 0.5rem' }}>İşlem Geçmişi</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                {['Tarih', 'Kategori', 'Açıklama', 'Tutar'].map(h => (
                                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.slice(0, 10).map(t => {
                                const isIncome = t.type === 'INCOME';
                                return (
                                    <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6', borderLeft: `3px solid ${isIncome ? '#10b981' : '#ef4444'}` }}>
                                        <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#374151' }}>
                                            {new Date(t.date).toLocaleDateString('tr-TR')}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>
                                            {CATEGORY_LABELS[t.category] || t.category}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>{t.description}</td>
                                        <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.9rem', fontWeight: '700', color: isIncome ? '#10b981' : '#ef4444' }}>
                                            {isIncome ? '+' : '-'}₺{Number(t.amount).toFixed(2)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {transactions.length > 10 && (
                        <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', color: '#6b7280' }}>
                            +{transactions.length - 10} işlem daha — <a href="/accounting" style={{ color: '#2563eb' }}>Tümünü Gör</a>
                        </div>
                    )}
                </div>
            )}

            {transactions.length === 0 && (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#9ca3af', fontSize: '0.875rem' }}>
                    Henüz işlem kaydı yok
                </div>
            )}
        </div>
    );
}
