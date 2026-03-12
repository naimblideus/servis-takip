'use client';

import { useState, useEffect } from 'react';
import { Building2, Users, Receipt, AlertTriangle, CheckCircle, TrendingUp, Clock, Package, RefreshCw } from 'lucide-react';
import Link from 'next/link';

const PLAN_COLORS: Record<string, string> = {
    trial: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    starter: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    professional: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    enterprise: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const PLAN_LABELS: Record<string, string> = {
    trial: 'Deneme', starter: 'Başlangıç', professional: 'Profesyonel', enterprise: 'Kurumsal',
};

interface DashboardData {
    totalTenants: number;
    activeTenants: number;
    trialTenants: number;
    suspendedTenants: number;
    newThisMonth: number;
    expiringSoon: number;
    overdueInvoices: number;
    monthlyRevenue: number;
    planCounts: Record<string, number>;
    recentTenants: any[];
}

export default function SuperAdminDashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/super-admin/dashboard')
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    if (loading) return (
        <div className="flex items-center justify-center h-screen">
            <RefreshCw className="w-8 h-8 animate-spin text-violet-400" />
        </div>
    );
    if (!data) return null;

    const stats = [
        { icon: Building2, label: 'Toplam İşletme', value: data.totalTenants, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
        { icon: CheckCircle, label: 'Aktif', value: data.activeTenants, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
        { icon: Clock, label: 'Deneme', value: data.trialTenants, color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' },
        { icon: AlertTriangle, label: 'Askıda', value: data.suspendedTenants, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
        { icon: TrendingUp, label: 'Bu Ay Yeni', value: data.newThisMonth, color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/20' },
        { icon: Clock, label: '7 Günde Bitiyor', value: data.expiringSoon, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
        { icon: Receipt, label: 'Gecikmiş Fatura', value: data.overdueInvoices, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
        { icon: Receipt, label: 'Bu Ay Tahsilat', value: `${(data.monthlyRevenue || 0).toLocaleString('tr-TR')} ₺`, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
    ];

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-900/40 to-purple-900/40 border-b border-white/10 px-6 py-5">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Platform Dashboard</h1>
                        <p className="text-gray-400 text-sm mt-1">Tüm işletmelerin genel özeti</p>
                    </div>
                    <Link href="/super-admin/tenants/new"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-medium transition-all">
                        + Yeni İşletme
                    </Link>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {stats.map(s => (
                        <div key={s.label} className={`rounded-xl p-4 border ${s.bg}`}>
                            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                            <div className="text-xs text-gray-400 mt-1">{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Paket Dağılımı + Son İşletmeler */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Paket Dağılımı */}
                    <div className="bg-white/3 border border-white/10 rounded-2xl p-5">
                        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                            <Package className="w-4 h-4 text-violet-400" />
                            Paket Dağılımı
                        </h3>
                        <div className="space-y-3">
                            {Object.entries(PLAN_LABELS).map(([key, label]) => {
                                const count = data.planCounts[key] || 0;
                                const total = Object.values(data.planCounts).reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                                return (
                                    <div key={key}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-gray-400">{label}</span>
                                            <span className="font-semibold">{count} ({pct}%)</span>
                                        </div>
                                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Son İşletmeler */}
                    <div className="lg:col-span-2 bg-white/3 border border-white/10 rounded-2xl p-5">
                        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-violet-400" />
                            Son Eklenen İşletmeler
                        </h3>
                        <div className="space-y-2">
                            {(data.recentTenants || []).map(t => (
                                <Link key={t.id} href={`/super-admin/tenants/${t.id}`}
                                    className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all">
                                    <div>
                                        <div className="text-sm font-medium">{t.name}</div>
                                        <div className="text-xs text-gray-500">{t.ownerName} {t.city ? `— ${t.city}` : ''}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs px-2 py-1 rounded-lg border ${PLAN_COLORS[t.plan] || PLAN_COLORS.trial}`}>
                                            {PLAN_LABELS[t.plan] || t.plan}
                                        </span>
                                        {t.isSuspended ? (
                                            <span className="text-xs text-red-400">Askıda</span>
                                        ) : t.isActive ? (
                                            <span className="w-2 h-2 rounded-full bg-green-400" />
                                        ) : (
                                            <span className="w-2 h-2 rounded-full bg-gray-500" />
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                        <Link href="/super-admin/tenants" className="block text-center text-xs text-violet-400 hover:text-violet-300 mt-3">
                            Tüm işletmeleri gör →
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
