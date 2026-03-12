'use client';

import { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Search, Filter, RefreshCw, MoreVertical } from 'lucide-react';
import Link from 'next/link';

const PLAN_LABELS: Record<string, string> = {
    trial: 'Deneme', starter: 'Başlangıç', professional: 'Profesyonel', enterprise: 'Kurumsal',
};
const PLAN_COLORS: Record<string, string> = {
    trial: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    starter: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    professional: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    enterprise: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

export default function TenantsPage() {
    const [tenants, setTenants] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [plan, setPlan] = useState('');
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(1);

    const fetchTenants = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: '20' });
        if (q) params.set('q', q);
        if (plan) params.set('plan', plan);
        if (status) params.set('status', status);
        const res = await fetch(`/api/super-admin/tenants?${params}`);
        const data = await res.json();
        setTenants(data.tenants || []);
        setTotal(data.total || 0);
        setLoading(false);
    }, [q, plan, status, page]);

    useEffect(() => { fetchTenants(); }, [fetchTenants]);

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <div className="bg-gradient-to-r from-violet-900/40 to-purple-900/40 border-b border-white/10 px-6 py-5">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            <Building2 className="w-6 h-6 text-violet-400" />
                            İşletmeler
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">{total} kayıt</p>
                    </div>
                    <Link href="/super-admin/tenants/new"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-medium">
                        <Plus className="w-4 h-4" />
                        Yeni İşletme
                    </Link>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6">
                {/* Filtreler */}
                <div className="flex flex-wrap gap-3 mb-5">
                    <div className="relative flex-1 min-w-52">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="İşletme adı, yetkili, telefon..."
                            value={q}
                            onChange={e => { setQ(e.target.value); setPage(1); }}
                            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500"
                        />
                    </div>
                    <select value={plan} onChange={e => { setPlan(e.target.value); setPage(1); }}
                        className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none bg-gray-900">
                        <option value="" className="bg-gray-900">Tüm Paketler</option>
                        {Object.entries(PLAN_LABELS).map(([k, v]) => <option key={k} value={k} className="bg-gray-900">{v}</option>)}
                    </select>
                    <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
                        className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none bg-gray-900">
                        <option value="" className="bg-gray-900">Tüm Durumlar</option>
                        <option value="active" className="bg-gray-900">Aktif</option>
                        <option value="trial" className="bg-gray-900">Deneme</option>
                        <option value="suspended" className="bg-gray-900">Askıda</option>
                        <option value="inactive" className="bg-gray-900">Pasif</option>
                    </select>
                </div>

                {/* Tablo */}
                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <RefreshCw className="w-7 h-7 animate-spin text-violet-400" />
                    </div>
                ) : (
                    <div className="bg-white/3 border border-white/10 rounded-2xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10 text-gray-400 text-xs">
                                    <th className="text-left px-4 py-3">İşletme</th>
                                    <th className="text-left px-4 py-3">Yetkili</th>
                                    <th className="text-left px-4 py-3">Telefon</th>
                                    <th className="text-left px-4 py-3 hidden md:table-cell">Şehir</th>
                                    <th className="text-left px-4 py-3">Paket</th>
                                    <th className="text-left px-4 py-3">Durum</th>
                                    <th className="text-right px-4 py-3">Fiş / Kullanıcı</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {tenants.length === 0 ? (
                                    <tr><td colSpan={8} className="text-center py-12 text-gray-500">Kayıt bulunamadı</td></tr>
                                ) : tenants.map(t => (
                                    <tr key={t.id} className="border-b border-white/5 hover:bg-white/3 transition-all">
                                        <td className="px-4 py-3">
                                            <Link href={`/super-admin/tenants/${t.id}`} className="font-medium hover:text-violet-300 transition-all">
                                                {t.name}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-gray-300">{t.ownerName || '—'}</td>
                                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">{t.phone || '—'}</td>
                                        <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{t.city || '—'}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs px-2 py-1 rounded-lg border ${PLAN_COLORS[t.plan] || PLAN_COLORS.trial}`}>
                                                {PLAN_LABELS[t.plan] || t.plan}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {t.isSuspended ? (
                                                <span className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded-lg">Askıda</span>
                                            ) : t.isActive ? (
                                                <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-lg">Aktif</span>
                                            ) : (
                                                <span className="text-xs text-gray-400 bg-gray-500/10 px-2 py-1 rounded-lg">Pasif</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-400 text-xs">
                                            {t._count?.serviceTickets || 0} / {t._count?.users || 0}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Link href={`/super-admin/tenants/${t.id}`}
                                                className="p-1.5 rounded-lg hover:bg-white/10 block">
                                                <MoreVertical className="w-4 h-4 text-gray-400" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Sayfalama */}
                        {total > 20 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
                                <span className="text-xs text-gray-500">{total} sonuçtan {Math.min((page - 1) * 20 + 1, total)}–{Math.min(page * 20, total)}</span>
                                <div className="flex gap-2">
                                    <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
                                        className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs disabled:opacity-40">
                                        ← Önceki
                                    </button>
                                    <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total}
                                        className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs disabled:opacity-40">
                                        Sonraki →
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
