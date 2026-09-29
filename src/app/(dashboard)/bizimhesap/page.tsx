'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

/**
 * ── BİZİM HESAP AKTARIMI ──────────────────────────────────────────────────
 * Muhasebesini Bizim Hesap'ta tutan bayi için: Nextus'ta kesilen fatura
 * Bizim Hesap'a satış faturası olarak BİR KEZ gider. Ekran hiçbir faturayı
 * kendiliğinden göndermez; bayi seçer ve onaylar.
 */

type Ayar = { kurulu: boolean; maske: string | null; okunamiyor: boolean; anahtarVar: boolean };
type Fatura = {
  id: string; no: string; gibNo: string | null; donem: string; tarih: string; durum: string; tutar: number;
  musteriId: string; musteri: string; bhDurum: string | null; bhUrl: string | null; bhAt: string | null; bhHata: string | null;
};
type Veri = { ayar: Ayar; donem: string; donemler: string[]; faturalar: Fatura[] };
type Sonuc = { id: string; durum: string; hata?: string };

const ROZET: Record<string, string> = {
  YOK: 'bg-gray-100 text-gray-700',
  GONDERILIYOR: 'bg-sky-100 text-sky-800',
  GONDERILDI: 'bg-emerald-100 text-emerald-800',
  HATA: 'bg-red-100 text-red-800',
  IPTAL: 'bg-gray-100 text-gray-600',
};

