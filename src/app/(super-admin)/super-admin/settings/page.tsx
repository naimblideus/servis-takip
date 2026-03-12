'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw } from 'lucide-react';

export default function PlatformSettingsPage() {
    const [settings, setSettings] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        fetch('/api/super-admin/settings').then(r => r.json()).then(setSettings);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        await fetch('/api/super-admin/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
        });
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const set = (k: string, v: any) => setSettings((p: any) => ({ ...p, [k]: v }));

    if (!settings) return <div className="flex items-center justify-center h-screen"><RefreshCw className="w-7 h-7 animate-spin text-violet-400" /></div>;

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <div className="bg-gradient-to-r from-violet-900/40 to-purple-900/40 border-b border-white/10 px-6 py-5">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <h1 className="text-xl font-bold flex items-center gap-3">
                        <Settings className="w-5 h-5 text-violet-400" />
                        Platform Ayarları
                    </h1>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm disabled:opacity-50">
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saved ? '✓ Kaydedildi' : 'Kaydet'}
                    </button>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">
                {/* Genel */}
                <div className="bg-white/3 border border-white/10 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-violet-300 mb-4">⚙️ Genel</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">Platform Adı</label>
                            <input value={settings.platformName || ''} onChange={e => set('platformName', e.target.value)}
                                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">İletişim E-postası</label>
                            <input value={settings.contactEmail || ''} onChange={e => set('contactEmail', e.target.value)} type="email"
                                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">Varsayılan Deneme Süresi (gün)</label>
                            <input value={settings.defaultTrialDays || 14} onChange={e => set('defaultTrialDays', parseInt(e.target.value))} type="number" min={1} max={90}
                                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500" />
                        </div>
                    </div>
                </div>

                {/* Bakım Modu */}
                <div className="bg-white/3 border border-white/10 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-violet-300 mb-4">🔧 Bakım Modu</h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm">Bakım Modu</div>
                            <div className="text-xs text-gray-400">Açıkken tüm tenant panelleri bakımda mesajı gösterir</div>
                        </div>
                        <button onClick={() => set('maintenanceMode', !settings.maintenanceMode)}
                            className={`relative w-12 h-6 rounded-full transition-all ${settings.maintenanceMode ? 'bg-red-500' : 'bg-gray-600'}`}>
                            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.maintenanceMode ? 'left-6' : 'left-0.5'}`} />
                        </button>
                    </div>
                </div>

                {/* Duyuru */}
                <div className="bg-white/3 border border-white/10 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-violet-300 mb-4">📢 Duyuru (Tenant Panellerinde Görünür)</h3>
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-sm">Duyuru Aktif</label>
                        <button onClick={() => set('announcementActive', !settings.announcementActive)}
                            className={`relative w-12 h-6 rounded-full transition-all ${settings.announcementActive ? 'bg-violet-500' : 'bg-gray-600'}`}>
                            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.announcementActive ? 'left-6' : 'left-0.5'}`} />
                        </button>
                    </div>
                    <textarea value={settings.announcementText || ''} onChange={e => set('announcementText', e.target.value)}
                        rows={3} placeholder="Duyuru metni..."
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-violet-500 resize-none" />
                </div>
            </div>
        </div>
    );
}
