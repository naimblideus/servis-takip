'use client';

export default function TopluPrintButton({ count }: { count: number }) {
    return (
        <div className="no-print" style={{
            padding: '0.75rem 2rem', backgroundColor: '#1f2937',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem'
        }}>
            <span style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem' }}>
                🖨️ İcmal Önizleme <span style={{ opacity: .7, fontWeight: 500 }}>· {count} fiş</span>
            </span>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                    onClick={() => window.history.back()}
                    style={{ background: 'transparent', color: '#93c5fd', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                >← Geri</button>
                <button
                    onClick={() => window.print()}
                    style={{
                        backgroundColor: '#3b82f6', color: 'white', padding: '0.5rem 1.25rem',
                        border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem'
                    }}
                >Yazdır</button>
            </div>
        </div>
    );
}
