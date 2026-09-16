'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Building2, BarChart3, Receipt, Package, Users, Edit3, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { useParams } from 'next/navigation';
import { ALL_MODULE_KEYS, effectiveModules } from '@/lib/modules';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

export default function TenantDetailPage() {
    const { id } = useParams<{ id: string }>();
    const sz = useT();
    const b = useBicim();
    const d = sz.superAdmin.detay;
    const f = sz.superAdmin.fatura;
    const paketAdi = (k: string) => sz.superAdmin.paket[k as keyof typeof sz.superAdmin.paket] || k;
    const TABS = [d.sekmeGenel, d.sekmeIstatistik, d.sekmeAbonelik, d.sekmeFaturalar, d.sekmeKullanicilar, d.sekmeNotlar];
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
        // Hata sessizce yutulmamalı: WhatsApp numara kimliği başka bayide tanımlıysa
        // sunucu 409 döner ve kullanıcı kaydettiğini sanmamalı.
        const res = await fetch(`/api/super-admin/tenants/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        if (!res.ok) {
            const cevap = await res.json().catch(() => ({}));
            alert('❌ ' + (cevap.error || d.kaydedilemedi));
            setSaving(false);
            return;
        }
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
        const plan = prompt(d.yeniPaketSor);
        const amount = prompt(d.odenenTutarSor);
        if (!plan) return;
        await fetch(`/api/super-admin/tenants/${id}/plan`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan, amount: amount ? parseFloat(amount) : null }),
        });
        await fetchTenant();
    };

    const handleExtend = async () => {
        const days = prompt(d.kacGunSor);
        if (!days) return;
        await fetch(`/api/super-admin/tenants/${id}/extend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ days: parseInt(days) }),
        });
        await fetchTenant();
    };

    const handleToggleModule = async (key: string) => {
        const eff = new Set(Array.from(effectiveModules(tenant)) as string[]);
        if (eff.has(key)) eff.delete(key); else eff.add(key);
        await fetch(`/api/super-admin/tenants/${id}/modules`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modules: Array.from(eff) }),
        });
        await fetchTenant();
    };

    const handleResetModules = async () => {
        await fetch(`/api/super-admin/tenants/${id}/modules`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modules: [] }),
        });
        await fetchTenant();
    };

    const handleCreateInvoice = async () => {
        const amount = prompt(d.faturaTutarSor);
        if (!amount) return;
        await fetch('/api/super-admin/billing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId: id, amount: parseFloat(amount) }),
        });
        await fetchTenant();
        alert(d.faturaOlusturuldu);
    };

    const handlePayInvoice = async (invoiceId: string) => {
        const method = prompt(f.odemeYontemiSor) || 'transfer';
        await fetch(`/api/super-admin/billing/invoices/${invoiceId}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentMethod: method, paidDate: new Date().toISOString() }),
        });
        await fetchTenant();
    };

    if (loading) return <div className="flex items-center justify-center h-screen"><RefreshCw className="w-8 h-8 animate-spin text-violet-400" /></div>;
    if (!tenant) return <div className="text-center py-24 text-gray-400">{d.bulunamadi}</div>;

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
                                    {tenant.isSuspended ? sz.superAdmin.isletmeler.askida
                                        : tenant.isActive ? sz.superAdmin.isletmeler.aktif : sz.superAdmin.isletmeler.pasif}
                                </span>
                                <span className="text-xs bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-lg">
                                    {paketAdi(tenant.plan)}
                                </span>
                            </div>
                            <p className="text-gray-400 text-xs mt-0.5">{tenant.ownerName} · {tenant.phone} · {tenant.email}</p>
                        </div>
                        <div className="flex gap-2">
                            {!editMode ? (
                                <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs hover:bg-white/10">
                                    <Edit3 className="w-3.5 h-3.5" />{d.duzenle}
                                </button>
                            ) : (
                                <>
                                    <button onClick={() => setEditMode(false)} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs">{d.iptal}</button>
                                    <button onClick={handleSave} disabled={saving} className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs">
                                        {saving ? '...' : d.kaydet}
                                    </button>
                                </>
                            )}
                            {tenant.isSuspended ? (
                                <button onClick={() => handleSuspend('activate')} className="px-3 py-2 rounded-xl bg-green-600/20 border border-green-500/30 text-xs text-green-400 hover:bg-green-600/30">
                                    {d.aktifEt}
                                </button>
                            ) : (
                                <button onClick={() => { const r = prompt(d.askiSebebi); handleSuspend('suspend', r || ''); }}
                                    className="px-3 py-2 rounded-xl bg-red-600/20 border border-red-500/30 text-xs text-red-400 hover:bg-red-600/30">
                                    {d.askiyaAl}
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
                            [d.alanAd, 'name'], [d.alanSlug, 'slug'], [d.alanEposta, 'email'], [d.alanTelefon, 'phone'],
                            [d.alanYetkili, 'ownerName'], [d.alanVergiNo, 'taxNumber'], [d.alanVergiDairesi, 'taxOffice'],
                            [d.alanAdres, 'address'], [d.alanIl, 'city'], [d.alanIlce, 'district'],
                            // e-Fatura ön eki GİB'e kayıtlı 3 harftir ve belge
                            // numarasının başına gelir (NXS2026000000001).
                            // Sıra sayacı BİLEREK forma konmadı: elle
                            // değiştirilirse aynı numaradan iki belge çıkar.
                            [d.alanEFaturaOnEk, 'eFaturaOnEk'],
                            [d.alanEFaturaEtiket, 'eFaturaEtiket'],
                        ].map(([label, key]) => (
                            <div key={key} className="bg-white/3 border border-white/10 rounded-xl p-3">
                                <div className="text-xs text-gray-500 mb-1">{label}</div>
                                <input value={form[key] || ''} onChange={e => setForm((p: any) => ({ ...p, [key]: e.target.value }))}
                                    readOnly={!editMode} className={inpCls} />
                            </div>
                        ))}
                        {/* WhatsApp bağlantısı — gelen mesajın HANGİ bayiye ait olduğu yalnızca buradan bulunur */}
                        <div className="md:col-span-2 bg-white/3 border border-white/10 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                                <div className="text-xs text-gray-400">{d.waBaslik}</div>
                                {form.whatsappPhoneId
                                    ? <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 rounded-full px-2 py-0.5">{d.waBagli}</span>
                                    : <span className="text-[11px] font-semibold text-gray-400 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">{d.waBagliDegil}</span>}
                            </div>
                            <input value={form.whatsappPhoneId || ''}
                                onChange={e => setForm((p: any) => ({ ...p, whatsappPhoneId: e.target.value }))}
                                readOnly={!editMode} placeholder={d.waYer} className={inpCls} />
                            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                                {d.waAciklama}
                            </p>
                        </div>
                        {/* Üretici veri paylaşımı — sözleşme imzalanınca AÇILIR.
                            Varsayılan kapalı: deneme hesapları ve ayrılan bayiler
                            kazara kapsama girmesin. */}
                        <div className="md:col-span-2 bg-white/3 border border-white/10 rounded-xl p-3">
                            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                                <div className="text-xs text-gray-400">{d.oemBaslik}</div>
                                {form.oemDataSharing
                                    ? <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 rounded-full px-2 py-0.5">
                                        {d.oemRizaVar}{form.oemDataSharingAt ? ` · ${b.tarih(form.oemDataSharingAt)}` : ''}
                                      </span>
                                    : <span className="text-[11px] font-semibold text-gray-400 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">{d.oemRizaYok}</span>}
                            </div>
                            <label className={`flex items-center gap-2 ${editMode ? 'cursor-pointer' : 'opacity-70'}`}>
                                <input type="checkbox" disabled={!editMode}
                                    checked={!!form.oemDataSharing}
                                    onChange={e => setForm((p: any) => ({
                                        ...p,
                                        oemDataSharing: e.target.checked,
                                        // Rıza tarihi ilk açılışta damgalanır; kapatılırsa temizlenir.
                                        oemDataSharingAt: e.target.checked ? (p.oemDataSharingAt || new Date().toISOString()) : null,
                                    }))} />
                                <span className="text-sm">{d.oemOnay}</span>
                            </label>
                            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                                {d.oemAciklama1} <b>{d.oemAciklamaVurgu}</b> {d.oemAciklama2} <b>{d.oemAcma}</b>.
                            </p>
                        </div>
                        <div className="md:col-span-2 bg-white/3 border border-white/10 rounded-xl p-3">
                            <div className="text-xs text-gray-500 mb-1">{d.adminNotu}</div>
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
                            { label: d.istKullanicilar, value: `${stats.userCount} / ${stats.maxUsers}`, pct: (stats.userCount / stats.maxUsers) * 100 },
                            { label: d.istBuAyFis, value: `${stats.thisMonthTickets}${stats.maxTicketsPerMonth ? ` / ${stats.maxTicketsPerMonth}` : ''}` },
                            { label: d.istToplamFis, value: stats.totalTickets },
                            { label: d.istMusteri, value: stats.customerCount },
                            { label: d.istCihaz, value: stats.deviceCount },
                            { label: d.istDepolama, value: `${b.sayi(stats.storageUsedMB, 1)} / ${b.sayi(stats.storageLimitMB)} MB`, pct: (stats.storageUsedMB / stats.storageLimitMB) * 100 },
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
                                {d.sonAktivite} {b.tarihSaat(stats.lastActivity)}
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
                                    <div className="text-sm text-gray-400">{d.mevcutPaket}</div>
                                    <div className="text-2xl font-bold text-violet-300">{paketAdi(tenant.plan)}</div>
                                    {tenant.trialEndsAt && <div className="text-xs text-orange-400 mt-1">{d.denemeBitis} {b.tarih(tenant.trialEndsAt)}</div>}
                                    {tenant.planEndDate && <div className="text-xs text-gray-400 mt-1">{d.bitis} {b.tarih(tenant.planEndDate)}</div>}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={handleChangePlan} className="px-3 py-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-xs text-violet-400 hover:bg-violet-600/30">{d.paketDegistir}</button>
                                    <button onClick={handleExtend} className="px-3 py-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-xs text-blue-400 hover:bg-blue-600/30">{d.sureUzat}</button>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white/3 border border-white/10 rounded-2xl p-5">
                            <div className="flex justify-between items-center mb-4">
                                <div className="text-sm font-semibold">{d.modullerBaslik}</div>
                                <button onClick={handleResetModules} className="text-xs text-gray-400 hover:text-white">{d.planVarsayilanina}</button>
                            </div>
                            <div className="space-y-1">
                                {ALL_MODULE_KEYS.map((k) => {
                                    const on = effectiveModules(tenant).has(k);
                                    return (
                                        <div key={k} className="flex items-start justify-between gap-3 py-2 border-b border-white/5 last:border-0">
                                            <div className="min-w-0">
                                                <div className="text-sm text-gray-200">{sz.modul.ad[k]}</div>
                                                {/* Toggle'a basan kişi neyi kapattığını bilmeden basmasın */}
                                                <div className="text-[11px] text-gray-500 leading-snug mt-0.5">{sz.modul.aciklama[k]}</div>
                                            </div>
                                            <button onClick={() => handleToggleModule(k)} title={on ? d.modulKapat : d.modulAc}
                                                className={`relative w-11 h-6 shrink-0 mt-0.5 rounded-full transition-all ${on ? 'bg-violet-500' : 'bg-gray-600'}`}>
                                                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${on ? 'left-5' : 'left-0.5'}`} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* "Bu modül neden açık?" sorusunun cevabı ekranda dursun:
                                plan varsayılanı mı, yoksa bu bayiye özel liste mi. */}
                            <div className="text-[11px] mt-3">
                                {Array.isArray(tenant.modules) && tenant.modules.length > 0
                                    ? <span className="text-amber-400">{d.ozelListe}</span>
                                    : <span className="text-gray-400">{doldur(d.planVarsayilani, { paket: paketAdi(tenant.plan) })}</span>}
                            </div>
                            <p className="text-xs text-gray-500 mt-2">{d.cekirdekNot}</p>
                        </div>

                        <div className="bg-white/3 border border-white/10 rounded-2xl p-5">
                            <div className="text-sm font-semibold mb-4">{d.abonelikGecmisi}</div>
                            <div className="space-y-2">
                                {(tenant.subscriptionHistory || []).map((h: any) => (
                                    <div key={h.id} className="flex items-center justify-between text-sm py-2 border-b border-white/5">
                                        <div className="text-gray-300">{h.action}</div>
                                        <div className="text-xs text-gray-500">{b.tarih(h.createdAt)}</div>
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
                                {d.faturaOlustur}
                            </button>
                        </div>
                        <div className="bg-white/3 border border-white/10 rounded-2xl overflow-x-auto">
                            <table className="w-full text-sm min-w-[40rem]">
                                <thead>
                                    <tr className="border-b border-white/10 text-xs text-gray-400">
                                        <th className="text-left px-4 py-3">{f.sutunKisaNo}</th>
                                        <th className="text-left px-4 py-3">{f.sutunDonem}</th>
                                        <th className="text-right px-4 py-3">{f.sutunTutar}</th>
                                        <th className="text-left px-4 py-3">{f.sutunDurum}</th>
                                        <th className="text-left px-4 py-3">{f.sutunSonOdeme}</th>
                                        <th className="px-4 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(tenant.invoices || []).map((inv: any) => (
                                        <tr key={inv.id} className="border-b border-white/5">
                                            <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                                            <td className="px-4 py-3 text-gray-400">{inv.period}</td>
                                            <td className="px-4 py-3 text-right">{b.para(inv.totalAmount)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs px-2 py-1 rounded-lg ${inv.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                                                        inv.status === 'overdue' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                                                    }`}>{inv.status === 'paid' ? f.odendi : inv.status === 'overdue' ? f.gecikmisDurum : f.bekliyor}</span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-400">{b.tarih(inv.dueDate)}</td>
                                            <td className="px-4 py-3">
                                                {inv.status !== 'paid' && (
                                                    <button onClick={() => handlePayInvoice(inv.id)} className="text-xs text-green-400 hover:text-green-300">
                                                        {f.ode}
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
                    <div className="bg-white/3 border border-white/10 rounded-2xl overflow-x-auto">
                        <table className="w-full text-sm min-w-[40rem]">
                            <thead>
                                <tr className="border-b border-white/10 text-xs text-gray-400">
                                    <th className="text-left px-4 py-3">{d.kullaniciAdSoyad}</th>
                                    <th className="text-left px-4 py-3">{d.alanEposta}</th>
                                    <th className="text-left px-4 py-3">{d.kullaniciRol}</th>
                                    <th className="text-left px-4 py-3">{sz.superAdmin.isletmeler.sutunDurum}</th>
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
                                                {u.isActive ? sz.superAdmin.isletmeler.aktif : sz.superAdmin.isletmeler.pasif}
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
                        <div className="text-sm font-semibold mb-3">{d.notBaslik}</div>
                        <textarea
                            value={form.adminNotes || ''}
                            onChange={e => setForm((p: any) => ({ ...p, adminNotes: e.target.value }))}
                            rows={6}
                            placeholder={d.notYer}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500 resize-none"
                        />
                        <button onClick={handleSave} disabled={saving} className="mt-3 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm disabled:opacity-50">
                            {saving ? d.notKaydediliyor : d.notKaydet}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
