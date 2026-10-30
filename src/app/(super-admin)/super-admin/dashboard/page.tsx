'use client';

import { useState, useEffect } from 'react';
import { Building2, AlertTriangle, CheckCircle, Package, Plus, ClipboardCheck, Store, Share2, LifeBuoy, Plug } from 'lucide-react';
import Link from 'next/link';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { kontrolAdi, kontrolMesaji, kontrolNedeni, nobetciOzeti, type KontrolAdi, type MesajKod, type NedenKod } from '@/lib/nobetci-metin';

const PLAN_COLORS: Record<string, string> = {
    trial: 'bg-gray-100 text-gray-600',
    starter: 'bg-blue-50 text-blue-700',
    professional: 'bg-blue-100 text-blue-800',
    enterprise: 'bg-gray-900 text-white',
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
    baglanti?: {
        magaza: { kurulu: number; yayinda: number } | null;
        magazaTalebi: number;
        paylasim: number;
        adli: number;
        acikSorun: number;
        durduran: number;
        crm: { bagli: boolean; hata: number };
        kurulum: { toplam: number; hazir: number; bugun: number } | null;
    };
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

    const p = sz.superAdmin.panel;

    if (loading) return (
        // Yükleme: düzenin kendi ölçülerinde iskelet, halka değil.
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6" aria-busy="true">
            <div className="h-8 w-56 rounded-lg bg-gray-200 animate-pulse mb-6" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-200 rounded-xl overflow-hidden">
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-20 bg-white animate-pulse" />)}
            </div>
        </div>
    );
    if (!data) return null;

    // Sayılar tek renk; yalnız gerçekten dikkat isteyen sayı kırmızı/turuncu.
    const stats: { label: string; value: string | number; ton?: string }[] = [
        { label: p.toplamIsletme, value: data.totalTenants },
        { label: p.aktif, value: data.activeTenants },
        { label: p.deneme, value: data.trialTenants },
        { label: p.askida, value: data.suspendedTenants, ton: data.suspendedTenants > 0 ? 'text-red-700' : undefined },
        { label: p.buAyYeni, value: data.newThisMonth },
        { label: p.bitiyor, value: data.expiringSoon, ton: data.expiringSoon > 0 ? 'text-orange-600' : undefined },
        { label: p.gecikmisFatura, value: data.overdueInvoices, ton: data.overdueInvoices > 0 ? 'text-red-700' : undefined },
        // Platform geliri ₺: abonelik fiyatları TL cinsinden sabit.
        { label: p.buAyTahsilat, value: b.para(data.monthlyRevenue || 0), ton: 'text-emerald-700' },
    ];

    // BAYİ PANELİNDEN GELENLER — Mağaza, Kurulum, Sorun bildir, paylaşım, CRM.
    // Her kutu kendi ekranına götürür; sayı yoksa (ör. mağaza şeması yok) "—".
    const bg = data.baglanti;
    const baglantilar = bg ? [
        {
            href: '/super-admin/kurulum', ikon: ClipboardCheck, label: p.kurulumTamam,
            value: bg.kurulum ? `${bg.kurulum.hazir}` : '—',
            alt: bg.kurulum ? doldur(p.kurulumAlt, { n: bg.kurulum.toplam, a: bg.kurulum.bugun }) : '',
            ton: undefined,
        },
        {
            href: '/super-admin/talepler?kaynak=magaza', ikon: Store, label: p.magazaKurulu,
            value: bg.magaza ? `${bg.magaza.kurulu}` : '—',
            alt: doldur(p.magazaAlt, { n: bg.magaza?.yayinda ?? 0, t: bg.magazaTalebi }),
            ton: undefined,
        },
        {
            href: '/super-admin/distributor', ikon: Share2, label: p.paylasimAcik,
            value: `${bg.paylasim}`,
            alt: doldur(p.paylasimAlt, { n: bg.adli }),
            ton: undefined,
        },
        {
            href: '/super-admin/sorunlar', ikon: LifeBuoy, label: p.acikSorun,
            value: `${bg.acikSorun}`,
            alt: doldur(p.acikSorunAlt, { n: bg.durduran }),
            ton: bg.durduran > 0 ? 'text-red-700' : undefined,
        },
        {
            href: '/super-admin/talepler', ikon: Plug, label: p.crmBaslik,
            value: bg.crm.bagli ? p.crmBagli : p.crmBagliDegil,
            alt: !bg.crm.bagli ? p.crmAltYok : bg.crm.hata > 0 ? doldur(p.crmAlt, { n: bg.crm.hata }) : p.crmAltTamam,
            ton: !bg.crm.bagli || bg.crm.hata > 0 ? 'text-orange-600' : 'text-emerald-700',
        },
    ] : [];

    return (
        <div className="min-h-full">
            {/* Başlık */}
            <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-5">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{p.baslik}</h1>
                        <p className="text-gray-500 text-sm mt-1">{p.alt}</p>
                    </div>
                    <Link href="/super-admin/tenants/new"
                        className="inline-flex items-center gap-2 min-h-11 px-5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 text-sm font-semibold transition-colors">
                        <Plus className="w-4 h-4" /> {p.yeniIsletme}
                    </Link>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                {/* ── SİSTEM DURUMU ──────────────────────────────────────────────
                    Çöken sistem kolay fark edilir; asıl tehlike SESSİZ arızadır:
                    cron durur, webhook susar, kuyruk birikir — hata vermez,
                    sadece olmaz. Her şey yolundayken tek satır kalır, karışıklık
                    yaratmaz; sorun varsa ilk göze çarpan şey olur. */}
                {nobetci && (
                    <div className={`rounded-xl border p-4 ${nobetci.seviye === 'kritik'
                        ? 'bg-red-50 border-red-200'
                        : nobetci.seviye === 'uyari' ? 'bg-amber-50 border-amber-200'
                            : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                                {nobetci.seviye === 'iyi'
                                    ? <CheckCircle className="w-4 h-4 text-emerald-600" />
                                    : <AlertTriangle className={`w-4 h-4 ${nobetci.seviye === 'kritik' ? 'text-red-600' : 'text-amber-600'}`} />}
                                <span className="text-sm font-semibold">
                                    {sz.nobetci.baslik} — {nobetciOzeti(sz, nobetci.kritikSayisi, nobetci.uyariSayisi)}
                                </span>
                            </div>
                            <span className="text-xs text-gray-500">
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
                                <div className="mt-2 text-xs text-gray-500 font-mono break-all">
                                    {sz.nobetci.veritabaniSatiri} — {kontrolMesaji(sz, db.mesajKod)}
                                </div>
                            ) : null;
                        })()}
                        {nobetci.seviye !== 'iyi' && (
                            <ul className="mt-3 space-y-2">
                                {nobetci.kontroller.filter(k => k.seviye !== 'iyi').map(k => (
                                    <li key={k.ad} className="text-xs">
                                        <span className={`font-semibold ${k.seviye === 'kritik' ? 'text-red-700' : 'text-amber-800'}`}>
                                            {kontrolAdi(sz, k.ad)}:
                                        </span>{' '}
                                        <span className="text-gray-700">{kontrolMesaji(sz, k.mesajKod)}</span>
                                        {k.nedenKod && <div className="text-gray-500 mt-0.5 ml-1">→ {kontrolNedeni(sz, k.nedenKod)}</div>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {/* Sayılar — tek ızgara, ayraçla bölünmüş; kart içinde kart yok */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-200 border border-gray-200 rounded-xl overflow-hidden">
                    {stats.map(s => (
                        <div key={s.label} className="bg-white px-4 py-4">
                            <div className={`text-2xl font-semibold font-mono tabular-nums ${s.ton ?? 'text-gray-900'}`}>{s.value}</div>
                            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Bayi panelinden gelenler */}
                {baglantilar.length > 0 && (
                    <section>
                        <h2 className="text-sm font-semibold text-gray-900 mb-3">{p.baglantiBaslik}</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                            {baglantilar.map(k => (
                                <Link key={k.label} href={k.href}
                                    className="group rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                                        <k.ikon className="w-4 h-4" />{k.label}
                                    </div>
                                    <div className={`mt-2 text-xl font-semibold font-mono tabular-nums ${k.ton ?? 'text-gray-900'}`}>{k.value}</div>
                                    {k.alt && <div className="mt-1 text-xs text-gray-500">{k.alt}</div>}
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* Paket Dağılımı + Son İşletmeler */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-white border border-gray-200 rounded-xl p-5">
                        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-500" />
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
                                            <span className="text-gray-600">{label}</span>
                                            <span className="font-semibold font-mono tabular-nums">{count} ({b.yuzde(pct)})</span>
                                        </div>
                                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-500" />
                            {p.sonIsletmeler}
                        </h3>
                        <div className="divide-y divide-gray-100">
                            {(data.recentTenants || []).map(t => (
                                <Link key={t.id} href={`/super-admin/tenants/${t.id}`}
                                    className="flex items-center justify-between gap-3 px-2 py-3 -mx-2 rounded-lg hover:bg-gray-50 transition-colors">
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium truncate">{t.name}</div>
                                        <div className="text-xs text-gray-500 truncate">{t.ownerName} {t.city ? `— ${t.city}` : ''}</div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className={`text-xs px-2 py-0.5 rounded-md ${PLAN_COLORS[t.plan] || PLAN_COLORS.trial}`}>
                                            {sz.superAdmin.paket[t.plan as keyof typeof sz.superAdmin.paket] || t.plan}
                                        </span>
                                        {t.isSuspended ? (
                                            <span className="text-xs text-red-700">{p.askida}</span>
                                        ) : (
                                            <span className={`w-2 h-2 rounded-full ${t.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                        <Link href="/super-admin/tenants" className="block text-center text-xs font-semibold text-blue-600 hover:underline underline-offset-4 mt-3">
                            {p.tumIsletmeler}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
