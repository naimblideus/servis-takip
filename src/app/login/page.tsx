'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// Landing'deki "Demoyu Dene" buraya /login?demo=1 ile gelir. Bilgiler ÖRNEK VERİLİ
// demo hesabına aittir (scripts/seed-demo.mjs) — gerçek bir bayinin hesabı DEĞİLDİR.
const DEMO_EPOSTA = 'demo@nextusservis.com';
const DEMO_SIFRE = 'demo1234';

/**
 * Sağ paneldeki kutular — landing ile AYNI dürüstlük çizgisi.
 * Uydurma oran, yıldız puanı ya da müşteri sayısı YOK; hepsi ürünün
 * gerçekten yaptığı işler. Sayı vermek yerine yetenek anlatıyoruz.
 */
const OZELLIKLER = [
  { ust: '3 kanal', alt: 'Sayaç: cihaz e-postası, WhatsApp fotoğrafı, saha turu' },
  { ust: 'Otomatik', alt: 'Sayaçtan faturaya, faturadan cariye' },
  { ust: 'Tek tuş', alt: 'Verinizi istediğiniz an dışa aktarın' },
  { ust: 'Kurulum', alt: 'Excel aktarımı ve eğitim bizden' },
];

/** Marka işareti — landing'deki N monogramının aynısı (nexus-video kaynağından). */
function Monogram({ size = 34 }: { size?: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="inline-flex items-center justify-center rounded-[10px] border border-white/10 bg-gradient-to-br from-[#161c28] to-[#0a0e16]"
    >
      <svg viewBox="0 0 230 200" aria-hidden="true" style={{ width: '70%', height: '70%', overflow: 'visible' }}>
        <g fill="#e6ecf5">
          <rect x="30" y="20" width="38" height="160" />
          <polygon points="68,20 106,20 150,180 112,180" />
          <rect x="150" y="20" width="38" height="160" />
        </g>
        <path d="M14 154 C84 120 152 78 224 34" stroke="#0d121c" strokeWidth="13" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [totp, setTotp] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [demoMod, setDemoMod] = useState(false);
  const [sifreGoster, setSifreGoster] = useState(false);

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
      email, password, totp: totp.trim(), redirect: false,
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

  const alan =
    'w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[15px] text-white ' +
    'placeholder:text-white/25 outline-none transition focus:border-teal-500/60 focus:bg-white/[0.06]';

  return (
    // Landing ile aynı dil: neredeyse siyah zemin, TEK vurgu rengi (teal),
    // gradyan yazı yok, renkli parıltı yok. Süs değil ölçü.
    <div className="min-h-screen bg-[#050508] text-white lg:grid lg:grid-cols-[1fr_1fr]">
      {/* ── SOL: giriş ── */}
      <div className="relative flex min-h-screen flex-col justify-center px-6 py-12 sm:px-12 lg:min-h-0 lg:px-16">
        <a
          href="/?demo=1#fiyat"
          className="absolute right-6 top-6 rounded-full border border-white/12 px-4 py-2 text-[13px] font-medium text-white/70 transition hover:border-white/25 hover:text-white sm:right-12"
        >
          Fiyatlar
        </a>

        <div className="mx-auto w-full max-w-[380px]">
          <div className="mb-10 flex items-center gap-3">
            <Monogram />
            <span className="text-[19px] font-bold tracking-tight">Nextus Servis</span>
          </div>

          <h1 className="text-[30px] font-bold leading-tight tracking-tight">
            {demoMod ? 'Demo hesabı hazır' : 'Tekrar hoş geldiniz'}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-white/45">
            {demoMod
              ? 'Bilgiler dolduruldu — Giriş Yap’a basmanız yeterli.'
              : 'Servis ve sayaç panelinize erişmek için giriş yapın.'}
          </p>

          {/* Demo uyarısı: ziyaretçi gördüğü rakamları gerçek sanmasın */}
          {demoMod && (
            <div className="mt-5 rounded-xl border border-teal-500/25 bg-teal-500/[0.07] px-4 py-3">
              <p className="text-[13px] leading-relaxed text-teal-100/85">
                Bu hesaptaki tüm firma isimleri ve rakamlar <b className="text-teal-50">örnektir</b>.
                Dilediğiniz gibi gezebilir, kayıt ekleyip silebilirsiniz.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="eposta" className="mb-2 block text-[13px] font-medium text-white/60">E-posta adresi</label>
              <input id="eposta" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className={alan} placeholder="ad@firma.com" autoComplete="email" required />
            </div>

            <div>
              <label htmlFor="sifre" className="mb-2 block text-[13px] font-medium text-white/60">Şifre</label>
              <div className="relative">
                <input id="sifre" type={sifreGoster ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={alan + ' pr-12'} placeholder="••••••••" autoComplete="current-password" required />
                <button type="button" onClick={() => setSifreGoster(!sifreGoster)}
                  aria-label={sifreGoster ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/35 transition hover:text-white/70">
                  {sifreGoster ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
            </div>

            {needsTotp && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <label htmlFor="kod" className="mb-2 block text-[13px] font-medium text-white/70">Doğrulama kodu</label>
                <input id="kod" type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus
                  value={totp} onChange={(e) => setTotp(e.target.value)} maxLength={13}
                  className={alan + ' text-center font-mono text-lg tracking-[0.4em]'} placeholder="000000" />
                <p className="mt-2 text-[12px] leading-relaxed text-white/40">
                  Telefonunuzdaki doğrulama uygulamasındaki 6 haneli kod. Telefonunuz
                  yanınızda değilse <b className="text-white/60">kurtarma kodlarından</b> birini yazabilirsiniz.
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-[13px] text-red-200">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-teal-500 py-3.5 text-[15px] font-bold text-[#04121a] transition hover:bg-teal-400 disabled:opacity-50">
              {loading ? 'Giriş yapılıyor…' : needsTotp ? 'Doğrula ve gir' : 'Giriş yap'}
            </button>
          </form>

          <a href="/" className="mt-8 block text-center text-[13px] text-white/35 transition hover:text-white/70">
            ← Ana sayfaya dön
          </a>
        </div>
      </div>

      {/* ── SAĞ: marka paneli (mobilde gizli — girişin önüne geçmesin) ── */}
      <div className="relative hidden overflow-hidden bg-[#071a1c] lg:flex lg:flex-col lg:justify-center lg:px-16">
        {/* İnce ızgara dokusu: düz zemin yerine derinlik, ama parıltı yok */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.055]"
          style={{
            backgroundImage: 'linear-gradient(#5eead4 1px,transparent 1px),linear-gradient(90deg,#5eead4 1px,transparent 1px)',
            backgroundSize: '44px 44px',
          }} />

        <div className="relative max-w-[460px]">
          <h2 className="text-[34px] font-bold leading-[1.2] tracking-tight">
            Kiralık cihaz servisini<br />tek yerden yönetin
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/50">
            Sayaç okumadan faturaya, servis fişinden tahsilata kadar tüm akış
            burada. Okunmayan sayaç, kesilmeyen fatura kalmaz.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-3">
            {OZELLIKLER.map((o) => (
              <div key={o.ust} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                <div className="text-[20px] font-bold tracking-tight text-teal-300">{o.ust}</div>
                <div className="mt-1.5 text-[13px] leading-snug text-white/45">{o.alt}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
