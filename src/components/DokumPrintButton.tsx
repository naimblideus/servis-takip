'use client';

import Link from 'next/link';

export default function DokumPrintButton({ customerId, blank, count }: { customerId: string; blank: boolean; count: number }) {
    return (
        <div className="no-print" style={{
            padding: '0.75rem 2rem', backgroundColor: '#1f2937',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem',
        }}>
            <span style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem' }}>
                🖨️ {blank ? 'Sayaç Föyü' : 'Cihaz Dökümü'} <span style={{ opacity: .7, fontWeight: 500 }}>· {count} cihaz</span>
            </span>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <Link href={`/customers/${customerId}`} style={{ color: '#93c5fd', textDecoration: 'none', fontSize: '0.875rem' }}>← Müşteri</Link>
                <Link
                    href={`/customers/${customerId}/cihaz-dokumu${blank ? '' : '?bos=1'}`}
                    style={{
                        color: 'white', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600,
                        border: '1px solid rgba(255,255,255,.3)', borderRadius: '0.5rem', padding: '0.45rem 0.8rem',
                    }}
                >{blank ? 'Sayaçlı hali' : 'Sayaç sütunu boş'}</Link>
                <button
                    onClick={() => window.print()}
                    style={{
                        backgroundColor: '#3b82f6', color: 'white', padding: '0.5rem 1.25rem',
                        border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
                    }}
                >Yazdır</button>
            </div>
        </div>
    );
}
