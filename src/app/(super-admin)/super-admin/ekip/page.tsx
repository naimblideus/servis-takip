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

const girdi = 'w-full rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500';

export default function EkipSayfasi() {
  const { dil } = useDil();
  const m = ekipMetni(dil);
  const [hesaplar, setHesaplar] = useState<Hesap[] | null>(null);
  const [benimId, setBenimId] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [f, setF] = useState({ ad: '', eposta: '', sifre: '', rol: 'EKIP' as 'EKIP' | 'DISTRIBUTOR', marka: 'Pantum', kurumAd: m.varsayilanKurum });
  const [mesgul, setMesgul] = useState(false);
  // Şifreyi unutan üye: ekip adreslerinin posta kutusu yok, sahip yeni şifreyi koyar.
  const [sifirla, setSifirla] = useState<{ id: string; ad: string; sifre: string; ikiAdim: boolean } | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

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
      <p className="text-sm text-gray-500 mt-1 mb-6 max-w-2xl">{m.ekipAlt}</p>
      {hata && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{hata}</div>}
      {bilgi && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{bilgi}</div>}
      {sifirla && (
        <form className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 grid gap-3 max-w-xl"
          onSubmit={async (e) => {
            e.preventDefault();
            setBilgi(null);
            if (await istek('PATCH', '/api/super-admin/ekip', { id: sifirla.id, sifre: sifirla.sifre, ikiAdimSifirla: sifirla.ikiAdim })) {
              setBilgi(m.sifirlandi.replace('{ad}', sifirla.ad));
              setSifirla(null);
            }
          }}>
          <h2 className="text-lg font-semibold">{m.sifirlaBaslik.replace('{ad}', sifirla.ad)}</h2>
          <label className="grid gap-1 text-sm text-gray-700">{m.yeniSifre}
            <input className={girdi} type="password" value={sifirla.sifre} autoComplete="new-password" autoFocus
              onChange={(e) => setSifirla({ ...sifirla, sifre: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 min-h-[40px]">
            <input type="checkbox" checked={sifirla.ikiAdim} onChange={(e) => setSifirla({ ...sifirla, ikiAdim: e.target.checked })} className="h-4 w-4" />
            {m.ikiAdimSifirla}
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={mesgul || sifirla.sifre.length < 10} className="min-h-[44px] px-4 rounded-xl bg-blue-600 text-white hover:bg-blue-500 font-semibold disabled:opacity-50">{m.sifirlaKaydet}</button>
            <button type="button" onClick={() => setSifirla(null)} className="min-h-[44px] px-4 rounded-xl text-gray-700 hover:bg-gray-100">{m.vazgec}</button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-gray-200 bg-gray-50 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead><tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="px-4 py-3">{m.sutunAd}</th><th className="px-4 py-3">{m.sutunEposta}</th><th className="px-4 py-3">{m.sutunRol}</th>
            <th className="px-4 py-3">{m.sutunIkiAdim}</th><th className="px-4 py-3">{m.sutunSonGiris}</th><th className="px-4 py-3" />
          </tr></thead>
          <tbody>
            {hesaplar?.map((h) => (
              <tr key={h.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3 font-medium">{h.name}{h.id === benimId && <span className="ml-2 text-xs text-blue-700">({m.sen})</span>}</td>
                <td className="px-4 py-3 text-gray-700">{h.email}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${h.rol === 'SAHIP' ? 'bg-blue-100 text-blue-700' : h.rol === 'DISTRIBUTOR' ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'}`}>{h.rol === 'SAHIP' ? m.rolSahip : h.rol === 'DISTRIBUTOR' ? `${m.rolDistributor} · ${h.kurumAd ?? h.marka ?? ''}` : m.rolEkip}</span>
                </td>
                <td className={`px-4 py-3 ${h.totpEnabled ? 'text-emerald-700' : 'text-amber-700'}`}>{h.totpEnabled ? m.acik : m.kapali}</td>
                <td className="px-4 py-3 text-gray-500">{tarih(h.lastLoginAt)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {h.id !== benimId && (
                    <>
                      {h.rol !== 'DISTRIBUTOR' && <button type="button" disabled={mesgul} onClick={() => istek('PATCH', '/api/super-admin/ekip', { id: h.id, rol: h.rol === 'SAHIP' ? 'EKIP' : 'SAHIP' })}
                        className="min-h-[40px] px-3 rounded-lg text-xs text-gray-700 hover:bg-gray-100">
                        {m.rolYap.replace('{r}', h.rol === 'SAHIP' ? m.rolEkip : m.rolSahip)}
                      </button>}
                      <button type="button" disabled={mesgul} onClick={() => { setBilgi(null); setSifirla({ id: h.id, ad: h.name, sifre: '', ikiAdim: false }); }}
                        className="min-h-[40px] px-3 rounded-lg text-xs text-blue-700 hover:bg-blue-100">{m.sifirla}</button>
                      <button type="button" disabled={mesgul} onClick={() => { if (window.confirm(m.silOnay)) istek('DELETE', `/api/super-admin/ekip?id=${encodeURIComponent(h.id)}`); }}
                        className="min-h-[40px] px-3 rounded-lg text-xs text-red-700 hover:bg-red-100">{m.sil}</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {hesaplar?.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">{m.bos}</td></tr>}
          </tbody>
        </table>
      </div>

      <form className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-5 grid gap-3 max-w-xl"
        onSubmit={async (e) => { e.preventDefault(); if (await istek('POST', '/api/super-admin/ekip', f)) setF({ ...f, ad: '', eposta: '', sifre: '' }); }}>
        <h2 className="text-lg font-semibold">{m.yeniBaslik}</h2>
        <label className="grid gap-1 text-sm text-gray-700">{m.hesapTuru}
          <select className={girdi} value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value as 'EKIP' | 'DISTRIBUTOR' })}>
            <option value="EKIP">{m.rolEkip}</option>
            <option value="DISTRIBUTOR">{m.rolDistributor}</option>
          </select>
        </label>
        {f.rol === 'DISTRIBUTOR' && (
          <>
            <label className="grid gap-1 text-sm text-gray-700">{m.marka}<input className={girdi} value={f.marka} onChange={(e) => setF({ ...f, marka: e.target.value })} /></label>
            <label className="grid gap-1 text-sm text-gray-700">{m.kurumAd}<input className={girdi} value={f.kurumAd} onChange={(e) => setF({ ...f, kurumAd: e.target.value })} /></label>
            <p className="text-xs text-gray-500">{m.distributorNot}</p>
          </>
        )}
        <label className="grid gap-1 text-sm text-gray-700">{m.ad}<input className={girdi} value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} autoComplete="off" /></label>
        <label className="grid gap-1 text-sm text-gray-700">{m.eposta}<input className={girdi} type="email" value={f.eposta} onChange={(e) => setF({ ...f, eposta: e.target.value })} autoComplete="off" /></label>
        <label className="grid gap-1 text-sm text-gray-700">{m.geciciSifre}<input className={girdi} type="password" value={f.sifre} onChange={(e) => setF({ ...f, sifre: e.target.value })} autoComplete="new-password" /></label>
        <p className="text-xs text-gray-500">{m.geciciSifreNot}</p>
        <button type="submit" disabled={mesgul} className="min-h-[44px] rounded-xl bg-blue-600 text-white hover:bg-blue-500 font-semibold disabled:opacity-50">{m.ekle}</button>
      </form>
    </div>
  );
}
