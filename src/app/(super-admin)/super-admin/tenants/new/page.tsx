'use client';

import { useState, useEffect } from 'react';
import { Building2, ArrowLeft, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ALL_MODULE_KEYS, effectiveModules } from '@/lib/modules';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

// Hesap türü menüyü ve ana sayfayı belirler (lib/menu-aileleri). Eski "sektör"
// seçimi hiçbir yerde okunmuyordu; yerine bu geldi.
const TURLER = ['BAYI', 'MATBAA'] as const;
// Taban ücretler ₺ cinsinden sabit: abonelik fiyatı bayinin para biriminden
// bağımsızdır, platformun kendi fiyatıdır.
const PLAN_UCRET: Record<string, number | null> = {
    trial: null, starter: 1749, professional: 2099, enterprise: 5249,
};

export default function NewTenantPage() {
    const router = useRouter();
    const sz = useT();
    const b = useBicim();
    const y = sz.superAdmin.yeni;
    const [saving, setSaving] = useState(false);
    const [created, setCreated] = useState<{ tempPassword: string; adminEmail: string } | null>(null);
    const [form, setForm] = useState({
        name: '', slug: '', ownerName: '', phone: '', email: '',
        taxNumber: '', taxOffice: '', address: '', city: '', district: '',
        hesapTuru: 'BAYI', plan: 'trial', trialDays: 14, maxUsers: 2, adminNotes: '',
    });

    // Slug otomatik oluştur
    useEffect(() => {
        if (form.name && !form.slug) {
            const slug = form.name.toLowerCase()
                .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
                .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
                .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
            setForm(p => ({ ...p, slug }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.name]);

    const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch('/api/super-admin/tenants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (res.ok) {
                setCreated({ tempPassword: data.tempPassword, adminEmail: data.adminEmail });
            } else {
                alert(data.error || y.hata);
            }
        } finally {
            setSaving(false);
        }
    };

    if (created) {
        return (
            <div className="min-h-screen bg-gray-100 text-gray-900 flex items-center justify-center p-4">
                <div className="bg-white border border-green-200 rounded-2xl p-8 max-w-md w-full text-center">
                    <div className="text-4xl mb-4">✅</div>
                    <h2 className="text-xl font-bold text-green-700 mb-2">{y.olusturuldu}</h2>
                    <p className="text-gray-500 text-sm mb-6">{y.olusturulduAlt}</p>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left space-y-2 text-sm mb-6">
                        <div><span className="text-gray-500">{sz.superAdmin.eposta}:</span> <span className="font-mono text-blue-700">{created.adminEmail}</span></div>
                        <div><span className="text-gray-500">{y.gecici}</span> <span className="font-mono text-amber-700 text-lg font-bold">{created.tempPassword}</span></div>
                        <div><span className="text-gray-500">{y.girisUrl}</span> <span className="font-mono text-xs text-gray-700">{typeof window !== 'undefined' ? window.location.origin : ''}/login</span></div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => { setCreated(null); setForm({ name: '', slug: '', ownerName: '', phone: '', email: '', taxNumber: '', taxOffice: '', address: '', city: '', district: '', hesapTuru: 'BAYI', plan: 'trial', trialDays: 14, maxUsers: 2, adminNotes: '' }); }}
                            className="flex-1 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm">{y.yeniBir}</button>
                        <button onClick={() => router.push('/super-admin/tenants')}
                            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 text-sm">{y.liste}</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 text-gray-900">
            <div className="bg-white border-b border-gray-200 px-6 py-5">
                <div className="max-w-3xl mx-auto flex items-center gap-3">
                    <a href="/super-admin/tenants" className="p-2 hover:bg-gray-100 rounded-xl">
                        <ArrowLeft className="w-4 h-4" />
                    </a>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-blue-700" />
                            {y.baslik}
                        </h1>
                        <p className="text-gray-500 text-xs mt-0.5">{y.alt}</p>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-6 py-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Temel Bilgiler */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5">
                        <h3 className="text-sm font-semibold text-blue-700 mb-4">🏢 {y.bilgiler}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="text-xs text-gray-500 mb-1 block">{y.ad}</label>
                                <input value={form.name} onChange={e => set('name', e.target.value)} required
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">{y.slug}</label>
                                <input value={form.slug} onChange={e => set('slug', e.target.value)}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">{y.hesapTuru}</label>
                                <select value={form.hesapTuru} onChange={e => set('hesapTuru', e.target.value)}
                                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500">
                                    {TURLER.map(k => <option key={k} value={k} className="bg-white">{y.turler[k]}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Yetkili Kişi */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5">
                        <h3 className="text-sm font-semibold text-blue-700 mb-4">👤 {y.yetkiliBilgileri}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">{y.adSoyad}</label>
                                <input value={form.ownerName} onChange={e => set('ownerName', e.target.value)} required
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">{y.telefon}</label>
                                <input value={form.phone} onChange={e => set('phone', e.target.value)} required type="tel"
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs text-gray-500 mb-1 block">{y.epostaGiris}</label>
                                <input value={form.email} onChange={e => set('email', e.target.value)} required type="email"
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">{y.vergiNo}</label>
                                <input value={form.taxNumber} onChange={e => set('taxNumber', e.target.value)}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">{y.vergiDairesi}</label>
                                <input value={form.taxOffice} onChange={e => set('taxOffice', e.target.value)}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">{y.il}</label>
                                <input value={form.city} onChange={e => set('city', e.target.value)}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">{y.ilce}</label>
                                <input value={form.district} onChange={e => set('district', e.target.value)}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                        </div>
                    </div>

                    {/* Abonelik */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5">
                        <h3 className="text-sm font-semibold text-blue-700 mb-4">📦 {y.abonelik}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">{y.paket}</label>
                                <select value={form.plan} onChange={e => set('plan', e.target.value)}
                                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500">
                                    {(Object.keys(PLAN_UCRET) as (keyof typeof sz.superAdmin.paket)[]).map(k => (
                                        <option key={k} value={k} className="bg-white">
                                            {PLAN_UCRET[k] === null
                                                ? sz.superAdmin.paket[k]
                                                : doldur(y.paketAylik, { ad: sz.superAdmin.paket[k], tutar: b.para(PLAN_UCRET[k] as number, 0) })}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {form.plan === 'trial' && (
                                <div>
                                    <label className="text-xs text-gray-500 mb-1 block">{y.denemeSuresi}</label>
                                    <input type="number" value={form.trialDays} onChange={e => set('trialDays', parseInt(e.target.value))}
                                        min={1} max={90}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                                </div>
                            )}
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">{y.maksKullanici}</label>
                                <input type="number" value={form.maxUsers} onChange={e => set('maxUsers', parseInt(e.target.value))} min={1}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
                            </div>
                        </div>

                        {/* Bu paket hangi modülleri açıyor — seçim körlemesine yapılmasın.
                            Bayi açıldıktan sonra bayi detayından tek tek değiştirilebilir. */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="text-xs text-gray-500 mb-2">{y.modulBaslik}</div>
                            <div className="flex flex-wrap gap-1.5">
                                {ALL_MODULE_KEYS.map((k) => {
                                    const acik = effectiveModules({ plan: form.plan }).has(k);
                                    return (
                                        <span key={k} title={sz.modul.aciklama[k]}
                                            className={`text-[11px] px-2 py-1 rounded-lg border ${acik
                                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                : 'bg-gray-50 text-gray-500 border-gray-200 line-through'}`}>
                                            {sz.modul.ad[k]}
                                        </span>
                                    );
                                })}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-2">{y.cekirdekNot}</div>
                        </div>
                    </div>

                    {/* Notlar */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5">
                        <h3 className="text-sm font-semibold text-blue-700 mb-3">📝 {y.notBaslik}</h3>
                        <textarea value={form.adminNotes} onChange={e => set('adminNotes', e.target.value)}
                            rows={3} placeholder={y.notYer}
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 resize-none" />
                    </div>

                    <div className="flex gap-3">
                        <a href="/super-admin/tenants" className="flex-1 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-center">
                            {y.iptal}
                        </a>
                        <button type="submit" disabled={saving}
                            className="flex-1 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-500 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                            {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                            {saving ? y.olusturuluyor : y.olustur}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
