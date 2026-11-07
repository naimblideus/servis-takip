'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/client';

/**
 * Şifre belirle → hemen giriş. Panel teknisyeni kendi ana sayfasına yönlendirir
 * (dashboard düzeni); telefondaysa panel "Telefona kur" kartını kendisi gösterir.
 */
export default function DavetFormu({ jeton, giris }: { jeton: string; giris: string }) {
  const k = useT().davet;
  const router = useRouter();
  const [sifre, setSifre] = useState('');
  const [tekrar, setTekrar] = useState('');
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState('');
  const [gecersiz, setGecersiz] = useState(false);
  const [bitti, setBitti] = useState(false);

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    setHata('');
    if (sifre !== tekrar) { setHata(k.uyusmuyor); return; }
    setMesgul(true);
    const r = await fetch('/api/davet', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jeton, sifre }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setHata(j.error ?? k.gecersiz);
      if (j.kod === 'DAVET_GECERSIZ') setGecersiz(true);
      setMesgul(false);
      return;
    }
    const g = await signIn('credentials', { email: j.giris ?? giris, password: sifre, totp: '', redirect: false });
    if (g?.error) { setBitti(true); setMesgul(false); return; }
    router.refresh();
    router.push('/dashboard');
  }

  const alan =
    'w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[15px] text-white ' +
    'placeholder:text-white/25 outline-none transition focus:border-teal-500/60 focus:bg-white/[0.06]';

  if (gecersiz) {
    return (
      <div role="alert" className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-[15px] text-white/80">{k.gecersiz}</p>
      </div>
    );
  }
  if (bitti) {
    return (
      <div role="status" className="mt-8 rounded-xl border border-teal-400/25 bg-teal-400/[0.06] p-5">
        <p className="text-[15px] leading-relaxed text-white/80">{k.tamamGirisYok}</p>
      </div>
    );
  }

  return (
    <form onSubmit={kaydet} className="mt-8 space-y-4">
      <div>
        <span className="mb-2 block text-[13px] font-medium text-white/60">{k.girisAdi}</span>
        {/* Parola yöneticisi giriş adını yeni şifreyle birlikte saklasın. */}
        <input type="text" name="username" autoComplete="username" value={giris} readOnly
          className={`${alan} cursor-default text-white/80`} />
      </div>
      <div>
        <label htmlFor="sifre" className="mb-2 block text-[13px] font-medium text-white/60">{k.sifre}</label>
        <input id="sifre" type="password" value={sifre} onChange={(e) => setSifre(e.target.value)} className={alan}
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
  );
}
