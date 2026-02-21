'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STATUS_FLOW = [
    { value: 'NEW', label: 'Yeni', color: '#f59e0b' },
    { value: 'IN_SERVICE', label: 'Serviste', color: '#3b82f6' },
    { value: 'WAITING_FOR_PART', label: 'Parça Bkl.', color: '#ec4899' },
    { value: 'READY', label: 'Hazır', color: '#10b981' },
    { value: 'DELIVERED', label: 'Teslim', color: '#6366f1' },
    { value: 'CANCELLED', label: 'İptal', color: '#6b7280' },
];

const PAYMENT_OPTIONS = [
    { value: 'UNPAID', label: 'Ödenmedi' },
    { value: 'PARTIAL', label: 'Kısmi Ödeme' },
    { value: 'PAID', label: 'Ödendi' },
];

interface Props {
    ticketId: string;
    currentStatus: string;
    currentAssignedUserId: string;
    currentPriority: string;
    currentPaymentStatus: string;
    currentTotalCost: number;
    users: { id: string; name: string }[];
}

export default function TicketStatusPanel({
    ticketId,
    currentStatus,
    currentAssignedUserId,
    currentPriority,
    currentPaymentStatus,
    currentTotalCost,
    users,
}: Props) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [showPanel, setShowPanel] = useState(false);
    const [assignedUserId, setAssignedUserId] = useState(currentAssignedUserId);
    const [paymentStatus, setPaymentStatus] = useState(currentPaymentStatus);
    const [totalCost, setTotalCost] = useState(currentTotalCost.toFixed(2));

    const updateStatus = async (newStatus: string) => {
        setLoading(true);
        await fetch(`/api/tickets/${ticketId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        });
        router.refresh();
        setLoading(false);
    };

    const savePanel = async () => {
        setLoading(true);
        await fetch(`/api/tickets/${ticketId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignedUserId, paymentStatus, totalCost }),
        });
        router.refresh();
        setShowPanel(false);
        setLoading(false);
    };

    const inp = {
        padding: '0.5rem 0.75rem', border: '1px solid #d1d5db',
        borderRadius: '0.5rem', fontSize: '0.875rem', width: '100%',
        boxSizing: 'border-box' as const,
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-end' }}>
            {/* Status Butonları */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'flex-end' }}>
                {STATUS_FLOW.map(s => (
                    <button
                        key={s.value}
                        onClick={() => updateStatus(s.value)}
                        disabled={loading || s.value === currentStatus}
                        style={{
                            padding: '0.4rem 0.875rem',
                            borderRadius: '0.5rem',
                            border: s.value === currentStatus ? `2px solid ${s.color}` : '2px solid transparent',
                            backgroundColor: s.value === currentStatus ? s.color : '#f3f4f6',
                            color: s.value === currentStatus ? 'white' : '#374151',
                            fontWeight: s.value === currentStatus ? '700' : '500',
                            fontSize: '0.8rem',
                            cursor: s.value === currentStatus ? 'default' : 'pointer',
                            opacity: loading ? 0.6 : 1,
                            transition: 'all 0.15s',
                        }}
                    >
                        {s.value === currentStatus ? `✓ ${s.label}` : s.label}
                    </button>
                ))}
            </div>

            {/* Düzenle Butonu */}
            <button
                onClick={() => setShowPanel(!showPanel)}
                style={{
                    padding: '0.4rem 1rem', backgroundColor: 'white',
                    border: '1px solid #d1d5db', borderRadius: '0.5rem',
                    fontSize: '0.8rem', cursor: 'pointer', color: '#374151', fontWeight: '500',
                }}
            >
                {showPanel ? '✕ Kapat' : '✏️ Düzenle'}
            </button>

            {/* Düzenleme Paneli */}
            {showPanel && (
                <div style={{
                    backgroundColor: 'white', borderRadius: '0.75rem',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '1.25rem',
                    minWidth: '280px', border: '1px solid #e5e7eb',
                }}>
                    <h3 style={{ fontWeight: '600', marginBottom: '1rem', fontSize: '0.9rem' }}>Hızlı Düzenle</h3>

                    <div style={{ marginBottom: '0.875rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: '500', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Teknisyen</label>
                        <select style={inp} value={assignedUserId} onChange={e => setAssignedUserId(e.target.value)}>
                            <option value="">Atanmadı</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginBottom: '0.875rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: '500', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Ödeme Durumu</label>
                        <select style={inp} value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}>
                            {PAYMENT_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: '500', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>Toplam Tutar (₺)</label>
                        <input
                            type="number" step="0.01" style={inp}
                            value={totalCost}
                            onChange={e => setTotalCost(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={savePanel}
                        disabled={loading}
                        style={{
                            width: '100%', padding: '0.625rem',
                            backgroundColor: '#3b82f6', color: 'white',
                            border: 'none', borderRadius: '0.5rem',
                            fontWeight: '600', cursor: 'pointer', fontSize: '0.875rem',
                            opacity: loading ? 0.7 : 1,
                        }}
                    >
                        {loading ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                </div>
            )}
        </div>
    );
}
