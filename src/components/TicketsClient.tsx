'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TicketTable from '@/components/TicketTable';
import Link from 'next/link';

interface Ticket {
    id: string;
    ticketNumber: string;
    issueText: string | null;
    status: string;
    priority: string;
    createdAt: string;
    device: {
        brand: string; model: string; isRental: boolean;
        counterBlack?: number | null; counterColor?: number | null;
        customer: { name: string }
    };
    assignedUser: { name: string } | null;
}

export default function TicketsClient({ initialTickets, total, open, ready }: {
    initialTickets: Ticket[];
    total: number;
    open: number;
    ready: number;
}) {
    const router = useRouter();
    const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
    const [msg, setMsg] = useState('');

    const handleDelete = async (id: string, num: string) => {
        if (!confirm(`"${num}" çöp kutusuna taşınsın mı?`)) return;
        const res = await fetch(`/api/tickets/${id}`, { method: 'DELETE' });
        if (res.ok) {
            setTickets(prev => prev.filter(t => t.id !== id));
            setMsg(`✅ ${num} çöp kutusuna taşındı`);
            setTimeout(() => setMsg(''), 3000);
        } else {
            const d = await res.json();
            alert('Hata: ' + d.error);
        }
    };

    return (
        <>
            {msg && (
                <div style={{
                    padding: '0.75rem 1rem', backgroundColor: '#d1fae5', borderRadius: '0.5rem',
                    marginBottom: '1rem', fontSize: '0.875rem', color: '#065f46',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    {msg}
                    <Link href="/tickets/trash" style={{ color: '#059669', fontWeight: '600', textDecoration: 'none', fontSize: '0.8rem' }}>🗑️ Çöp Kutusuna Git</Link>
                </div>
            )}
            <TicketTable tickets={tickets as any} onDelete={handleDelete} />
        </>
    );
}
