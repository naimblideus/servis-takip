'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDil } from '@/lib/i18n/client';
import { ekipMetni } from '@/lib/ekip-metin';

/**
 * HESABIM — her süper admin (sahip ve ekip) kendi şifresini değiştirir ve
 * iki adımlı doğrulamayı kurar. 2FA ucu (/api/super-admin/2fa) vardı ama
 * ekranı yoktu: kimse açamıyordu.
 */
interface Durum { ad: string; eposta: string; rol: string; ikiAdim: boolean; kurtarmaKalan: number }

const girdi = 'w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-base text-white placeholder-gray-500 focus:outline-none focus:border-violet-400';
const kutu = 'rounded-2xl border border-white/10 bg-white/5 p-5 grid gap-3';
const dugme = 'min-h-[44px] rounded-xl bg-violet-600 hover:bg-violet-500 px-4 font-semibold disabled:opacity-50';

export default function HesabimSayfasi() {
  const { dil } = useDil();
  const m = ekipMetni(dil);
  const [d, setD] = useState<Durum | null>(null);
  const [mesaj, setMesaj] = useState<{ ok: boolean; t: string } | null>(null);
  const [sifre, setSifre] = useState({ mevcut: '', yeni: '' });
  const [kurulum, setKurulum] = useState<{ qr: string; secret: string } | null>(null);
  const [kod, setKod] = useState('');
  const [kurtarma, setKurtarma] = useState<string[] | null>(null);
  const [kapat, setKapat] = useState({ password: '', code: '' });

  const yukle = useCallback(async () => {
    const r = await fetch('/api/super-admin/hesabim');
    if (r.ok) setD(await r.json());
  }, []);
  useEffect(() => { yukle(); }, [yukle]);
  const hataMetni = (k: unknown) => (m.hata as Record<string, string>)[String(k)] ?? m.hata.GENEL;

  const ikiAdim = async (govde: Record<string, string>) => {
    const r = await fetch('/api/super-admin/2fa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) });
    return { ok: r.ok, j: await r.json().catch(() => ({})) };
  };

  return (
    <div className="p-4 sm:p-8 max-w-2xl grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">{m.hesabimBaslik}</h1>
        <p className="text-sm text-gray-400 mt-1">{m.hesabimAlt}</p>
        {d && <p className="text-sm text-gray-300 mt-3">{d.ad} · {d.eposta} · {d.rol === 'EKIP' ? m.rolEkip : m.rolSahip}</p>}
      </div>
      {mesaj && <div className={`rounded-xl px-4 py-3 text-sm border ${mesaj.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-red-500/30 bg-red-500/10 text-red-200'}`}>{mesaj.t}</div>}

      <form className={kutu} onSubmit={async (e) => {
        e.preventDefault();
        const r = await fetch('/api/super-admin/hesabim', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sifre) });
        const j = await r.json().catch(() => ({}));
        setMesaj(r.ok ? { ok: true, t: m.sifreTamam } : { ok: false, t: hataMetni(j.hata) });
        if (r.ok) setSifre({ mevcut: '', yeni: '' });
      }}>
        <h2 className="text-lg font-semibold">{m.sifreBaslik}</h2>
        <label className="grid gap-1 text-sm text-gray-300">{m.mevcutSifre}<input className={girdi} type="password" autoComplete="current-password" value={sifre.mevcut} onChange={(e) => setSifre({ ...sifre, mevcut: e.target.value })} /></label>
        <label className="grid gap-1 text-sm text-gray-300">{m.yeniSifre}<input className={girdi} type="password" autoComplete="new-password" value={sifre.yeni} onChange={(e) => setSifre({ ...sifre, yeni: e.target.value })} /></label>
        <button type="submit" className={dugme}>{m.sifreKaydet}</button>
      </form>

      <div className={kutu}>
        <h2 className="text-lg font-semibold">{m.ikiAdimBaslik}</h2>
        {d && <p className={`text-sm ${d.ikiAdim ? 'text-emerald-300' : 'text-amber-300'}`}>{d.ikiAdim ? m.ikiAdimAcik.replace('{n}', String(d.kurtarmaKalan)) : m.ikiAdimKapali}</p>}

        {kurtarma && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
            <div className="font-semibold text-amber-200">{m.kurtarmaBaslik}</div>
            <p className="text-xs text-amber-100/80 mt-1">{m.kurtarmaNot}</p>
            <div className="grid grid-cols-2 gap-1 mt-3 font-mono text-sm">{kurtarma.map((c) => <span key={c}>{c}</span>)}</div>
          </div>
        )}

        {d && !d.ikiAdim && !kurulum && (
          <button type="button" className={dugme} onClick={async () => {
            const { ok, j } = await ikiAdim({ action: 'setup' });
            if (ok) setKurulum({ qr: j.qr, secret: j.secret }); else setMesaj({ ok: false, t: m.hata.GENEL });
          }}>{m.ikiAdimKur}</button>
        )}
        {kurulum && (
          <form className="grid gap-3" onSubmit={async (e) => {
            e.preventDefault();
            const { ok, j } = await ikiAdim({ action: 'enable', code: kod });
            if (!ok) { setMesaj({ ok: false, t: m.kodHatali }); return; }
            setKurtarma(j.recoveryCodes ?? []); setKurulum(null); setKod(''); setMesaj({ ok: true, t: m.ikiAdimAcildi }); yukle();
          }}>
            <p className="text-sm text-gray-300">{m.ikiAdimTara}</p>
            {/* QR sunucudan data URL olarak gelir. */}
            <img src={kurulum.qr} alt="" width={180} height={180} className="rounded-lg bg-white p-2" />
            <p className="text-xs text-gray-400">{m.ikiAdimAnahtar}: <span className="font-mono break-all">{kurulum.secret}</span></p>
            <input className={girdi} inputMode="numeric" autoComplete="one-time-code" placeholder={m.kod} value={kod} onChange={(e) => setKod(e.target.value)} />
            <button type="submit" className={dugme}>{m.ikiAdimAc}</button>
          </form>
        )}
        {d?.ikiAdim && (
          <form className="grid gap-2 mt-2" onSubmit={async (e) => {
            e.preventDefault();
            const { ok, j } = await ikiAdim({ action: 'disable', ...kapat });
            if (!ok) { setMesaj({ ok: false, t: j?.kod === 'SIFRE_HATALI' ? m.hata.SIFRE_HATALI : m.kodHatali }); return; }
            setKapat({ password: '', code: '' }); setKurtarma(null); setMesaj({ ok: true, t: m.ikiAdimKapatildi }); yukle();
          }}>
            <input className={girdi} type="password" autoComplete="current-password" placeholder={m.mevcutSifre} value={kapat.password} onChange={(e) => setKapat({ ...kapat, password: e.target.value })} />
            <input className={girdi} inputMode="numeric" placeholder={m.kod} value={kapat.code} onChange={(e) => setKapat({ ...kapat, code: e.target.value })} />
            <button type="submit" className="min-h-[44px] rounded-xl border border-white/15 text-sm text-gray-300 hover:bg-white/5">{m.ikiAdimKapat}</button>
          </form>
        )}
      </div>
    </div>
  );
}
