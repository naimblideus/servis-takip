'use client';

export default function PrintButton({ ticketId }: { ticketId: string }) {
    return (
        <div className="no-print" style={{ padding: '0.75rem 2rem', backgroundColor: '#1f2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'white', fontWeight: '600' }}>🖨️ Fiş Önizleme</span>
            <div style={{ display: 'flex', gap: '1rem' }}>
                <a href={`/tickets/${ticketId}`} style={{ color: '#93c5fd', textDecoration: 'none', fontSize: '0.875rem', lineHeight: '2.25rem' }}>← Fişe Dön</a>
                <button
                    onClick={() => window.print()}
                    style={{ backgroundColor: '#3b82f6', color: 'white', padding: '0.5rem 1.25rem', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem' }}
                >
                    Yazdır
                </button>
            </div>
        </div>
    );
}
