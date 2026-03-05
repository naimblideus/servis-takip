'use client';

import { useRouter } from 'next/navigation';

interface Props {
    ticketId: string;
    ticketNumber: string;
}

export default function TicketDeleteButton({ ticketId, ticketNumber }: Props) {
    const router = useRouter();

    const handleDelete = async () => {
        if (!confirm(`"${ticketNumber}" çöp kutusuna taşınsın mı?\nÇöp kutusundan geri alabilirsiniz.`)) return;
        const res = await fetch(`/api/tickets/${ticketId}`, { method: 'DELETE' });
        if (res.ok) {
            router.push('/tickets');
        } else {
            const d = await res.json();
            alert('Hata: ' + d.error);
        }
    };

    return (
        <button
            onClick={handleDelete}
            title="Çöp Kutusuna Taşı"
            style={{
                padding: '0.5rem 0.875rem',
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
            }}
        >
            🗑️ Sil
        </button>
    );
}
