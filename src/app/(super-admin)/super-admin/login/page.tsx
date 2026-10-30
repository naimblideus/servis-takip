'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { useT } from '@/lib/i18n/client';

/** Uç noktanın döndürdüğü hata kodları — cümleyi ekran kurar. */
type GirisHatasi = 'ALAN_EKSIK' | 'TOTP_HATALI' | 'KIMLIK_HATALI' | 'SUNUCU_HATASI' | 'COK_DENEME';

export default function SuperAdminLoginPage() {
    const router = useRouter();
    const sz = useT();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [hata, setHata] = useState<GirisHatasi | ''>('');
    // 2FA açıksa sunucu needsTotp döner; kod alanı ancak O ZAMAN açılır.
    const [totp, setTotp] = useState('');
    const [needsTotp, setNeedsTotp] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setHata('');
        try {
            const res = await fetch('/api/super-admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, totp: totp.trim() }),
            });
            const data = await res.json();
            if (res.ok) {
                router.push('/super-admin/dashboard');
            } else {
                if (data.needsTotp) setNeedsTotp(true);
                // İlk kez kod isteniyorsa hata gösterme — kullanıcı henüz yanlış
                // bir şey yapmadı, sadece ikinci adım gerekiyor.
                setHata(data.hata || (data.needsTotp ? '' : 'KIMLIK_HATALI'));
            }
        } catch {
            // Sunucu yeniden başlarken cevap gelmez ya da JSON değildir (vekil
            // hata sayfası). Eskiden burada hiçbir şey yazmıyordu: düğme
            // dönüp duruyor, kullanıcı şifresini yanlış sanıyordu.
            setHata('SUNUCU_HATASI');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mb-4">
                        <Shield className="w-8 h-8 text-gray-900" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">{sz.superAdmin.girisBaslik}</h1>
                    <p className="text-gray-500 text-sm mt-1">{sz.superAdmin.altBaslik}</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
                    {hata && (
                        <div className="bg-red-100 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                            {sz.superAdmin.girisHata[hata]}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs text-gray-500 mb-1.5">{sz.superAdmin.eposta}</label>
                        <input
                            type="text"
                            autoComplete="username"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-all"
                            placeholder="admin@example.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1.5">{sz.giris.sifre}</label>
                        <div className="relative">
                            <input
                                type={showPass ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full px-4 py-3 pr-12 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-all"
                                placeholder="••••••••"
                                required
                            />
                            <button type="button" onClick={() => setShowPass(!showPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">
                                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {needsTotp && (
                        <div className="rounded-xl border border-gray-200 bg-white p-4">
                            <label className="block text-xs text-gray-700 mb-1.5">{sz.giris.dogrulamaKodu}</label>
                            <input
                                type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus
                                value={totp} onChange={e => setTotp(e.target.value)} maxLength={13}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-center font-mono text-lg tracking-[0.4em] focus:outline-none focus:border-blue-500"
                                placeholder="000000"
                            />
                            <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                                {sz.giris.dogrulamaAciklamaOn}{' '}
                                <b className="text-gray-500">{sz.giris.dogrulamaAciklamaVurgu}</b>{' '}
                                {sz.giris.dogrulamaAciklamaSon}
                            </p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-500 text-sm font-semibold transition-all disabled:opacity-50"
                    >
                        {loading ? sz.giris.giriliyor : needsTotp ? sz.giris.dogrulaVeGir : sz.giris.gir}
                    </button>
                </form>

                <p className="text-center text-sm mt-4">
                    <a href="/super-admin/sifre-kurtar" className="text-blue-700 hover:text-blue-900">{sz.superAdmin.kurtar.bagla}</a>
                </p>
                <p className="text-center text-xs text-gray-400 mt-3">
                    <a href="/login" className="hover:text-gray-700">← {sz.superAdmin.normalGiris}</a>
                </p>
            </div>
        </div>
    );
}
