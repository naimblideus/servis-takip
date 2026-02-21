'use client';

import { useState, useEffect } from 'react';

const STATUS_LABELS: Record<string, string> = {
    NEW: 'Yeni',
    IN_SERVICE: 'Serviste',
    WAITING_FOR_PART: 'Parça Bkl.',
    READY: 'Hazır',
    DELIVERED: 'Teslim',
    CANCELLED: 'İptal',
};

const STATUS_COLORS: Record<string, string> = {
    NEW: '#f59e0b',
    IN_SERVICE: '#3b82f6',
    WAITING_FOR_PART: '#ec4899',
    READY: '#10b981',
    DELIVERED: '#6366f1',
    CANCELLED: '#6b7280',
};

const PRIORITY_LABELS: Record<string, string> = {
    LOW: 'Düşük', NORMAL: 'Normal', HIGH: 'Yüksek', URGENT: 'Acil',
};

interface ReportData {
    totals: { tickets: number; customers: number; devices: number; revenue: number };
    byStatus: { status: string; _count: number }[];
    byPriority: { priority: string; _count: number }[];
    monthlyData: { label: string; count: number; revenue: number }[];
}

export default function ReportsPage() {
    const [data, setData] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/reports').then(r => r.json()).then(d => {
            setData(d);
            setLoading(false);
        });
    }, []);

    if (loading) return <div style={{ padding: '2rem', color: '#6b7280' }}>Yükleniyor...</div>;
    if (!data) return <div style={{ padding: '2rem', color: '#ef4444' }}>Veri yüklenemedi</div>;

    const maxCount = Math.max(...data.monthlyData.map(m => m.count), 1);
    const maxRevenue = Math.max(...data.monthlyData.map(m => m.revenue), 1);

    return (
        <div style={{ padding: '2rem', maxWidth: '1100px' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Raporlar</h1>
                <p style={{ color: '#6b7280' }}>Genel istatistikler ve trendler</p>
            </div>

            {/* Toplam Kartlar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                    { label: 'Toplam Fiş', value: data.totals.tickets, icon: '📋', color: '#3b82f6' },
                    { label: 'Müşteriler', value: data.totals.customers, icon: '👥', color: '#8b5cf6' },
                    { label: 'Cihazlar', value: data.totals.devices, icon: '🖨️', color: '#f59e0b' },
                    { label: 'Toplam Ciro', value: `₺${data.totals.revenue.toFixed(0)}`, icon: '💰', color: '#10b981' },
                ].map(c => (
                    <div key={c.label} style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{c.icon}</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: c.color }}>{c.value}</div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{c.label}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                {/* Durum Dağılımı */}
                <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
                    <h2 style={{ fontWeight: '600', marginBottom: '1.25rem' }}>Durum Dağılımı</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {data.byStatus.map(s => {
                            const total = data.totals.tickets || 1;
                            const pct = Math.round((s._count / total) * 100);
                            const color = STATUS_COLORS[s.status] || '#6b7280';
                            return (
                                <div key={s.status}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                                        <span style={{ fontWeight: '500' }}>{STATUS_LABELS[s.status] || s.status}</span>
                                        <span style={{ color: '#6b7280' }}>{s._count} ({pct}%)</span>
                                    </div>
                                    <div style={{ height: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: '4px', transition: 'width 0.5s ease' }} />
                                    </div>
                                </div>
                            );
                        })}
                        {data.byStatus.length === 0 && <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Veri yok</p>}
                    </div>
                </div>

                {/* Öncelik Dağılımı */}
                <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
                    <h2 style={{ fontWeight: '600', marginBottom: '1.25rem' }}>Öncelik Dağılımı</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {data.byPriority.map(p => {
                            const total = data.totals.tickets || 1;
                            const pct = Math.round((p._count / total) * 100);
                            const colors: Record<string, string> = { LOW: '#6b7280', NORMAL: '#3b82f6', HIGH: '#f59e0b', URGENT: '#ef4444' };
                            const color = colors[p.priority] || '#6b7280';
                            return (
                                <div key={p.priority}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                                        <span style={{ fontWeight: '500' }}>{PRIORITY_LABELS[p.priority] || p.priority}</span>
                                        <span style={{ color: '#6b7280' }}>{p._count} ({pct}%)</span>
                                    </div>
                                    <div style={{ height: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: '4px', transition: 'width 0.5s ease' }} />
                                    </div>
                                </div>
                            );
                        })}
                        {data.byPriority.length === 0 && <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Veri yok</p>}
                    </div>
                </div>
            </div>

            {/* Aylık Fiş Grafiği */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h2 style={{ fontWeight: '600', marginBottom: '1.5rem' }}>Son 6 Ay — Fiş Sayısı</h2>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', height: '180px' }}>
                    {data.monthlyData.map(m => {
                        const h = maxCount > 0 ? Math.round((m.count / maxCount) * 160) : 0;
                        return (
                            <div key={m.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '0.5rem' }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#374151' }}>{m.count}</div>
                                <div style={{
                                    width: '100%', height: `${h + 8}px`, minHeight: '8px',
                                    backgroundColor: '#3b82f6', borderRadius: '6px 6px 0 0',
                                    transition: 'height 0.5s ease',
                                    opacity: 0.8,
                                }} />
                                <div style={{ fontSize: '0.7rem', color: '#6b7280', textAlign: 'center' }}>{m.label}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Aylık Ciro Grafiği */}
            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
                <h2 style={{ fontWeight: '600', marginBottom: '1.5rem' }}>Son 6 Ay — Tahsil Edilen Ciro (₺)</h2>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', height: '180px' }}>
                    {data.monthlyData.map(m => {
                        const h = maxRevenue > 0 ? Math.round((m.revenue / maxRevenue) * 160) : 0;
                        return (
                            <div key={m.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '0.5rem' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#054f31' }}>₺{m.revenue.toFixed(0)}</div>
                                <div style={{
                                    width: '100%', height: `${h + 8}px`, minHeight: '8px',
                                    backgroundColor: '#10b981', borderRadius: '6px 6px 0 0',
                                    transition: 'height 0.5s ease',
                                    opacity: 0.8,
                                }} />
                                <div style={{ fontSize: '0.7rem', color: '#6b7280', textAlign: 'center' }}>{m.label}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
