'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// Landing'deki "Demoyu Dene" buraya /login?demo=1 ile gelir. Bilgiler ÖRNEK VERİLİ
// demo hesabına aittir (scripts/seed-demo.mjs) — gerçek bir bayinin hesabı DEĞİLDİR.
const DEMO_EPOSTA = 'demo@nextusservis.com';
const DEMO_SIFRE = 'demo1234';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [totp, setTotp] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [demoMod, setDemoMod] = useState(false);

  // Demo bilgilerini DOLDUR ama KENDİLİĞİNDEN GİRME: ziyaretçi neye tıkladığını
  // görsün ve isterse başka bir hesapla girebilsin.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('demo') !== '1') return;
    setEmail(DEMO_EPOSTA);
    setPassword(DEMO_SIFRE);
    setDemoMod(true);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    // İki adımlı doğrulama açıksa önce kod alanını göster (şifre doğruysa)
    if (!needsTotp) {
      try {
        const r = await fetch('/api/auth/2fa/check', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const d = await r.json();
        if (d?.needsTotp) { setNeedsTotp(true); setLoading(false); return; }
      } catch { /* kontrol başarısızsa normal girişe devam et */ }
    }

    const result = await signIn('credentials', {
      email,
      password,
      totp: totp.trim(),
      redirect: false,
    });

    if (result?.error) {
      setError(needsTotp
        ? 'Doğrulama kodu hatalı veya süresi geçti. Uygulamadaki güncel kodu girin.'
        : 'E-posta veya şifre hatalı!');
      setLoading(false);
    } else {
      router.refresh();
      router.push('/dashboard');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Nextus Servis</h1>
          <p className="text-gray-500 text-sm mt-1">
            {demoMod ? 'Örnek verilerle hazırlanmış demo hesabı' : 'Hesabınıza giriş yapın'}
          </p>
        </div>

        {/* Demo uyarısı — ziyaretçi gördüğü rakamları gerçek sanmasın */}
        {demoMod && (
          <div className="mb-5 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
            <div className="text-sm font-semibold text-teal-900">Demo hesabı hazır</div>
            <p className="text-xs text-teal-800 mt-1 leading-relaxed">
              Bilgiler dolduruldu, <b>Giriş Yap</b>&apos;a basmanız yeterli. Bu hesaptaki
              tüm firma isimleri ve rakamlar <b>örnektir</b>; dilediğiniz gibi
              gezebilir, kayıt ekleyip silebilirsiniz.
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">E-posta</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="ornek@sirket.com"
              required
            />
          </div>

          <div>
            <label className="label">Şifre</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="••••••••"
              required
            />
          </div>

          {needsTotp && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <label className="label">🔐 Doğrulama Kodu</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={totp}
                onChange={(e) => setTotp(e.target.value)}
                className="input-field text-center tracking-[0.4em] font-mono text-lg"
                placeholder="000000"
                maxLength={13}
              />
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                Telefonundaki doğrulama uygulamasındaki 6 haneli kodu gir.
                Telefonun yanında değilse <b>kurtarma kodlarından</b> birini yazabilirsin.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 text-base"
          >
            {loading ? 'Giriş yapılıyor...' : needsTotp ? 'Doğrula ve Gir' : 'Giriş Yap'}
          </button>
        </form>


      </div>
    </div>
  );
}