'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface TrashedTicket {
    id: string;
    ticketNumber: string;
    issueText: string;
    status: string;
    deletedAt: string;
    device: { brand: string; model: string; customer: { name: string } };
}

export default function TrashPage() {
    const router = useRouter();
    const [tickets, setTickets] = useState<TrashedTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState(false);

    const load = async () => {
        setLoading(true);
        const res = await fetch('/api/tickets/trash');
        if (res.ok) setTickets(await res.json());
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const restore = async (id: string) => {
        setWorking(true);
        await fetch(`/api/tickets/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ restore: true }),
        });
        await load();
        router.refresh();
        setWorking(false);
    };

    const deletePermanent = async (id: string, num: string) => {
        if (!confirm(`"${num}" kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`)) return;
        setWorking(true);
        await fetch(`/api/tickets/${id}?permanent=true`, { method: 'DELETE' });
        await load();
        setWorking(false);
    };

    const emptyTrash = async () => {
        if (tickets.length === 0) return;
        if (!confirm(`Çöp kutusundaki ${tickets.length} fiş kalıcı olarak silinsin mi?`)) return;
        setWorking(true);
        await fetch('/api/tickets/trash', { method: 'DELETE' });
        await load();
        setWorking(false);
    };

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                        <Link href="/tickets" style={{ color: '#6b7280', fontSize: '0.875rem', textDecoration: 'none' }}>← Servis Fişleri</Link>
                    </div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>🗑️ Çöp Kutusu</h1>
                    <p style={{ color: '#6b7280' }}>Silinen fişler 30 gün içinde geri alınabilir</p>
                </div>
                {tickets.length > 0 && (
                    <button onClick={emptyTrash} disabled={working} style={{
                        padding: '0.625rem 1.25rem', backgroundColor: '#dc2626', color: 'white',
                        border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '500',
                        opacity: working ? 0.6 : 1,
                    }}>
                        🗑️ Çöpü Boşalt ({tickets.length})
                    </button>
                )}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>Yükleniyor...</div>
            ) : tickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>✅</div>
                    <p style={{ color: '#6b7280', fontSize: '1rem' }}>Çöp kutusu boş</p>
                </div>
            ) : (
                <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#fef2f2', borderBottom: '2px solid #fecaca' }}>
                                {['Fiş No', 'Müşteri / Cihaz', 'Arıza', 'Silinme Tarihi', 'İşlem'].map(h => (
                                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {tickets.map((t, i) => (
                                <tr key={t.id} style={{ borderBottom: '1px solid #fee2e2', backgroundColor: i % 2 === 0 ? 'white' : '#fff5f5' }}>
                                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: '600', color: '#dc2626', fontSize: '0.875rem' }}>{t.ticketNumber}</td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>{t.device.customer.name}</div>
                                        <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>{t.device.brand} {t.device.model}</div>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#374151', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.issueText}</td>
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#6b7280' }}>
                                        {new Date(t.deletedAt).toLocaleDateString('tr-TR')}
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button onClick={() => restore(t.id)} disabled={working} style={{
                                                padding: '0.35rem 0.75rem', backgroundColor: '#d1fae5', color: '#065f46',
                                                border: '1px solid #6ee7b7', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500',
                                            }}>↩ Geri Al</button>
                                            <button onClick={() => deletePermanent(t.id, t.ticketNumber)} disabled={working} style={{
                                                padding: '0.35rem 0.75rem', backgroundColor: '#fee2e2', color: '#b91c1c',
                                                border: '1px solid #fca5a5', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500',
                                            }}>✕ Sil</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
