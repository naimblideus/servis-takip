'use client';

/**
 * YENİ ŞİFRE — e-postadaki tek kullanımlık bağlantı buraya açılır (?t=jeton).
 * Önce bağlantının geçerli olup olmadığı sorulur; geçersizse form hiç
 * gösterilmez, yeni bağlantı istemeye yönlendirilir. Şifre kaydedilince
 * yeni şifreyle hemen giriş yapılır.
 */
import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/client';
import DilSecici from '@/components/DilSecici';
import Monogram from '@/components/Monogram';

export default function SifreYenile() {
  const t = useT();
  const k = t.sifreSifirla;
  const router = useRouter();
  const [jeton, setJeton] = useState('');
  const [gecerli, setGecerli] = useState<boolean | null>(null);
  const [sifre, setSifre] = useState('');
  const [tekrar, setTekrar] = useState('');
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState('');
  const [bitti, setBitti] = useState(false);

  useEffect(() => {
    const j = new URLSearchParams(window.location.search).get('t') ?? '';
    setJeton(j);
    if (!j) { setGecerli(false); return; }
    fetch(`/api/sifre/yenile?t=${encodeURIComponent(j)}`).then((r) => r.json()).then((x) => setGecerli(Boolean(x.gecerli))).catch(() => setGecerli(false));
  }, []);

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    setHata('');
    if (sifre !== tekrar) { setHata(k.uyusmuyor); return; }
    setMesgul(true);
    const r = await fetch('/api/sifre/yenile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ t: jeton, sifre }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setHata(j.error ?? k.gecersiz);
      if (j.kod === 'SIFRE_BAGLANTI_GECERSIZ') setGecerli(false);
      setMesgul(false);
      return;
    }
    // Aynı adres birden çok bayide kullanıcıysa giriş birini seçer; olmazsa giriş sayfasına.
    const g = await signIn('credentials', { email: j.eposta, password: sifre, redirect: false });
    if (g?.error) { setBitti(true); setMesgul(false); return; }
    router.refresh();
    router.push('/dashboard');
  }

  const alan =
    'w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[15px] text-white ' +
    'placeholder:text-white/25 outline-none transition focus:border-teal-500/60 focus:bg-white/[0.06]';

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <div className="relative flex min-h-screen flex-col justify-center px-6 py-12 sm:px-12">
        <div className="absolute right-6 top-6 sm:right-12"><DilSecici /></div>
        <div className="mx-auto w-full max-w-[420px]">
          <a href="/" className="mb-8 flex items-center gap-3">
            <Monogram />
            <span className="text-[19px] font-bold tracking-tight">Nextus Servis</span>
          </a>
          <h1 className="text-[30px] font-bold leading-tight tracking-tight">{k.yeniBaslik}</h1>

          {gecerli === false ? (
            <div role="alert" className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[15px] text-white/80">{k.gecersiz}</p>
              <a href="/sifremi-unuttum" className="mt-4 inline-block rounded-xl bg-teal-500 px-5 py-3 text-[15px] font-bold text-[#04121a] transition hover:bg-teal-400">{k.yeniBaglanti}</a>
            </div>
          ) : bitti ? (
            <div role="status" className="mt-8 rounded-xl border border-teal-400/25 bg-teal-400/[0.06] p-5">
              <p className="text-[15px] leading-relaxed text-white/80">{k.tamamGirisYok}</p>
            </div>
          ) : gecerli ? (
            <>
              <p className="mt-2 text-[15px] leading-relaxed text-white/45">{k.yeniAlt}</p>
              <form onSubmit={kaydet} className="mt-8 space-y-4">
                <div>
                  <label htmlFor="yeni" className="mb-2 block text-[13px] font-medium text-white/60">{k.yeni}</label>
                  <input id="yeni" type="password" value={sifre} onChange={(e) => setSifre(e.target.value)} className={alan}
                    autoComplete="new-password" minLength={8} required autoFocus />
                </div>
                <div>
                  <label htmlFor="tekrar" className="mb-2 block text-[13px] font-medium text-white/60">{k.tekrar}</label>
                  <input id="tekrar" type="password" value={tekrar} onChange={(e) => setTekrar(e.target.value)} className={alan}
                    autoComplete="new-password" minLength={8} required />
                </div>
                {hata && <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-[13px] text-red-200">{hata}</div>}
                <button type="submit" disabled={mesgul}
                  className="w-full rounded-xl bg-teal-500 py-3.5 text-[15px] font-bold text-[#04121a] transition hover:bg-teal-400 disabled:opacity-50">
                  {mesgul ? k.kaydediliyor : k.kaydet}
                </button>
              </form>
            </>
          ) : null}

          <a href="/login" className="mt-8 block text-center text-[14px] text-white/50 transition hover:text-white/80">{k.girise}</a>
        </div>
      </div>
    </div>
  );
}
