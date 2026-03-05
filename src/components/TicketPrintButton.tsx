'use client';

interface TicketPrintButtonProps {
    ticketId: string;
}

export default function TicketPrintButton({ ticketId }: TicketPrintButtonProps) {
    const handlePrint = () => {
        window.open(`/tickets/${ticketId}/print`, '_blank');
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
            🖨️ Yazdır
        </button>
    );
}
