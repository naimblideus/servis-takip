'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

interface Payment {
    id: string;
    amount: number;
    method: string;
    note: string | null;
    createdAt: string;
}

const METHODS = ['CASH', 'CARD', 'TRANSFER', 'OTHER'];

export default function TicketPaymentPanel({
    ticketId,
    totalCost: initialTotalCost,
    paymentStatus,
}: {
    ticketId: string;
    totalCost: number;
    paymentStatus: string;
}) {
    const router = useRouter();
    const t = useT();
    const b = useBicim();
    const yontem = (kod: string) => (t.odemePanel.yontem as Record<string, string>)[kod] ?? kod;
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('CASH');
    const [note, setNote] = useState('');
    const [totalCost, setTotalCost] = useState(initialTotalCost);

    const load = async () => {
        const [payRes, ticketRes] = await Promise.all([
            fetch(`/api/tickets/${ticketId}/payments`),
            fetch(`/api/tickets/${ticketId}`),
        ]);
        if (payRes.ok) setPayments(await payRes.json());
        if (ticketRes.ok) {
            const t = await ticketRes.json();
            if (t.totalCost !== undefined) setTotalCost(Number(t.totalCost));
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
    const remaining = totalCost - totalPaid;

    const addPayment = async () => {
        if (!amount || parseFloat(amount) <= 0) return;
        setSaving(true);
        const res = await fetch(`/api/tickets/${ticketId}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: parseFloat(amount), method, note }),
        });
        if (res.ok) {
            setAmount('');
            setNote('');
            await load();
            router.refresh();
        } else {
            const d = await res.json();
            alert(doldur(t.fisler.hata, { n: d.error }));
        }
        setSaving(false);
    };

    const statusColor = paymentStatus === 'PAID' ? '#d1fae5' : paymentStatus === 'PARTIAL' ? '#fef3c7' : '#fee2e2';
    const statusText = paymentStatus === 'PAID' ? '#065f46' : paymentStatus === 'PARTIAL' ? '#92400e' : '#b91c1c';
    const statusLabel = paymentStatus === 'PAID' ? t.odemePanel.odendi : paymentStatus === 'PARTIAL' ? t.odemePanel.kismi : t.odemePanel.odenmedi;

    const inp = { padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem' };

    return (
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginTop: '1rem' }}>
            {/* Başlık + Özet */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontWeight: '600' }}>{t.odemePanel.baslik}</h2>
                <span style={{ backgroundColor: statusColor, color: statusText, padding: '0.25rem 0.875rem', borderRadius: '9999px', fontSize: '0.875rem', fontWeight: '700' }}>
                    {statusLabel}
                </span>
            </div>

            {/* Tutar Özeti */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {[
                    { label: t.genel.toplam, value: b.para(totalCost), color: '#374151' },
                    { label: t.odemePanel.odenen, value: b.para(totalPaid), color: '#059669' },
                    { label: t.odemePanel.kalan, value: b.para(Math.max(0, remaining)), color: remaining > 0 ? '#ef4444' : '#059669' },
                ].map(c => (
                    <div key={c.label} style={{ backgroundColor: '#f9fafb', borderRadius: '0.5rem', padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>{c.label}</div>
                        <div style={{ fontWeight: '700', fontSize: '1.125rem', color: c.color }}>{c.value}</div>
                    </div>
                ))}
            </div>

            {/* Ödeme Ekle */}
            {paymentStatus !== 'PAID' && (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '0.5rem', border: '1px solid #bbf7d0' }}>
                    <input
                        type="number" step="0.01" placeholder={doldur(t.odemePanel.tutarYer, { n: b.para(Math.max(0, remaining)) })}
                        style={{ ...inp, flex: '1', minWidth: '140px' }}
                        value={amount} onChange={e => setAmount(e.target.value)}
                    />
                    <select style={inp} value={method} onChange={e => setMethod(e.target.value)}>
                        {METHODS.map(v => (
                            <option key={v} value={v}>{yontem(v)}</option>
                        ))}
                    </select>
                    <input
                        placeholder={t.odemePanel.notYer} style={{ ...inp, flex: '1', minWidth: '120px' }}
                        value={note} onChange={e => setNote(e.target.value)}
                    />
                    <button onClick={addPayment} disabled={!amount || saving} style={{
                        padding: '0.5rem 1.25rem', backgroundColor: '#10b981', color: 'white',
                        border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600',
                        opacity: (!amount || saving) ? 0.6 : 1, fontSize: '0.875rem',
                    }}>
                        {saving ? '...' : t.odemePanel.kaydet}
                    </button>
                </div>
            )}

            {/* Ödeme Geçmişi */}
            {loading ? (
                <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>{t.genel.yukleniyor}</p>
            ) : payments.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '0.875rem', textAlign: 'center', padding: '0.75rem' }}>{t.odemePanel.odemeYok}</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {payments.map(p => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.875rem' }}>{yontem(p.method)}</span>
                                {p.note && <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{p.note}</span>}
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                    {b.tarihSaat(p.createdAt)}
                                </span>
                                <span style={{ fontWeight: '700', color: '#059669', fontSize: '0.95rem' }}>{b.para(Number(p.amount))}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
