'use client';

import { useState, useEffect } from 'react';
import { Building2, Users, Receipt, AlertTriangle, CheckCircle, TrendingUp, Clock, Package, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { kontrolAdi, kontrolMesaji, kontrolNedeni, nobetciOzeti, type KontrolAdi, type MesajKod, type NedenKod } from '@/lib/nobetci-metin';

const PLAN_COLORS: Record<string, string> = {
    trial: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    starter: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    professional: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    enterprise: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

// Paket anahtarları veritabanında bu adlarla duruyor; adı sözlük verir.
const PLAN_KEYS = ['trial', 'starter', 'professional', 'enterprise'] as const;

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

interface Nobetci {
    seviye: 'iyi' | 'uyari' | 'kritik';
    kritikSayisi: number;
    uyariSayisi: number;
    kontroller: { ad: KontrolAdi; seviye: string; mesajKod: MesajKod; nedenKod?: NedenKod }[];
}

export default function SuperAdminDashboard() {
    const sz = useT();
    const b = useBicim();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [nobetci, setNobetci] = useState<Nobetci | null>(null);

    useEffect(() => {
        fetch('/api/super-admin/dashboard')
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
        // Sistem durumu ayrı çekilir: kontroller birkaç saniye sürebilir,
        // panelin geri kalanını bekletmesin.
        fetch('/api/super-admin/nobetci').then(r => r.json()).then(setNobetci).catch(() => {});
    }, []);

    if (loading) return (
        <div className="flex items-center justify-center h-screen">
            <RefreshCw className="w-8 h-8 animate-spin text-violet-400" />
        </div>
    );
    if (!data) return null;

    const p = sz.superAdmin.panel;
    const stats = [
        { icon: Building2, label: p.toplamIsletme, value: data.totalTenants, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
        { icon: CheckCircle, label: p.aktif, value: data.activeTenants, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
        { icon: Clock, label: p.deneme, value: data.trialTenants, color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' },
        { icon: AlertTriangle, label: p.askida, value: data.suspendedTenants, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
        { icon: TrendingUp, label: p.buAyYeni, value: data.newThisMonth, color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/20' },
        { icon: Clock, label: p.bitiyor, value: data.expiringSoon, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
        { icon: Receipt, label: p.gecikmisFatura, value: data.overdueInvoices, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
        // Platform geliri ₺: abonelik fiyatları TL cinsinden sabit.
        { icon: Receipt, label: p.buAyTahsilat, value: b.para(data.monthlyRevenue || 0), color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
    ];

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-900/40 to-purple-900/40 border-b border-white/10 px-6 py-5">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">{p.baslik}</h1>
                        <p className="text-gray-400 text-sm mt-1">{p.alt}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Landing formundan gelen talepler — CRM bağlı olmasa da burada birikir */}
                        <Link href="/super-admin/talepler"
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-medium transition-all">
                            📥 {p.talepler}
                        </Link>
                        <Link href="/super-admin/audit"
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-medium transition-all">
                            🛡 {p.denetim}
                        </Link>
                        <Link href="/super-admin/geri-yukle"
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-medium transition-all">
                            ♻ {p.geriYukle}
                        </Link>
                        <Link href="/super-admin/tenants/new"
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-medium transition-all">
                            + {p.yeniIsletme}
                        </Link>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6">
                {/* ── SİSTEM DURUMU ──────────────────────────────────────────────
                    Çöken sistem kolay fark edilir; asıl tehlike SESSİZ arızadır:
                    cron durur, webhook susar, kuyruk birikir — hata vermez,
                    sadece olmaz. Her şey yolundayken tek satır kalır, karışıklık
                    yaratmaz; sorun varsa ilk göze çarpan şey olur. */}
                {nobetci && (
                    <div className={`rounded-xl border p-4 mb-6 ${nobetci.seviye === 'kritik'
                        ? 'bg-red-500/10 border-red-500/30'
                        : nobetci.seviye === 'uyari' ? 'bg-amber-500/10 border-amber-500/30'
                            : 'bg-green-500/[0.07] border-green-500/20'}`}>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                                {nobetci.seviye === 'iyi'
                                    ? <CheckCircle className="w-4 h-4 text-green-400" />
                                    : <AlertTriangle className={`w-4 h-4 ${nobetci.seviye === 'kritik' ? 'text-red-400' : 'text-amber-400'}`} />}
                                <span className="text-sm font-semibold">
                                    {sz.nobetci.baslik} — {nobetciOzeti(sz, nobetci.kritikSayisi, nobetci.uyariSayisi)}
                                </span>
                            </div>
                            <span className="text-[11px] text-gray-400">
                                {doldur(sz.nobetci.kontrolSayisi, { n: nobetci.kontroller.length })}
                            </span>
                        </div>
                        {/* HANGİ VERİTABANI — her şey yolundayken bile görünür.
                            "Veritabanı bağlı mı, doğru olanı mı?" sorusu bugüne
                            kadar ancak sunucu terminaline girilerek cevaplanıyordu.
                            Sorun yokken de görünmesi gerekiyor: sessiz arıza tam da
                            hiçbir şey kırmadan yanlış veritabanına bağlı kalmaktır.
                            Parola yazılmaz. */}
                        {(() => {
                            const db = nobetci.kontroller.find(k => k.ad === 'VERITABANI');
                            // Sorunluysa zaten aşağıdaki listede nedeniyle çıkıyor.
                            return db && db.seviye === 'iyi' ? (
                                <div className="mt-2 text-[11px] text-gray-400 font-mono break-all">
                                    {sz.nobetci.veritabaniSatiri} — {kontrolMesaji(sz, db.mesajKod)}
                                </div>
                            ) : null;
                        })()}
                        {nobetci.seviye !== 'iyi' && (
                            <ul className="mt-3 space-y-2">
                                {nobetci.kontroller.filter(k => k.seviye !== 'iyi').map(k => (
                                    <li key={k.ad} className="text-xs">
                                        <span className={k.seviye === 'kritik' ? 'text-red-300' : 'text-amber-300'}>
                                            {kontrolAdi(sz, k.ad)}:
                                        </span>{' '}
                                        <span className="text-gray-300">{kontrolMesaji(sz, k.mesajKod)}</span>
                                        {k.nedenKod && <div className="text-gray-500 mt-0.5 ml-1">→ {kontrolNedeni(sz, k.nedenKod)}</div>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

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
                            {p.paketDagilimi}
                        </h3>
                        <div className="space-y-3">
                            {PLAN_KEYS.map((key) => {
                                const label = sz.superAdmin.paket[key];
                                const count = data.planCounts[key] || 0;
                                const total = Object.values(data.planCounts).reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                                return (
                                    <div key={key}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-gray-400">{label}</span>
                                            <span className="font-semibold">{count} ({b.yuzde(pct)})</span>
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
                            {p.sonIsletmeler}
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
                                            {sz.superAdmin.paket[t.plan as keyof typeof sz.superAdmin.paket] || t.plan}
                                        </span>
                                        {t.isSuspended ? (
                                            <span className="text-xs text-red-400">{p.askida}</span>
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
                            {p.tumIsletmeler}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
