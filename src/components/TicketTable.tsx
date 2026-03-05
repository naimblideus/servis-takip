'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

const statusLabel: Record<string, { label: string; color: string }> = {
    NEW: { label: 'Yeni', color: '#fef3c7' },
    IN_SERVICE: { label: 'Serviste', color: '#dbeafe' },
    WAITING_FOR_PART: { label: 'Parça Bkl.', color: '#fce7f3' },
    READY: { label: 'Hazır', color: '#d1fae5' },
    DELIVERED: { label: 'Teslim', color: '#f0fdf4' },
    CANCELLED: { label: 'İptal', color: '#f3f4f6' },
};

const priorityLabel: Record<string, { label: string; color: string }> = {
    LOW: { label: 'Düşük', color: '#6b7280' },
    NORMAL: { label: 'Normal', color: '#3b82f6' },
    HIGH: { label: 'Yüksek', color: '#f59e0b' },
    URGENT: { label: 'Acil', color: '#ef4444' },
};

interface Ticket {
    id: string;
    ticketNumber: string;
    issueText: string | null;
    status: string;
    priority: string;
    createdAt: Date;
    device: { brand: string; model: string; customer: { name: string } };
    assignedUser: { name: string } | null;
}

export default function TicketTable({ tickets }: { tickets: Ticket[] }) {
    const router = useRouter();

    return (
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                        {['Fiş No', 'Müşteri / Cihaz', 'Arıza', 'Durum', 'Öncelik', 'Teknisyen', 'Tarih', ''].map(h => (
                            <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {tickets.map((t, i) => {
                        const st = statusLabel[t.status] ?? { label: t.status, color: '#f3f4f6' };
                        const pr = priorityLabel[t.priority] ?? { label: t.priority, color: '#6b7280' };
                        return (
                            <tr
                                key={t.id}
                                onClick={() => router.push(`/tickets/${t.id}`)}
                                style={{
                                    borderBottom: '1px solid #e5e7eb',
                                    backgroundColor: i % 2 === 0 ? 'white' : '#f9fafb',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.1s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#eff6ff')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? 'white' : '#f9fafb')}
                            >
                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: '600' }}>
                                    <span style={{ color: '#2563eb' }}>{t.ticketNumber}</span>
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                    <div style={{ fontSize: '0.875rem', fontWeight: '500' }}>{t.device.customer.name}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{t.device.brand} {t.device.model}</div>
                                </td>
                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.issueText}</td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                    <span style={{ backgroundColor: st.color, padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600' }}>{st.label}</span>
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                    <span style={{ color: pr.color, fontSize: '0.8rem', fontWeight: '600' }}>{pr.label}</span>
                                </td>
                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#6b7280' }}>{t.assignedUser?.name ?? '—'}</td>
                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#6b7280' }}>{new Date(t.createdAt).toLocaleDateString('tr-TR')}</td>
                                <td style={{ padding: '0.75rem 1rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
                                        <Link href={`/tickets/${t.id}/print`} style={{ color: '#6b7280', fontSize: '0.85rem', textDecoration: 'none' }} target="_blank">🖨️</Link>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    {tickets.length === 0 && (
                        <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                            Fiş bulunamadı
                        </td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
