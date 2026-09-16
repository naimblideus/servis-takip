'use client';

import { openPrintable } from '@/lib/print';
import { useT } from '@/lib/i18n/client';

interface TicketPrintButtonProps {
    ticketId: string;
}

export default function TicketPrintButton({ ticketId }: TicketPrintButtonProps) {
    const t = useT();
    const handlePrint = () => {
        openPrintable(`/tickets/${ticketId}/print`);
    };

    return (
        <button
            onClick={handlePrint}
            style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#1e40af',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
            }}
        >
            {t.fisDetay.yazdir}
        </button>
    );
}
