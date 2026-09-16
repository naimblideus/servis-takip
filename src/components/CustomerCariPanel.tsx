'use client';

import { useState, useEffect } from 'react';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

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

export default function CustomerCariPanel({ customerId }: { customerId: string }) {
    // `sz`: aşağıdaki liste döngüleri `t` adını işlem için kullanıyor.
    const sz = useT();
    const b = useBicim();
    const turAdi = (k: string) => (sz.cariPanel.tur as Record<string, string>)[k] ?? k;
    const [data, setData] = useState<CariData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/accounting/customer/${customerId}`).then(r => r.json()).then(d => {
            setData(d);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [customerId]);

    if (loading) return <div style={{ padding: '1rem', color: '#9ca3af', fontSize: '0.875rem' }}>{sz.cariPanel.yukleniyor}</div>;
    if (!data) return null;

    const { balance, transactions, unpaidTickets } = data;

    return (
        <div style={{ marginTop: '1rem' }}>
            {/* Bakiye Özeti */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.25rem', marginBottom: '1rem' }}>
                <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>{sz.belge.ekstre.etiket}</h2>
                {/* auto-fit: sabit üç sütunda 375 px'te para rakamları kutuya
                    sığmıyordu (ölçüldü: "Net Bakiye ₺21.150,93" 127 px'lik
                    kutuda, sayfa 53 px yana kayıyordu). Telefonda alt alta,
                    masaüstünde yine üç kart yan yana. */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(8.5rem,1fr))', gap: '0.75rem' }}>
                    <div style={{ backgroundColor: '#ecfdf5', borderRadius: '0.5rem', padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: '#065f46' }}>{sz.belge.ekstre.toplamBorc}</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#10b981' }}>{b.para(balance.totalIncome)}</div>
                    </div>
                    <div style={{ backgroundColor: '#fef2f2', borderRadius: '0.5rem', padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: '#991b1b' }}>{sz.cariPanel.odenmemis}</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#ef4444' }}>{b.para(balance.unpaidTotal)}</div>
                    </div>
                    <div style={{ backgroundColor: balance.net >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: '0.5rem', padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: '#374151' }}>{sz.belge.ekstre.bakiye}</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: balance.net >= 0 ? '#10b981' : '#ef4444' }}>{b.para(balance.net)}</div>
                    </div>
                </div>
            </div>

            {/* Ödenmemiş Fişler */}
            {unpaidTickets.length > 0 && (
                <div style={{ backgroundColor: '#fffbeb', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem', border: '1px solid #fde68a' }}>
                    <h3 style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#92400e' }}>{doldur(sz.cariPanel.odenmemisFisler, { n: unpaidTickets.length })}</h3>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {unpaidTickets.map(t => (
                            <a key={t.id} href={`/tickets/${t.id}`} style={{
                                padding: '0.375rem 0.75rem', backgroundColor: 'white', border: '1px solid #fde68a',
                                borderRadius: '0.5rem', fontSize: '0.8rem', textDecoration: 'none', color: '#92400e',
                            }}>
                                {t.ticketNumber} — {b.para(Number(t.totalCost))}
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* İşlem Geçmişi */}
            {transactions.length > 0 && (
                <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
                    <h3 style={{ fontWeight: '600', fontSize: '0.9rem', padding: '1rem 1rem 0.5rem' }}>{sz.cariPanel.islemGecmisi}</h3>
                    <table style={{ width: '100%', minWidth: '44rem', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                {[sz.genel.tarih, sz.cariPanel.kategori, sz.muhasebe.sutunAciklama, sz.genel.tutar].map(h => (
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
                                            {b.tarih(t.date)}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>
                                            {turAdi(t.category)}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>{t.description}</td>
                                        <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.9rem', fontWeight: '700', color: isIncome ? '#10b981' : '#ef4444' }}>
                                            {isIncome ? '+' : '-'}{b.para(Number(t.amount))}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {transactions.length > 10 && (
                        <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', color: '#6b7280' }}>
                            {doldur(sz.cariPanel.dahaFazlaIslem, { n: transactions.length - 10 })} <a href="/accounting" style={{ color: '#2563eb' }}>{sz.cariPanel.tumunuGor}</a>
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
