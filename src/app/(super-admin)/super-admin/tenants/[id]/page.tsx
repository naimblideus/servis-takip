'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Building2, BarChart3, Receipt, Package, Users, Edit3, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { useParams } from 'next/navigation';

const PLAN_LABELS: Record<string, string> = { trial: 'Deneme', starter: 'Başlangıç', professional: 'Profesyonel', enterprise: 'Kurumsal' };
const TABS = ['Genel', 'İstatistikler', 'Abonelik', 'Faturalar', 'Kullanıcılar', 'Notlar'];

export default function TenantDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [tenant, setTenant] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [tab, setTab] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [form, setForm] = useState<any>({});

    const fetchTenant = useCallback(async () => {
        const [t, s] = await Promise.all([
            fetch(`/api/super-admin/tenants/${id}`).then(r => r.json()),
            fetch(`/api/super-admin/tenants/${id}/stats`).then(r => r.json()),
        ]);
        setTenant(t);
        setStats(s);
        setForm(t);
        setLoading(false);
    }, [id]);

    useEffect(() => { fetchTenant(); }, [fetchTenant]);

    const handleSave = async () => {
        setSaving(true);
        await fetch(`/api/super-admin/tenants/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        await fetchTenant();
        setEditMode(false);
        setSaving(false);
    };

    const handleSuspend = async (action: 'suspend' | 'activate', reason?: string) => {
        await fetch(`/api/super-admin/tenants/${id}/suspend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, reason }),
        });
        await fetchTenant();
    };

    const handleChangePlan = async () => {
        const plan = prompt('Yeni paket (trial/starter/professional/enterprise):');
        const amount = prompt('Ödenen tutar (₺, boş bırakabilirsiniz):');
        if (!plan) return;
        await fetch(`/api/super-admin/tenants/${id}/plan`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan, amount: amount ? parseFloat(amount) : null }),
        });
        await fetchTenant();
    };

    const handleExtend = async () => {
        const days = prompt('Kaç gün uzatılsın?');
        if (!days) return;
        await fetch(`/api/super-admin/tenants/${id}/extend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ days: parseInt(days) }),
        });
        await fetchTenant();
    };

    const handleCreateInvoice = async () => {
        const amount = prompt('Fatura tutarı (₺, KDV hariç):');
        if (!amount) return;
        await fetch('/api/super-admin/billing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId: id, amount: parseFloat(amount) }),
        });
        await fetchTenant();
        alert('Fatura oluşturuldu!');
    };

    const handlePayInvoice = async (invoiceId: string) => {
        const method = prompt('Ödeme yöntemi (cash/transfer/card):') || 'transfer';
        await fetch(`/api/super-admin/billing/invoices/${invoiceId}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentMethod: method, paidDate: new Date().toISOString() }),
        });
        await fetchTenant();
    };

    if (loading) return <div className="flex items-center justify-center h-screen"><RefreshCw className="w-8 h-8 animate-spin text-violet-400" /></div>;
    if (!tenant) return <div className="text-center py-24 text-gray-400">İşletme bulunamadı</div>;

    const inpCls = editMode
        ? 'w-full px-3 py-2 bg-white/5 border border-violet-500/50 rounded-xl text-sm focus:outline-none'
        : 'w-full px-3 py-2 bg-transparent border border-transparent rounded-xl text-sm text-gray-200';

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <div className="bg-gradient-to-r from-violet-900/40 to-purple-900/40 border-b border-white/10 px-6 py-5">
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center gap-3 mb-3">
                        <a href="/super-admin/tenants" className="p-2 hover:bg-white/10 rounded-xl"><ArrowLeft className="w-4 h-4" /></a>
                        <div className="flex-1">
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-bold">{tenant.name}</h1>
                                <span className={`text-xs px-2 py-0.5 rounded-lg border ${tenant.isSuspended ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                        : tenant.isActive ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                            : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                                    }`}>
                                    {tenant.isSuspended ? 'Askıda' : tenant.isActive ? 'Aktif' : 'Pasif'}
                                </span>
                                <span className="text-xs bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-lg">
                                    {PLAN_LABELS[tenant.plan] || tenant.plan}
                                </span>
                            </div>
                            <p className="text-gray-400 text-xs mt-0.5">{tenant.ownerName} · {tenant.phone} · {tenant.email}</p>
                        </div>
                        <div className="flex gap-2">
                            {!editMode ? (
                                <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs hover:bg-white/10">
                                    <Edit3 className="w-3.5 h-3.5" />Düzenle
                                </button>
                            ) : (
                                <>
                                    <button onClick={() => setEditMode(false)} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs">İptal</button>
                                    <button onClick={handleSave} disabled={saving} className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs">
                                        {saving ? '...' : 'Kaydet'}
                                    </button>
                                </>
                            )}
                            {tenant.isSuspended ? (
                                <button onClick={() => handleSuspend('activate')} className="px-3 py-2 rounded-xl bg-green-600/20 border border-green-500/30 text-xs text-green-400 hover:bg-green-600/30">
                                    Aktif Et
                                </button>
                            ) : (
                                <button onClick={() => { const r = prompt('Askıya alma sebebi:'); handleSuspend('suspend', r || ''); }}
                                    className="px-3 py-2 rounded-xl bg-red-600/20 border border-red-500/30 text-xs text-red-400 hover:bg-red-600/30">
                                    Askıya Al
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1">
                        {TABS.map((t, i) => (
                            <button key={i} onClick={() => setTab(i)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${tab === i ? 'bg-violet-600/30 text-violet-300 border border-violet-500/30' : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}>
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-6">
                {/* Tab: Genel */}
                {tab === 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            ['İşletme Adı', 'name'], ['Slug', 'slug'], ['E-posta', 'email'], ['Telefon', 'phone'],
                            ['Yetkili', 'ownerName'], ['Vergi No', 'taxNumber'], ['Vergi Dairesi', 'taxOffice'],
                            ['Adres', 'address'], ['İl', 'city'], ['İlçe', 'district'],
                        ].map(([label, key]) => (
                            <div key={key} className="bg-white/3 border border-white/10 rounded-xl p-3">
                                <div className="text-xs text-gray-500 mb-1">{label}</div>
                                <input value={form[key] || ''} onChange={e => setForm((p: any) => ({ ...p, [key]: e.target.value }))}
                                    readOnly={!editMode} className={inpCls} />
                            </div>
                        ))}
                        <div className="md:col-span-2 bg-white/3 border border-white/10 rounded-xl p-3">
                            <div className="text-xs text-gray-500 mb-1">Admin Notu</div>
                            <textarea value={form.adminNotes || ''} onChange={e => setForm((p: any) => ({ ...p, adminNotes: e.target.value }))}
                                readOnly={!editMode} rows={2}
                                className={`${inpCls} resize-none`} />
                        </div>
                    </div>
                )}

                {/* Tab: İstatistikler */}
                {tab === 1 && stats && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {[
                            { label: 'Kullanıcılar', value: `${stats.userCount} / ${stats.maxUsers}`, pct: (stats.userCount / stats.maxUsers) * 100 },
                            { label: 'Bu Ay Fiş', value: `${stats.thisMonthTickets}${stats.maxTicketsPerMonth ? ` / ${stats.maxTicketsPerMonth}` : ''}` },
                            { label: 'Toplam Fiş', value: stats.totalTickets },
                            { label: 'Müşteri', value: stats.customerCount },
                            { label: 'Cihaz', value: stats.deviceCount },
                            { label: 'Depolama', value: `${stats.storageUsedMB.toFixed(1)} / ${stats.storageLimitMB} MB`, pct: (stats.storageUsedMB / stats.storageLimitMB) * 100 },
                        ].map(s => (
                            <div key={s.label} className="bg-white/3 border border-white/10 rounded-xl p-4">
                                <div className="text-xs text-gray-400 mb-1">{s.label}</div>
                                <div className="text-xl font-bold">{String(s.value)}</div>
                                {s.pct !== undefined && (
                                    <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${s.pct > 80 ? 'bg-red-500' : 'bg-violet-500'}`} style={{ width: `${Math.min(100, s.pct)}%` }} />
                                    </div>
                                )}
                            </div>
                        ))}
                        {stats.lastActivity && (
                            <div className="md:col-span-3 text-xs text-gray-500 flex items-center gap-2">
                                <Clock className="w-3 h-3" />
                                Son aktivite: {new Date(stats.lastActivity).toLocaleString('tr-TR')}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab: Abonelik */}
                {tab === 2 && (
                    <div className="space-y-4">
                        <div className="bg-white/3 border border-white/10 rounded-2xl p-5">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-sm text-gray-400">Mevcut Paket</div>
                                    <div className="text-2xl font-bold text-violet-300">{PLAN_LABELS[tenant.plan] || tenant.plan}</div>
                                    {tenant.trialEndsAt && <div className="text-xs text-orange-400 mt-1">Deneme bitiş: {new Date(tenant.trialEndsAt).toLocaleDateString('tr-TR')}</div>}
                                    {tenant.planEndDate && <div className="text-xs text-gray-400 mt-1">Bitiş: {new Date(tenant.planEndDate).toLocaleDateString('tr-TR')}</div>}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={handleChangePlan} className="px-3 py-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-xs text-violet-400 hover:bg-violet-600/30">Paket Değiştir</button>
                                    <button onClick={handleExtend} className="px-3 py-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-xs text-blue-400 hover:bg-blue-600/30">Süre Uzat</button>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white/3 border border-white/10 rounded-2xl p-5">
                            <div className="text-sm font-semibold mb-4">Abonelik Geçmişi</div>
                            <div className="space-y-2">
                                {(tenant.subscriptionHistory || []).map((h: any) => (
                                    <div key={h.id} className="flex items-center justify-between text-sm py-2 border-b border-white/5">
                                        <div className="text-gray-300">{h.action}</div>
                                        <div className="text-xs text-gray-500">{new Date(h.createdAt).toLocaleDateString('tr-TR')}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab: Faturalar */}
                {tab === 3 && (
                    <div>
                        <div className="flex justify-end mb-4">
                            <button onClick={handleCreateInvoice} className="px-4 py-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-xs text-violet-400 hover:bg-violet-600/30">
                                + Fatura Oluştur
                            </button>
                        </div>
                        <div className="bg-white/3 border border-white/10 rounded-2xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 text-xs text-gray-400">
                                        <th className="text-left px-4 py-3">No</th>
                                        <th className="text-left px-4 py-3">Dönem</th>
                                        <th className="text-right px-4 py-3">Tutar</th>
                                        <th className="text-left px-4 py-3">Durum</th>
                                        <th className="text-left px-4 py-3">Son Ödeme</th>
                                        <th className="px-4 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(tenant.invoices || []).map((inv: any) => (
                                        <tr key={inv.id} className="border-b border-white/5">
                                            <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                                            <td className="px-4 py-3 text-gray-400">{inv.period}</td>
                                            <td className="px-4 py-3 text-right">{inv.totalAmount.toLocaleString('tr-TR')} ₺</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs px-2 py-1 rounded-lg ${inv.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                                                        inv.status === 'overdue' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                                                    }`}>{inv.status === 'paid' ? 'Ödendi' : inv.status === 'overdue' ? 'Gecikmiş' : 'Bekliyor'}</span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-400">{new Date(inv.dueDate).toLocaleDateString('tr-TR')}</td>
                                            <td className="px-4 py-3">
                                                {inv.status !== 'paid' && (
                                                    <button onClick={() => handlePayInvoice(inv.id)} className="text-xs text-green-400 hover:text-green-300">
                                                        Öde
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Tab: Kullanıcılar */}
                {tab === 4 && (
                    <div className="bg-white/3 border border-white/10 rounded-2xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10 text-xs text-gray-400">
                                    <th className="text-left px-4 py-3">Ad Soyad</th>
                                    <th className="text-left px-4 py-3">E-posta</th>
                                    <th className="text-left px-4 py-3">Rol</th>
                                    <th className="text-left px-4 py-3">Durum</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(tenant.users || []).map((u: any) => (
                                    <tr key={u.id} className="border-b border-white/5">
                                        <td className="px-4 py-3 font-medium">{u.name}</td>
                                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">{u.email}</td>
                                        <td className="px-4 py-3 text-xs">{u.role}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs px-2 py-1 rounded-lg ${u.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                                {u.isActive ? 'Aktif' : 'Pasif'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Tab: Notlar */}
                {tab === 5 && (
                    <div className="bg-white/3 border border-white/10 rounded-2xl p-5">
                        <div className="text-sm font-semibold mb-3">Süper Admin Notu</div>
                        <textarea
                            value={form.adminNotes || ''}
                            onChange={e => setForm((p: any) => ({ ...p, adminNotes: e.target.value }))}
                            rows={6}
                            placeholder="Bu işletme hakkında notlar..."
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500 resize-none"
                        />
                        <button onClick={handleSave} disabled={saving} className="mt-3 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm disabled:opacity-50">
                            {saving ? 'Kaydediliyor...' : 'Notu Kaydet'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
