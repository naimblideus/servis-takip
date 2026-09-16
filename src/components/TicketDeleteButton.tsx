'use client';

import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

interface Props {
    ticketId: string;
    ticketNumber: string;
}

export default function TicketDeleteButton({ ticketId, ticketNumber }: Props) {
    const router = useRouter();
    const t = useT();

    const handleDelete = async () => {
        if (!confirm(doldur(t.fisDetay.silSor, { n: ticketNumber }))) return;
        const res = await fetch(`/api/tickets/${ticketId}`, { method: 'DELETE' });
        if (res.ok) {
            router.push('/tickets');
        } else {
            const d = await res.json();
            alert(doldur(t.fisler.hata, { n: d.error }));
        }
    };

    return (
        <button
            onClick={handleDelete}
            title={t.fisler.tablo.cope}
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
            {t.fisDetay.sil}
        </button>
    );
}