export default function BizimHesapPage() {
  const t = useT();
  const b = useBicim();
  const s = t.bizimHesap;

  const [donem, setDonem] = useState('');
  const [veri, setVeri] = useState<Veri | null>(null);
  const [firmId, setFirmId] = useState('');
  const [mesaj, setMesaj] = useState<{ ok: boolean; metin: string } | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [secim, setSecim] = useState<Set<string>>(new Set());
  const [sonuc, setSonuc] = useState<Sonuc[] | null>(null);

  const hataMetni = useCallback((kod: string | null | undefined, ek: Record<string, string | number> = {}) => {
    if (!kod) return s.hata.AG;
    const sz = s.hata as Record<string, string>;
    // Bizim Hesap'ın kendi cümlesi (kod değil) olduğu gibi gösterilir.
    return sz[kod] ? doldur(sz[kod], ek) : kod;
  }, [s]);

  // Bağlantı hatası: sunucu bilinen bir kod döndürdüyse (YETKI_YOK gibi) onun
  // cümlesi, değilse "Bağlantı kurulamadı: <Bizim Hesap'ın cümlesi>".
  const baglantiHatasi = (d: { kod?: string; hata?: string; n?: number }) => {
    const sz = s.hata as Record<string, string>;
    if (d.hata && sz[d.hata]) return sz[d.hata];
    return hataMetni(d.kod, { hata: d.hata ?? '', n: d.n ?? '' });
  };

  const yukle = useCallback(async (d?: string) => {
    const r = await fetch(`/api/bizimhesap${d ? `?donem=${encodeURIComponent(d)}` : ''}`);
    if (!r.ok) { setMesaj({ ok: false, metin: s.hata.AG }); return; }
    const v = (await r.json()) as Veri;
    setVeri(v);
    setDonem(v.donem);
    setSecim(new Set());
  }, [s]);
  useEffect(() => { yukle(); }, [yukle]);

  const istek = async (url: string, init: RequestInit) => {
    setMesgul(true); setMesaj(null);
    try {
      const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
      const d = await r.json().catch(() => ({}));
      return { ok: r.ok, d };
    } catch {
      return { ok: false, d: { kod: 'AG' } };
    } finally {
      setMesgul(false);
    }
  };

  const baglan = async () => {
    const { ok, d } = await istek('/api/bizimhesap/ayar', { method: 'POST', body: JSON.stringify({ firmId }) });
    if (!ok) { setMesaj({ ok: false, metin: baglantiHatasi(d) }); return; }
    setFirmId('');
    setMesaj({ ok: true, metin: d.musteriSayisi != null ? doldur(s.denemeTamamSayi, { n: d.musteriSayisi }) : s.denemeTamam });
    yukle(donem);
  };
  const dene = async () => {
    const { ok, d } = await istek('/api/bizimhesap/ayar', { method: 'PUT' });
    setMesaj(ok
      ? { ok: true, metin: d.musteriSayisi != null ? doldur(s.denemeTamamSayi, { n: d.musteriSayisi }) : s.denemeTamam }
      : { ok: false, metin: baglantiHatasi(d) });
  };
  const kaldir = async () => {
    if (!confirm(s.kaldirOnay)) return;
    const { ok, d } = await istek('/api/bizimhesap/ayar', { method: 'DELETE' });
    if (!ok) { setMesaj({ ok: false, metin: hataMetni(d.kod) }); return; }
    yukle(donem);
  };

  const faturalar = veri?.faturalar ?? [];
  const gonderilebilir = (f: Fatura) => f.durum !== 'CANCELLED' && (f.bhDurum === null || f.bhDurum === 'HATA');
  const secilenler = faturalar.filter((f) => secim.has(f.id) && gonderilebilir(f));
  const seciliToplam = secilenler.reduce((a, f) => a + f.tutar, 0);

  const gonder = async () => {
    if (!secilenler.length) { setMesaj({ ok: false, metin: s.hata.SECIM_YOK }); return; }
    if (!confirm(doldur(s.gonderOnay, { n: secilenler.length }))) return;
    const { ok, d } = await istek('/api/bizimhesap', { method: 'POST', body: JSON.stringify({ ids: secilenler.map((f) => f.id) }) });
    if (!ok) { setMesaj({ ok: false, metin: hataMetni(d.kod, { n: d.n ?? '' }) }); return; }
    setSonuc(d.sonuclar ?? []);
    await yukle(donem);
  };

  const iptalEt = async (f: Fatura) => {
    if (!confirm(s.iptalOnay)) return;
    const { ok, d } = await istek('/api/bizimhesap/iptal', { method: 'POST', body: JSON.stringify({ id: f.id }) });
    setMesaj(ok ? { ok: true, metin: s.iptalTamam } : { ok: false, metin: hataMetni(d.hata ?? d.durum ?? d.kod) });
    await yukle(donem);
  };

  const ozet = useMemo(() => sonuc && {
    tamam: sonuc.filter((x) => x.durum === 'GONDERILDI').length,
    zaten: sonuc.filter((x) => x.durum === 'ZATEN').length,
    hata: sonuc.filter((x) => !['GONDERILDI', 'ZATEN'].includes(x.durum)).length,
  }, [sonuc]);

  const ayar = veri?.ayar;

  return (
    <div className="mx-auto max-w-6xl p-6 pb-16">
      <Link href="/accounting" className="text-sm text-blue-700 hover:underline">{s.geri}</Link>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">{s.baslik}</h1>
      <p className="mb-5 mt-1 max-w-3xl text-sm text-gray-600">{s.alt}</p>

      {mesaj && (
        <div role={mesaj.ok ? 'status' : 'alert'}
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${mesaj.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {mesaj.metin}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Bağlantı */}
        <div className="rounded-xl border bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">{s.baglantiBaslik}</h2>
          {ayar && !ayar.anahtarVar && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{s.anahtarYok}</p>}
          {ayar?.okunamiyor && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{s.okunamiyor}</p>}
          {ayar?.kurulu && !ayar.okunamiyor ? (
            <div className="mt-3">
              <p className="text-sm">
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">{s.bagli}</span>
                <span className="ml-2 font-mono text-gray-700">{doldur(s.bagliMaske, { maske: ayar.maske ?? '' })}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={dene} disabled={mesgul} className="rounded-lg border border-[#0f2253] px-3 py-1.5 text-sm font-semibold text-[#0f2253] disabled:opacity-50">{s.dene}</button>
                <button type="button" onClick={kaldir} disabled={mesgul} className="rounded-lg px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">{s.kaldir}</button>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600">
                {s.firmIdEtiket}
                <input value={firmId} onChange={(e) => setFirmId(e.target.value)} autoComplete="off" spellCheck={false}
                  className="mt-1 block w-full rounded-lg border px-3 py-2 font-mono text-sm" />
              </label>
              <p className="mt-1 text-xs text-gray-500">{s.firmIdIpucu}</p>
              <button type="button" onClick={baglan} disabled={mesgul || !firmId.trim()}
                className="mt-3 rounded-lg bg-[#0f2253] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {mesgul ? s.baglaniyor : s.baglan}
              </button>
            </div>
          )}
        </div>

        {/* Ne gider, ne gitmez */}
        <div className="rounded-xl border bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">{s.neGiderBaslik}</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-gray-700">
            {s.neGider.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      </div>

      {ozet && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {ozet.tamam > 0 && <p className="font-semibold">{doldur(s.sonucTamam, { n: ozet.tamam })}</p>}
          {ozet.zaten > 0 && <p>{doldur(s.sonucZaten, { n: ozet.zaten })}</p>}
          {ozet.hata > 0 && <p className="text-red-700">{doldur(s.sonucHata, { n: ozet.hata })}</p>}
        </div>
      )}

      {/* Faturalar */}
      <div className="mt-4 rounded-xl border bg-white">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-t-xl border-b bg-white px-4 py-3">
          <label className="text-sm text-gray-700">
            {s.donem}{' '}
            <select value={donem} onChange={(e) => { setSonuc(null); yukle(e.target.value); }} className="ml-1 rounded border px-2 py-1 text-sm">
              {[...new Set([donem, ...(veri?.donemler ?? [])])].filter(Boolean).sort().reverse().map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <span className="text-sm text-gray-700">{doldur(s.secili, { n: secilenler.length, tutar: b.para(seciliToplam) })}</span>
          <button type="button" onClick={gonder} disabled={mesgul || !secilenler.length || !ayar?.kurulu}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {mesgul ? s.gonderiliyor : doldur(s.gonder, { n: secilenler.length })}
          </button>
          <span className="ml-auto flex gap-3">
            <button type="button" onClick={() => setSecim(new Set(faturalar.filter((f) => f.durum !== 'CANCELLED' && f.bhDurum === null).map((f) => f.id)))}
              className="text-xs text-blue-700 hover:underline">{s.hepsiniSec}</button>
            <button type="button" onClick={() => setSecim(new Set())} className="text-xs text-gray-600 hover:underline">{s.hicbiri}</button>
          </span>
        </div>
        {faturalar.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">{s.faturaYok}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="w-8 px-3 py-2" />
                  <th className="px-3 py-2">{s.sutunNo}</th>
                  <th className="px-3 py-2">{s.sutunMusteri}</th>
                  <th className="px-3 py-2">{s.sutunTarih}</th>
                  <th className="px-3 py-2 text-right">{s.sutunTutar}</th>
                  <th className="px-3 py-2">{s.sutunDurum}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {faturalar.map((f) => {
                  const iptal = f.durum === 'CANCELLED';
                  const bh = f.bhDurum ?? 'YOK';
                  return (
                    <tr key={f.id} className={iptal ? 'bg-gray-50' : ''}>
                      <td className="px-3 py-2 align-top">
                        <input type="checkbox" checked={secim.has(f.id)} disabled={!gonderilebilir(f) || !ayar?.kurulu}
                          onChange={(e) => setSecim((m) => { const y = new Set(m); if (e.target.checked) y.add(f.id); else y.delete(f.id); return y; })} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-xs">
                        {f.no}{f.gibNo && f.gibNo !== f.no && <div className="text-gray-500">{f.gibNo}</div>}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Link href={`/customers/${f.musteriId}`} className="text-blue-700 hover:underline">{f.musteri}</Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-top">{b.tarih(f.tarih)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right align-top font-semibold">{b.para(f.tutar)}</td>
                      <td className="px-3 py-2 align-top">
                        {iptal && bh !== 'GONDERILDI' && bh !== 'IPTAL' ? (
                          <span className="text-xs text-gray-600">{s.iptalFatura}</span>
                        ) : (
                          <>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROZET[bh] ?? ROZET.YOK}`}>{(s.durum as Record<string, string>)[bh] ?? bh}</span>
                            {bh === 'GONDERILDI' && f.bhUrl && (
                              <a href={f.bhUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-blue-700 hover:underline">{s.ac}</a>
                            )}
                            {bh === 'HATA' && <div className="mt-1 max-w-sm text-xs text-red-700">{hataMetni(f.bhHata)}</div>}
                            {iptal && bh === 'GONDERILDI' && (
                              <div className="mt-1 text-xs text-amber-800">
                                {s.iptalDuruyor}{' '}
                                <button type="button" onClick={() => iptalEt(f)} disabled={mesgul} className="font-semibold underline disabled:opacity-50">{s.iptalEt}</button>
                              </div>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
