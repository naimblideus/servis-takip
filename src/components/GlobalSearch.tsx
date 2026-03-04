'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface SearchResult {
    tickets: any[];
    customers: any[];
    devices: any[];
}

const STATUS_LABELS: Record<string, string> = {
    NEW: 'Yeni', IN_SERVICE: 'Serviste', WAITING_FOR_PART: 'Parça Bkl.', READY: 'Hazır', DELIVERED: 'Teslim', CANCELLED: 'İptal',
};

export default function GlobalSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const calcPos = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setDropdownPos({ top: rect.bottom + 8, left: rect.left, width: Math.max(280, rect.width) });
        }
    };

    const abortRef = useRef<AbortController | null>(null);

    const search = (q: string) => {
        setQuery(q);
        clearTimeout(timeoutRef.current);
        // Önceki in-flight isteği iptal et
        abortRef.current?.abort();
        if (q.length < 2) { setResults(null); setOpen(false); return; }
        setLoading(true);
        calcPos();
        timeoutRef.current = setTimeout(async () => {
            const controller = new AbortController();
            abortRef.current = controller;
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
                if (res.ok) {
                    const data = await res.json();
                    setResults(data);
                    setOpen(true);
                }
            } catch (err: any) {
                if (err.name === 'AbortError') return; // İptal edildi, sonucu yoksay
            } finally {
                setLoading(false);
            }
        }, 300);
    };

    const total = results ? results.tickets.length + results.customers.length + results.devices.length : 0;

    const dropdownStyle: React.CSSProperties = {
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        border: '1px solid #e5e7eb',
        zIndex: 9999,
        overflow: 'hidden',
        maxHeight: '420px',
        overflowY: 'auto',
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem', color: '#9ca3af' }}>🔍</span>
                <input
                    type="text"
                    placeholder="Ara..."
                    value={query}
                    onChange={e => search(e.target.value)}
                    onFocus={() => { calcPos(); results && setOpen(true); }}
                    style={{
                        width: '100%',
                        padding: '0.475rem 0.5rem 0.475rem 1.875rem',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '0.375rem',
                        fontSize: '0.8rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        color: 'white',
                        caretColor: 'white',
                    }}
                />
                {loading && <span style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '0.7rem' }}>⏳</span>}
            </div>

            {open && results && total > 0 && (
                <div style={dropdownStyle}>
                    {results.tickets.length > 0 && (
                        <section>
                            <div style={{ padding: '0.4rem 1rem', backgroundColor: '#f9fafb', fontSize: '0.7rem', fontWeight: '700', color: '#6b7280', letterSpacing: '0.05em' }}>SERVİS FİŞLERİ</div>
                            {results.tickets.map(t => (
                                <Link key={t.id} href={`/tickets/${t.id}`} onClick={() => setOpen(false)}
                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 1rem', textDecoration: 'none', color: 'inherit', borderBottom: '1px solid #f3f4f6' }}
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                                    <div>
                                        <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: '600', color: '#2563eb' }}>{t.ticketNumber}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{t.device?.customer?.name} — {t.device?.brand} {t.device?.model}</div>
                                    </div>
                                    <span style={{ fontSize: '0.7rem', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '0.15rem 0.5rem', borderRadius: '4px', whiteSpace: 'nowrap' }}>{STATUS_LABELS[t.status] || t.status}</span>
                                </Link>
                            ))}
                        </section>
                    )}
                    {results.customers.length > 0 && (
                        <section>
                            <div style={{ padding: '0.4rem 1rem', backgroundColor: '#f9fafb', fontSize: '0.7rem', fontWeight: '700', color: '#6b7280', letterSpacing: '0.05em' }}>MÜŞTERİLER</div>
                            {results.customers.map(c => (
                                <Link key={c.id} href={`/customers/${c.id}`} onClick={() => setOpen(false)}
                                    style={{ display: 'flex', justifyContent: 'space-between', padding: '0.625rem 1rem', textDecoration: 'none', color: 'inherit', borderBottom: '1px solid #f3f4f6' }}
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                                    <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{c.name}</span>
                                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{c.phone}</span>
                                </Link>
                            ))}
                        </section>
                    )}
                    {results.devices.length > 0 && (
                        <section>
                            <div style={{ padding: '0.4rem 1rem', backgroundColor: '#f9fafb', fontSize: '0.7rem', fontWeight: '700', color: '#6b7280', letterSpacing: '0.05em' }}>CİHAZLAR</div>
                            {results.devices.map(d => (
                                <Link key={d.id} href={`/devices/${d.id}`} onClick={() => setOpen(false)}
                                    style={{ display: 'flex', justifyContent: 'space-between', padding: '0.625rem 1rem', textDecoration: 'none', color: 'inherit', borderBottom: '1px solid #f3f4f6' }}
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                                    <div>
                                        <div style={{ fontSize: '0.875rem', fontWeight: '500' }}>{d.brand} {d.model}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{d.customer?.name} · {d.serialNo}</div>
                                    </div>
                                    <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#6b7280' }}>{d.publicCode}</div>
                                </Link>
                            ))}
                        </section>
                    )}
                </div>
            )}

            {open && results && total === 0 && (
                <div style={{ ...dropdownStyle, padding: '1.25rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
                    &ldquo;{query}&rdquo; için sonuç bulunamadı
                </div>
            )}
        </div>
    );
}
