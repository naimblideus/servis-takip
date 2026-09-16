'use client';

import { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Search, Filter, RefreshCw, MoreVertical } from 'lucide-react';
import Link from 'next/link';
import { useT } from '@/lib/i18n/client';
import { doldur, type Sozluk } from '@/lib/i18n/sozluk';

const PLAN_KEYS = ['trial', 'starter', 'professional', 'enterprise'] as const;
const PLAN_COLORS: Record<string, string> = {
    trial: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    starter: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    professional: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    enterprise: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

// Göreli zaman ve sağlık rozeti sözlüğü PARAMETRE alır: metni burada kurmak
// yerine dışarıdan alması, aynı işlevin iki dilde de doğru cümleyi vermesini
// sağlar.
function relTime(sz: Sozluk, iso: string | null): string {
    const z = sz.superAdmin.isletmeler;
    if (!iso) return z.zamanHic;
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return z.zamanBugun;
    if (days === 1) return z.zamanDun;
    if (days < 30) return doldur(z.zamanGun, { n: days });
    return doldur(z.zamanAy, { n: Math.floor(days / 30) });
}

// Churn/sağlık rozeti — bayi gerçekten kullanıyor mu?
function health(sz: Sozluk, t: any): { label: string; cls: string } {
    const z = sz.superAdmin.isletmeler;
    if (t.isSuspended) return { label: z.askida, cls: 'text-red-400 bg-red-500/10' };
    if (!t.isActive) return { label: z.pasif, cls: 'text-gray-400 bg-gray-500/10' };
    if (t.plan === 'trial' && t.trialEndsAt) {
        const d = Math.floor((new Date(t.trialEndsAt).getTime() - Date.now()) / 86400000);
        if (d < 0) return { label: z.saglikDenemeBitti, cls: 'text-red-400 bg-red-500/10' };
        if (d <= 7) return { label: doldur(z.saglikDenemeGun, { n: d }), cls: 'text-amber-400 bg-amber-500/10' };
    }
    const last = t.lastActivityAt ? Math.floor((Date.now() - new Date(t.lastActivityAt).getTime()) / 86400000) : 9999;
    if (last >= 14) return { label: z.saglikSessiz, cls: 'text-red-400 bg-red-500/10' };
    return { label: z.aktif, cls: 'text-green-400 bg-green-500/10' };
}

export default function TenantsPage() {
    const sz = useT();
    const z = sz.superAdmin.isletmeler;
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
                            {z.baslik}
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">{doldur(z.kayit, { n: total })}</p>
                    </div>
                    <Link href="/super-admin/tenants/new"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-medium">
                        <Plus className="w-4 h-4" />
                        {sz.superAdmin.panel.yeniIsletme}
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
                            placeholder={z.ara}
                            value={q}
                            onChange={e => { setQ(e.target.value); setPage(1); }}
                            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500"
                        />
                    </div>
                    <select value={plan} onChange={e => { setPlan(e.target.value); setPage(1); }}
                        className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none bg-gray-900">
                        <option value="" className="bg-gray-900">{z.tumPaketler}</option>
                        {PLAN_KEYS.map(k => <option key={k} value={k} className="bg-gray-900">{sz.superAdmin.paket[k]}</option>)}
                    </select>
                    <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
                        className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none bg-gray-900">
                        <option value="" className="bg-gray-900">{z.tumDurumlar}</option>
                        <option value="active" className="bg-gray-900">{z.aktif}</option>
                        <option value="trial" className="bg-gray-900">{sz.superAdmin.paket.trial}</option>
                        <option value="suspended" className="bg-gray-900">{z.askida}</option>
                        <option value="inactive" className="bg-gray-900">{z.pasif}</option>
                    </select>
                </div>

                {/* Tablo */}
                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <RefreshCw className="w-7 h-7 animate-spin text-violet-400" />
                    </div>
                ) : (
                    <div className="bg-white/3 border border-white/10 rounded-2xl overflow-x-auto">
                        <table className="w-full text-sm min-w-[44rem]">
                            <thead>
                                <tr className="border-b border-white/10 text-gray-400 text-xs">
                                    <th className="text-left px-4 py-3">{z.sutunIsletme}</th>
                                    <th className="text-left px-4 py-3">{z.sutunYetkili}</th>
                                    <th className="text-left px-4 py-3">{z.sutunTelefon}</th>
                                    <th className="text-left px-4 py-3 hidden md:table-cell">{z.sutunSehir}</th>
                                    <th className="text-left px-4 py-3">{z.sutunPaket}</th>
                                    <th className="text-left px-4 py-3">{z.sutunDurum}</th>
                                    <th className="text-left px-4 py-3 hidden lg:table-cell">{z.sutunSaglik}</th>
                                    <th className="text-right px-4 py-3">{z.sutunFisKullanici}</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {tenants.length === 0 ? (
                                    <tr><td colSpan={9} className="text-center py-12 text-gray-500">{z.kayitYok}</td></tr>
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
                                                {sz.superAdmin.paket[t.plan as keyof typeof sz.superAdmin.paket] || t.plan}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {t.isSuspended ? (
                                                <span className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded-lg">{z.askida}</span>
                                            ) : t.isActive ? (
                                                <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-lg">{z.aktif}</span>
                                            ) : (
                                                <span className="text-xs text-gray-400 bg-gray-500/10 px-2 py-1 rounded-lg">{z.pasif}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 hidden lg:table-cell">
                                            {(() => { const h = health(sz, t); return (
                                                <div className="flex flex-col gap-0.5">
                                                    <span className={`text-xs px-2 py-0.5 rounded-lg w-fit ${h.cls}`}>{h.label}</span>
                                                    <span className="text-[11px] text-gray-500">
                                                        {relTime(sz, t.lastActivityAt)} · {doldur(z.fis30g, { n: t.tickets30d || 0 })}
                                                    </span>
                                                </div>
                                            ); })()}
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
                                <span className="text-xs text-gray-500">
                                    {doldur(z.sayfaBilgi, {
                                        toplam: total,
                                        bas: Math.min((page - 1) * 20 + 1, total),
                                        son: Math.min(page * 20, total),
                                    })}
                                </span>
                                <div className="flex gap-2">
                                    <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
                                        className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs disabled:opacity-40">
                                        {z.onceki}
                                    </button>
                                    <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total}
                                        className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs disabled:opacity-40">
                                        {z.sonraki}
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
