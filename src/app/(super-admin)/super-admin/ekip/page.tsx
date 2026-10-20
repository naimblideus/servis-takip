'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDil } from '@/lib/i18n/client';
import { ekipMetni } from '@/lib/ekip-metin';

/**
 * EKİP HESAPLARI — kurulum ve başarı ekibine süper admin hesabı aç/kaldır.
 * Yalnız sahip açar (middleware + uç). Ekip rolünün açtığı ekranlar
 * lib/super-admin-rol'de; bu ekran onları değiştirmez.
 */
interface Hesap { id: string; name: string; email: string; rol: 'SAHIP' | 'EKIP' | 'DISTRIBUTOR'; marka: string | null; kurumAd: string | null; totpEnabled: boolean; lastLoginAt: string | null }

const girdi = 'w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-base text-white placeholder-gray-500 focus:outline-none focus:border-violet-400';

export default function EkipSayfasi() {
  const { dil } = useDil();
  const m = ekipMetni(dil);
  const [hesaplar, setHesaplar] = useState<Hesap[] | null>(null);
  const [benimId, setBenimId] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [f, setF] = useState({ ad: '', eposta: '', sifre: '', rol: 'EKIP' as 'EKIP' | 'DISTRIBUTOR', marka: 'Pantum', kurumAd: m.varsayilanKurum });
  const [mesgul, setMesgul] = useState(false);

  const metin = useCallback((kod: unknown) => (m.hata as Record<string, string>)[String(kod)] ?? m.hata.GENEL, [m]);
  const yukle = useCallback(async () => {
    const r = await fetch('/api/super-admin/ekip');
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setHata(metin(j.hata)); return; }
    setHesaplar(j.hesaplar); setBenimId(j.benimId);
  }, [metin]);
  useEffect(() => { yukle(); }, [yukle]);

  const istek = async (yontem: string, yol: string, govde?: unknown) => {
    setMesgul(true); setHata(null);
    const r = await fetch(yol, { method: yontem, headers: { 'Content-Type': 'application/json' }, body: govde ? JSON.stringify(govde) : undefined });
    const j = await r.json().catch(() => ({}));
    setMesgul(false);
    if (!r.ok) { setHata(metin(j.hata)); return false; }
    await yukle();
    return true;
  };

  const tarih = (s: string | null) => (s ? new Date(s).toLocaleString(dil === 'en' ? 'en-GB' : 'tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : m.hic);

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <h1 className="text-2xl font-bold">{m.ekipBaslik}</h1>
      <p className="text-sm text-gray-400 mt-1 mb-6 max-w-2xl">{m.ekipAlt}</p>
      {hata && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{hata}</div>}

      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead><tr className="text-left text-gray-400 border-b border-white/10">
            <th className="px-4 py-3">{m.sutunAd}</th><th className="px-4 py-3">{m.sutunEposta}</th><th className="px-4 py-3">{m.sutunRol}</th>
            <th className="px-4 py-3">{m.sutunIkiAdim}</th><th className="px-4 py-3">{m.sutunSonGiris}</th><th className="px-4 py-3" />
          </tr></thead>
          <tbody>
            {hesaplar?.map((h) => (
              <tr key={h.id} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3 font-medium">{h.name}{h.id === benimId && <span className="ml-2 text-xs text-violet-300">({m.sen})</span>}</td>
                <td className="px-4 py-3 text-gray-300">{h.email}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${h.rol === 'SAHIP' ? 'bg-violet-600/30 text-violet-200' : h.rol === 'DISTRIBUTOR' ? 'bg-sky-600/20 text-sky-200' : 'bg-emerald-600/20 text-emerald-200'}`}>{h.rol === 'SAHIP' ? m.rolSahip : h.rol === 'DISTRIBUTOR' ? `${m.rolDistributor} · ${h.kurumAd ?? h.marka ?? ''}` : m.rolEkip}</span>
                </td>
                <td className={`px-4 py-3 ${h.totpEnabled ? 'text-emerald-300' : 'text-amber-300'}`}>{h.totpEnabled ? m.acik : m.kapali}</td>
                <td className="px-4 py-3 text-gray-400">{tarih(h.lastLoginAt)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {h.id !== benimId && (
                    <>
                      {h.rol !== 'DISTRIBUTOR' && <button type="button" disabled={mesgul} onClick={() => istek('PATCH', '/api/super-admin/ekip', { id: h.id, rol: h.rol === 'SAHIP' ? 'EKIP' : 'SAHIP' })}
                        className="min-h-[40px] px-3 rounded-lg text-xs text-gray-300 hover:bg-white/10">
                        {m.rolYap.replace('{r}', h.rol === 'SAHIP' ? m.rolEkip : m.rolSahip)}
                      </button>}
                      <button type="button" disabled={mesgul} onClick={() => { if (window.confirm(m.silOnay)) istek('DELETE', `/api/super-admin/ekip?id=${encodeURIComponent(h.id)}`); }}
                        className="min-h-[40px] px-3 rounded-lg text-xs text-red-300 hover:bg-red-500/10">{m.sil}</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {hesaplar?.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">{m.bos}</td></tr>}
          </tbody>
        </table>
      </div>

      <form className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 grid gap-3 max-w-xl"
        onSubmit={async (e) => { e.preventDefault(); if (await istek('POST', '/api/super-admin/ekip', f)) setF({ ...f, ad: '', eposta: '', sifre: '' }); }}>
        <h2 className="text-lg font-semibold">{m.yeniBaslik}</h2>
        <label className="grid gap-1 text-sm text-gray-300">{m.hesapTuru}
          <select className={girdi} value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value as 'EKIP' | 'DISTRIBUTOR' })}>
            <option value="EKIP">{m.rolEkip}</option>
            <option value="DISTRIBUTOR">{m.rolDistributor}</option>
          </select>
        </label>
        {f.rol === 'DISTRIBUTOR' && (
          <>
            <label className="grid gap-1 text-sm text-gray-300">{m.marka}<input className={girdi} value={f.marka} onChange={(e) => setF({ ...f, marka: e.target.value })} /></label>
            <label className="grid gap-1 text-sm text-gray-300">{m.kurumAd}<input className={girdi} value={f.kurumAd} onChange={(e) => setF({ ...f, kurumAd: e.target.value })} /></label>
            <p className="text-xs text-gray-400">{m.distributorNot}</p>
          </>
        )}
        <label className="grid gap-1 text-sm text-gray-300">{m.ad}<input className={girdi} value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} autoComplete="off" /></label>
        <label className="grid gap-1 text-sm text-gray-300">{m.eposta}<input className={girdi} type="email" value={f.eposta} onChange={(e) => setF({ ...f, eposta: e.target.value })} autoComplete="off" /></label>
        <label className="grid gap-1 text-sm text-gray-300">{m.geciciSifre}<input className={girdi} type="password" value={f.sifre} onChange={(e) => setF({ ...f, sifre: e.target.value })} autoComplete="new-password" /></label>
        <p className="text-xs text-gray-400">{m.geciciSifreNot}</p>
        <button type="submit" disabled={mesgul} className="min-h-[44px] rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold disabled:opacity-50">{m.ekle}</button>
      </form>
    </div>
  );
}
