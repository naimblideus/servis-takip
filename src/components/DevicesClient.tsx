'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useBarcodeWedge } from '@/hooks/useBarcodeWedge';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

interface Device {
    id: string;
    brand: string;
    model: string;
    serialNo: string;
    location: string | null;
    isRental: boolean;
    monthlyRent: number | null;
    customer: { name: string };
    serviceTickets: { createdAt: Date }[];
}

interface Props {
    devices: Device[];
    activeTab: string;
}

export default function DevicesClient({ devices, activeTab }: Props) {
    const [search, setSearch] = useState('');
    const [scanMsg, setScanMsg] = useState<{ text: string; ok: boolean } | null>(null);
    // `sz`: sekme döngüsü `t` adını kullanıyor, gölgelenmesin.
    const sz = useT();
    const b = useBicim();

    useEffect(() => {
        if (!scanMsg) return;
        const t = setTimeout(() => setScanMsg(null), 3500);
        return () => clearTimeout(t);
    }, [scanMsg]);

    // 📷 Barkod okuyucu: cihaz etiketini (publicCode/seri) okut → kaydını aç
    useBarcodeWedge(async (code) => {
        setScanMsg({ text: doldur(sz.cihazlar.araniyor, { n: code }), ok: true });
        try {
            const r = await fetch(`/api/devices/lookup?code=${encodeURIComponent(code)}`);
            if (r.ok) {
                const d = await r.json();
                setScanMsg({ text: doldur(sz.cihazlar.bulundu, { n: `${d.brand} ${d.model}` }), ok: true });
                window.location.href = `/devices/${d.id}`;
            } else {
                const e = await r.json().catch(() => ({}));
                setScanMsg({ text: e.error || doldur(sz.cihazlar.bulunamadi, { n: code }), ok: false });
            }
        } catch {
            setScanMsg({ text: doldur(sz.cihazlar.baglantiHatasi, { n: code }), ok: false });
        }
    });

    const filtered = useMemo(() => {
        const base = activeTab === 'rental' ? devices.filter(d => d.isRental) :
            activeTab === 'normal' ? devices.filter(d => !d.isRental) : devices;

        if (!search.trim()) return base;
        const q = search.toLowerCase();
        return base.filter(d =>
            d.brand.toLowerCase().includes(q) ||
            d.model.toLowerCase().includes(q) ||
            d.serialNo.toLowerCase().includes(q) ||
            d.customer.name.toLowerCase().includes(q) ||
            (d.location && d.location.toLowerCase().includes(q))
        );
    }, [devices, activeTab, search]);

    const rentalCount = devices.filter(d => d.isRental).length;
    const normalCount = devices.filter(d => !d.isRental).length;

    const tabs = [
        { key: 'all', label: sz.genel.tumu, count: devices.length },
        { key: 'rental', label: sz.cihazlar.sekme.kiralik, count: rentalCount },
        { key: 'normal', label: sz.cihazlar.sekme.normal, count: normalCount },
    ];

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>{sz.cihazlar.baslik}</h1>
                    <p style={{ color: '#6b7280' }}>{doldur(sz.cihazlar.ozet, { n: devices.length, kiralik: rentalCount })}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span title={sz.cihazlar.okuyucuIpucu} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, backgroundColor: '#ecfeff', color: '#0e7490',
                        border: '1px solid #a5f3fc', padding: '0.35rem 0.7rem', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 600,
                    }}>{sz.cihazlar.okuyucuHazir}</span>
                    <Link href="/devices/labels" style={{
                        backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0.625rem 1rem',
                        borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem',
                    }}>{sz.cihazlar.etiketYazdir}</Link>
                    {/* İsteğe bağlı: cihaz yaşı toplu giriş. Zorlamaz, akışa girmez. */}
                    <Link href="/devices/kurulum-tarihi" style={{
                        backgroundColor: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', padding: '0.625rem 1rem',
                        borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem',
                    }}>{sz.cihazlar.cihazYasi}</Link>
                    {/* Liste ekranda kalırsa iş görmez: muhasebeciye gidecek, sigortaya
                        verilecek, sayıma çıkacak. İndirme ekrandakiyle AYNI kaynaktan
                        üretiliyor (api/disa-aktar). */}
                    <a href="/api/disa-aktar?tur=cihaz" title={sz.cihazlar.excelIpucu} style={{
                      backgroundColor: '#0f2253', color: 'white', padding: '0.625rem 1rem',
                      borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 500,
                      fontSize: '0.875rem', whiteSpace: 'nowrap',
                    }}>{sz.genel.excelIndir}</a>
                    <Link href="/devices/new" style={{
                        backgroundColor: '#3b82f6', color: 'white', padding: '0.625rem 1.25rem',
                        borderRadius: '0.5rem', textDecoration: 'none', fontWeight: '500'
                    }}>{sz.cihazlar.yeni}</Link>
                </div>
            </div>

            {scanMsg && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem',
                    backgroundColor: scanMsg.ok ? '#ecfdf5' : '#fef2f2', color: scanMsg.ok ? '#047857' : '#b91c1c',
                    border: `1px solid ${scanMsg.ok ? '#a7f3d0' : '#fecaca'}`, borderRadius: '0.5rem',
                    padding: '0.625rem 0.875rem', fontSize: '0.875rem', fontWeight: 500,
                }}>
                    <span>{scanMsg.ok ? '✓' : '✕'}</span> {scanMsg.text}
                </div>
            )}

            {/* Tab Filtre */}
            <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', backgroundColor: '#f3f4f6', padding: '0.25rem', borderRadius: '0.5rem', width: 'fit-content' }}>
                {tabs.map(t => (
                    <Link key={t.key} href={`/devices?tab=${t.key}`} style={{
                        padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: '500',
                        textDecoration: 'none', transition: 'all 0.15s',
                        backgroundColor: activeTab === t.key ? 'white' : 'transparent',
                        color: activeTab === t.key ? '#1f2937' : '#6b7280',
                        boxShadow: activeTab === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}>
                        {t.label} ({t.count})
                    </Link>
                ))}
            </div>

            {/* 🔍 Arama */}
            <div style={{ marginBottom: '1rem', position: 'relative', maxWidth: '400px' }}>
                <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '1rem' }}>🔍</span>
                <input
                    type="text"
                    placeholder={sz.cihazlar.araYer}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                        width: '100%', padding: '0.625rem 0.75rem 0.625rem 2.25rem',
                        border: '1px solid #d1d5db', borderRadius: '0.5rem',
                        fontSize: '0.875rem', outline: 'none', backgroundColor: 'white',
                        boxSizing: 'border-box', boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    }}
                />
                {search && (
                    <button onClick={() => setSearch('')} style={{
                        position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af',
                    }}>✕</button>
                )}
            </div>

            {search && (
                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                    {doldur(sz.cihazlar.sonuc, { n: filtered.length })}
                </p>
            )}

            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '44rem', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            {[sz.cihazlar.sutun.markaModel, sz.cihazlar.sutun.seriNo, sz.genel.musteri, sz.cihazlar.sutun.konum, activeTab !== 'normal' ? sz.cihazlar.sutun.kira : null, sz.cihazlar.sutun.sonFis, ''].filter((h): h is string => h !== null).map(h => (
                                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((d, i) => (
                            <tr
                                key={d.id}
                                style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? 'white' : '#f9fafb', cursor: 'pointer', transition: 'background-color 0.1s' }}
                                onClick={() => window.location.href = `/devices/${d.id}`}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#eff6ff')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? 'white' : '#f9fafb')}
                            >
                                <td style={{ padding: '0.75rem 1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div>
                                            <div style={{ fontWeight: '500' }}>{d.brand}</div>
                                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{d.model}</div>
                                        </div>
                                        {d.isRental && (
                                            <span style={{ fontSize: '0.65rem', fontWeight: '600', backgroundColor: '#dbeafe', color: '#1e40af', padding: '0.15rem 0.5rem', borderRadius: '9999px', whiteSpace: 'nowrap' }}>{sz.cihazlar.kiralik}</span>
                                        )}
                                    </div>
                                </td>
                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontFamily: 'monospace' }}>{d.serialNo}</td>
                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{d.customer.name}</td>
                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{d.location || '-'}</td>
                                {activeTab !== 'normal' && (
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                                        {d.isRental ? (
                                            <span style={{ fontWeight: '600', color: '#059669' }}>{b.para(d.monthlyRent, 0)}{sz.cihazlar.aylik}</span>
                                        ) : '-'}
                                    </td>
                                )}
                                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                                    {d.serviceTickets[0] ? b.tarih(d.serviceTickets[0].createdAt) : '-'}
                                </td>
                                <td style={{ padding: '0.75rem 1rem' }} onClick={e => e.stopPropagation()}>
                                    <Link href={`/devices/${d.id}`} style={{ color: '#3b82f6', fontSize: '0.875rem', textDecoration: 'none' }}>{sz.genel.detayOk}</Link>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                                {search ? doldur(sz.cihazlar.eslesmeYok, { q: search }) : activeTab === 'rental' ? sz.cihazlar.kiralikYok : activeTab === 'normal' ? sz.cihazlar.normalYok : sz.cihazlar.yok}
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
