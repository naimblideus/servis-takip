'use client';

import { useState, useEffect } from 'react';
import { Building2, ArrowLeft, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

const BIZ_TYPES = [
    { value: 'general', label: 'Genel' }, { value: 'electronic', label: 'Elektronik' },
    { value: 'computer', label: 'Bilgisayar' }, { value: 'phone', label: 'Telefon' },
    { value: 'appliance', label: 'Ev Aletleri' }, { value: 'hvac', label: 'İklimlendirme' },
    { value: 'medical', label: 'Medikal' },
];

const PLANS = [
    { value: 'trial', label: 'Deneme' }, { value: 'starter', label: 'Başlangıç — ₺299/ay' },
    { value: 'professional', label: 'Profesyonel — ₺599/ay' }, { value: 'enterprise', label: 'Kurumsal — ₺1499/ay' },
];

export default function NewTenantPage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [created, setCreated] = useState<{ tempPassword: string; adminEmail: string } | null>(null);
    const [form, setForm] = useState({
        name: '', slug: '', ownerName: '', phone: '', email: '',
        taxNumber: '', taxOffice: '', address: '', city: '', district: '',
        businessType: 'general', plan: 'trial', trialDays: 14, maxUsers: 2, adminNotes: '',
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
                alert(data.error || 'Hata oluştu');
            }
        } finally {
            setSaving(false);
        }
    };

    if (created) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
                <div className="bg-gray-900 border border-green-500/30 rounded-2xl p-8 max-w-md w-full text-center">
                    <div className="text-4xl mb-4">✅</div>
                    <h2 className="text-xl font-bold text-green-400 mb-2">İşletme Oluşturuldu!</h2>
                    <p className="text-gray-400 text-sm mb-6">Aşağıdaki bilgileri işletme yetkilisiyle paylaşın.</p>
                    <div className="bg-black/30 border border-white/10 rounded-xl p-4 text-left space-y-2 text-sm mb-6">
                        <div><span className="text-gray-400">E-posta:</span> <span className="font-mono text-blue-300">{created.adminEmail}</span></div>
                        <div><span className="text-gray-400">Geçici Şifre:</span> <span className="font-mono text-amber-300 text-lg font-bold">{created.tempPassword}</span></div>
                        <div><span className="text-gray-400">Giriş URL:</span> <span className="font-mono text-xs text-gray-300">{typeof window !== 'undefined' ? window.location.origin : ''}/login</span></div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => { setCreated(null); setForm({ name: '', slug: '', ownerName: '', phone: '', email: '', taxNumber: '', taxOffice: '', address: '', city: '', district: '', businessType: 'general', plan: 'trial', trialDays: 14, maxUsers: 2, adminNotes: '' }); }}
                            className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm">Yeni İşletme</button>
                        <button onClick={() => router.push('/super-admin/tenants')}
                            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm">İşletme Listesi</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <div className="bg-gradient-to-r from-violet-900/40 to-purple-900/40 border-b border-white/10 px-6 py-5">
                <div className="max-w-3xl mx-auto flex items-center gap-3">
                    <a href="/super-admin/tenants" className="p-2 hover:bg-white/10 rounded-xl">
                        <ArrowLeft className="w-4 h-4" />
                    </a>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-violet-400" />
                            Yeni İşletme Ekle
                        </h1>
                        <p className="text-gray-400 text-xs mt-0.5">Yeni işletme ve admin kullanıcısı oluştur</p>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-6 py-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Temel Bilgiler */}
                    <div className="bg-white/3 border border-white/10 rounded-2xl p-5">
                        <h3 className="text-sm font-semibold text-violet-300 mb-4">🏢 İşletme Bilgileri</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="text-xs text-gray-400 mb-1 block">İşletme Adı *</label>
                                <input value={form.name} onChange={e => set('name', e.target.value)} required
                                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">Slug / URL</label>
                                <input value={form.slug} onChange={e => set('slug', e.target.value)}
                                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-mono focus:outline-none focus:border-violet-500" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">Sektör</label>
                                <select value={form.businessType} onChange={e => set('businessType', e.target.value)}
                                    className="w-full px-3 py-2.5 bg-gray-900 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500">
                                    {BIZ_TYPES.map(b => <option key={b.value} value={b.value} className="bg-gray-900">{b.label}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Yetkili Kişi */}
                    <div className="bg-white/3 border border-white/10 rounded-2xl p-5">
                        <h3 className="text-sm font-semibold text-violet-300 mb-4">👤 Yetkili Bilgileri</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">Ad Soyad *</label>
                                <input value={form.ownerName} onChange={e => set('ownerName', e.target.value)} required
                                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">Telefon *</label>
                                <input value={form.phone} onChange={e => set('phone', e.target.value)} required type="tel"
                                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs text-gray-400 mb-1 block">E-posta (giriş bilgisi) *</label>
                                <input value={form.email} onChange={e => set('email', e.target.value)} required type="email"
                                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">Vergi No</label>
                                <input value={form.taxNumber} onChange={e => set('taxNumber', e.target.value)}
                                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">Vergi Dairesi</label>
                                <input value={form.taxOffice} onChange={e => set('taxOffice', e.target.value)}
                                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">İl</label>
                                <input value={form.city} onChange={e => set('city', e.target.value)}
                                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">İlçe</label>
                                <input value={form.district} onChange={e => set('district', e.target.value)}
                                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500" />
                            </div>
                        </div>
                    </div>

                    {/* Abonelik */}
                    <div className="bg-white/3 border border-white/10 rounded-2xl p-5">
                        <h3 className="text-sm font-semibold text-violet-300 mb-4">📦 Abonelik</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">Paket</label>
                                <select value={form.plan} onChange={e => set('plan', e.target.value)}
                                    className="w-full px-3 py-2.5 bg-gray-900 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500">
                                    {PLANS.map(p => <option key={p.value} value={p.value} className="bg-gray-900">{p.label}</option>)}
                                </select>
                            </div>
                            {form.plan === 'trial' && (
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">Deneme Süresi (gün)</label>
                                    <input type="number" value={form.trialDays} onChange={e => set('trialDays', parseInt(e.target.value))}
                                        min={1} max={90}
                                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500" />
                                </div>
                            )}
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">Maks. Kullanıcı</label>
                                <input type="number" value={form.maxUsers} onChange={e => set('maxUsers', parseInt(e.target.value))} min={1}
                                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500" />
                            </div>
                        </div>
                    </div>

                    {/* Notlar */}
                    <div className="bg-white/3 border border-white/10 rounded-2xl p-5">
                        <h3 className="text-sm font-semibold text-violet-300 mb-3">📝 Süper Admin Notu</h3>
                        <textarea value={form.adminNotes} onChange={e => set('adminNotes', e.target.value)}
                            rows={3} placeholder="İsteğe bağlı not..."
                            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500 resize-none" />
                    </div>

                    <div className="flex gap-3">
                        <a href="/super-admin/tenants" className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-center">
                            İptal
                        </a>
                        <button type="submit" disabled={saving}
                            className="flex-1 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                            {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                            {saving ? 'Oluşturuluyor...' : 'İşletme Oluştur'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
